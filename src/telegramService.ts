import * as Tg from "typegram";
import { ApiResponse, Update } from "typegram";
import TelegramCore from "./telegramCore";
import { BotConfig, ITelegramService, MyBotCommand, NotifyMessage, Opts, TelegramListenOptions } from "./types";

const services: TelegramService[] = [];

export default class TelegramService implements ITelegramService {
  core: TelegramCore;
  cfg: BotConfig;
  get services(): TelegramService[] {
    return services;
  }

  constructor(botConfig: BotConfig) {
    services.push(this);
    this.cfg = botConfig;
    this.core = new TelegramCore(botConfig.token);

    this.assignCommands(botConfig.commands);
  }

  isPending = false;
  updateOffset?: number;
  async getUpdates(): Promise<void> {
    this.isPending = true;

    let v: ApiResponse<Update[]> | undefined;
    try {
      v = await this.core.getUpdates({ offset: this.updateOffset });
    } catch {
      process.stdout.write("\n");
    }

    if (v && v.ok && v.result.length) {
      this.updateOffset = v.result[v.result.length - 1].update_id + 1;
      v.result.forEach((r) => {
        this.gotUpdate(r);
      });
    } else {
      process.stdout.write(".");
    }

    this.isPending = false;
  }

  gotUpdate(v: Update): void {
    console.warn("got update", v);
    try {
      const msg = (v as Tg.Update.MessageUpdate).message;
      if (msg) {
        const text = (msg as Tg.Message.TextMessage).text;
        if (text) {
          if (text.startsWith("/")) {
            let end: number | undefined = text.indexOf(" ", 1);
            if (end === -1) {
              end = undefined;
            }
            const textCmd = text.substring(0, end);
            // this is command to bot
            const cmd = this.commands.find((c) => c.command === textCmd);
            cmd && cmd.callback(msg as Tg.Message.TextMessage, this);
          }
        } else {
          console.log(`TelegramService '${this.cfg.name}'. Got unhandled update\n`, msg);
        }
      }
    } catch (err) {
      console.error(`TelegramService '${this.cfg.name}'. Error in gotUpdate\n`, err);
    }
  }

  /** listen for updates */
  async listen(options: TelegramListenOptions): Promise<void> {
    let si: NodeJS.Timeout;

    const info = await this.core.getWebhookInfo();
    if (!info.ok) {
      return; // case impossible because of Promise.reject on error
    }

    if (info.result.url) {
      console.log(`TelegramService '${this.cfg.name}'. Deleting previous webhook...`);
      await this.core.deleteWebhook();
    }

    if (!options.certPath || !options.keyPath || !options.ownDomainURL) {
      if (options.certPath || options.keyPath || options.ownDomainURL) {
        console.error(
          `TelegramService '${this.cfg.name}'. certPath/keyPath/ownDomainURL is not defined. Using getUpdates() instead of webHook.`
        );
      } else {
        console.log(`TelegramService '${this.cfg.name}'. Using getUpdates() with interval ${options.interval} ms`);
      }
      const listenFn = () => this.getUpdates();
      await listenFn();
      si = setInterval(() => {
        !this.isPending && listenFn();
      }, options.interval);
    } else {
      console.log(`TelegramService '${this.cfg.name}'. Setting up webhook logic`);

      try {
        await this.core.setWebhook({ url: options.ownDomainURL, certificate: options.certPath });
        const port = process.env.PORT_HTTPS || 3000;
        this.core.listenWebhook(port, (v) => this.gotUpdate(v));
      } catch {
        console.error(
          `TelegramService '${this.cfg.name}'. Error during the setting webhook. Switching to getUpdate();`
        );
        this.listen(options);
        return;
      }
    }

    console.log(`TelegramService '${this.cfg.name}'. Listening...`);

    // listening for termination app
    process.on("beforeExit", () => {
      console.log(`Exit detected: TelegramService closing...`);
      clearInterval(si);
      this.core.tryDeleteWebhook();
    });
  }

  private commands: MyBotCommand[] = [];
  async assignCommands(arr: MyBotCommand[]): Promise<void> {
    await this.core.setMyCommands({ commands: arr });
    this.commands = arr;
    this.commands.forEach((c) => (c.command = "/" + c.command));
    // todo create command /help with listing of commands
    // const helpCommand: MyBotCommand = {
    //   command: "/help",
    //   callback: () => {},
    // };
  }

  async notify(args: Opts<"sendMessage">, minNotifyMs = 3000): Promise<Tg.ApiError | NotifyMessage> {
    const res = await this.core.sendMessage(args);
    if (!res.ok) {
      return res;
    }
    const t0 = processNow();
    const msg = res as NotifyMessage;
    const delMsg = () => this.core.deleteMessageForce({ chat_id: args.chat_id, message_id: msg.result.message_id });
    msg.cancel = () => {
      const t1 = processNow();
      const waitMs = minNotifyMs - (t1 - t0);
      if (waitMs > 0) {
        return new Promise((resolve) => {
          setTimeout(() => {
            delMsg().then((v) => resolve(v));
          }, waitMs);
        });
      } else {
        return delMsg();
      }
    };
    return msg;
  }
}

function processNow() {
  const hr = process.hrtime();
  return hr[0] * 1000 + hr[1] / 1e6;
}
