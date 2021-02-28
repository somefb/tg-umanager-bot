import FormData from "form-data";
import { createReadStream } from "fs";
import http from "http";
import https, { RequestOptions } from "https";
import { ApiError, ApiResponse, Message, P, TelegramPR, Update, WebhookInfo } from "typegram";
import { ITelegramCore, Opts } from "./types";

type MyHttpOptions<O> = Partial<{
  skipResponse: boolean;
  skipApiErrors: boolean;
  /** key in object for filePath */
  filePathKey: keyof O;
}>;

export default class TelegramCore implements ITelegramCore {
  private botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  getUrl = (cmd: keyof TelegramPR) => `https://api.telegram.org/bot${this.botToken}/${cmd}` as const;

  private httpRequest<T, O extends Record<string, unknown>>(
    method: "GET" | "POST",
    url: string,
    obj?: O,
    opts?: MyHttpOptions<O>
  ): Promise<T> {
    const options: RequestOptions = {
      method,
    };

    let data: string | undefined;
    let form: FormData | undefined;

    if (opts && opts.filePathKey) {
      // example here: https://wanago.io/2019/03/18/node-js-typescript-6-sending-http-requests-understanding-multipart-form-data/
      form = new FormData();
      if (obj) {
        const f = form;
        Object.keys(obj).forEach((key) => {
          if (key === opts.filePathKey) {
            f.append(key, createReadStream(obj[key] as string));
          } else {
            f.append(key, obj[key]);
          }
        });
      }
      options.headers = form.getHeaders();
    } else if (obj !== undefined) {
      data = JSON.stringify(obj);
      options.headers = {
        "Content-Type": "application/json;",
        //"Content-Length": data.length,
      };
    }

    const makeRequest = () => {
      return new Promise<T>((resolve, reject) => {
        const req = https
          .request(
            url,
            options,
            opts?.skipResponse
              ? undefined
              : (res) => {
                  let txt = "";
                  res.on("data", (chunk) => {
                    txt += chunk;
                  });
                  res.on("end", () => {
                    const result = JSON.parse(txt) as T;
                    if (!opts?.skipApiErrors && (!result || !((result as unknown) as ApiResponse<unknown>).ok)) {
                      const rErr = (result as unknown) as ApiError | undefined;
                      if (rErr?.error_code === 429) {
                        // limits 30 usersOrMessages/sec and 20 messagesToSameGroup/minute === error_code 429
                        // todo theoreticaly possible: Maximum call stack size exceeded

                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        const t = (rErr.parameters?.retry_after || 1) * 1000;
                        console.warn(`TelegramCore. Got 429 error. Will retry response after ${t} sec`);
                        setTimeout(() => {
                          resolve(makeRequest());
                        }, t);
                      } else {
                        console.error("TelegramCore. API error: \n" + txt);
                        reject(result);
                      }
                    } else {
                      resolve(result);
                    }
                  });
                }
          )
          .on("error", (err: ErrnoException) => {
            if (err.code === "ETIMEDOUT") {
              console.warn("TelegramCore. Got ETIMEDOUT. Will retry response");
              setTimeout(() => {
                resolve(makeRequest());
              }, 50);
            } else {
              console.error("TelegramCore. HTTP error: \n" + err.message, err);
              reject(err);
            }
          });

        if (form) {
          form.pipe(req);
        } else {
          data && req.write(data);
          req.end();
        }
        if (opts?.skipResponse) {
          resolve(({} as unknown) as T);
        }
      });
    };

    return makeRequest();
  }

  private httpGet = <T, O extends Record<string, unknown>>(cmd: keyof TelegramPR): Promise<ApiResponse<T>> =>
    this.httpRequest<ApiResponse<T>, O>("GET", this.getUrl(cmd));

  private httpPost = <T, O extends Record<string, unknown>>(
    cmd: keyof TelegramPR,
    obj?: O,
    opts?: MyHttpOptions<O>
  ): Promise<ApiResponse<T>> => this.httpRequest<ApiResponse<T>, O>("POST", this.getUrl(cmd), obj, opts);

  getUpdates(args?: Opts<"getUpdates">): P<ApiResponse<Update[]>> {
    return this.httpPost("getUpdates", args);
  }

  unpinAllChatMessages(args: Opts<"unpinAllChatMessages">): P<ApiResponse<true>> {
    return this.httpPost("unpinAllChatMessages", args);
  }

  setMyCommands(args: Opts<"setMyCommands">): P<ApiResponse<true>> {
    return this.httpPost("setMyCommands", args);
  }

  sendMessage(args: Opts<"sendMessage">): P<ApiResponse<Message.TextMessage>> {
    return this.httpPost("sendMessage", args);
  }

  deleteMessage(args: Opts<"deleteMessage">): P<ApiResponse<true>> {
    return this.httpPost("deleteMessage", args);
  }

  /** Removing message without getting response and errors */
  deleteMessageForce(args: Opts<"deleteMessage">): P<void> {
    return (this.httpPost("deleteMessage", args, { skipResponse: true }) as unknown) as P<void>;
  }

  static webHooks: {
    ref: TelegramCore;
    callback: (v: Update) => unknown;
  }[] = [];
  static webHookServer?: http.Server;

  async setWebhook(args: Opts<"setWebhook">): P<ApiResponse<true>> {
    args.url += this.botToken;
    const v = await this.httpPost("setWebhook", args, { filePathKey: "certificate" });
    if (!v.ok) {
      throw new Error(v.description);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      TelegramCore.webHooks.push({ ref: this, callback: () => {} });
      return v as ApiResponse<true>;
    }
  }

  listenWebhook(port: string | number, callback: (v: Update) => unknown): void {
    const el = TelegramCore.webHooks.find((v) => v.ref === this);
    if (el) {
      el.callback = callback;
    } else {
      TelegramCore.webHooks.push({ ref: this, callback });
    }

    if (TelegramCore.webHookServer) {
      // todo it can be wrong if different ports
      return;
    }

    TelegramCore.webHookServer = http.createServer((req, res) => {
      const el = TelegramCore.webHooks.find((v) => req.url?.endsWith(v.ref.botToken));
      if (!el) {
        console.warn("TelegramCore. Can't find registered webhook. Possible incoming url is wrong:", req.url);
        return;
      }
      let txt = "";
      req.on("data", (chunk) => {
        txt += chunk;
      });
      req.on("end", () => {
        let result;
        try {
          result = JSON.parse(txt);
        } catch (error) {
          console.error("TelegramCore. Https-server-error. Received not json-data", txt);
        }

        res.writeHead(200);
        res.end();
        result && el.callback(result);
      });
    });

    TelegramCore.webHookServer.listen(port);

    process.on("beforeExit", () => {
      TelegramCore.webHookServer && TelegramCore.webHookServer.close();
    });
  }

  tryDeleteWebhook(args?: Opts<"deleteWebhook">): P<ApiResponse<true>> | P<void> {
    const i = TelegramCore.webHooks.findIndex((v) => v.ref === this);
    if (i !== -1) {
      TelegramCore.webHooks.splice(i, 1);
      if (!TelegramCore.webHooks.length) {
        TelegramCore.webHookServer && TelegramCore.webHookServer.close();
        TelegramCore.webHookServer = undefined;
      }
      return this.deleteWebhook(args);
    }

    return Promise.resolve();
  }

  deleteWebhook(args?: Opts<"deleteWebhook">): P<ApiResponse<true>> {
    return this.httpPost("deleteWebhook", args);
  }

  getWebhookInfo(): P<ApiResponse<WebhookInfo>> {
    return this.httpGet("getWebhookInfo");
  }
}

export interface ErrnoException extends Error {
  errno?: number;
  code?: string;
  path?: string;
  syscall?: string;
  stack?: string;
}
