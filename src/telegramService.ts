import * as Tg from "typegram";
import { ApiResponse, Message, Update } from "typegram";
import appSettings from "./appSettingsGet";
import registerUser from "./commands/registerUser";
import objectRecursiveSearch from "./helpers/objectRecursiveSearch";
import processNow from "./helpers/processNow";
import onExit from "./onExit";
import Repo from "./repo";
import TelegramCore from "./telegramCore";
import {
  BotConfig,
  EventCancellation,
  EventPredicate,
  FileInfo,
  ITelegramService,
  MyBotCommand,
  NewFileMessage,
  NewTextMessage,
  NotifyMessage,
  Opts,
  ServiceEvent,
  TelegramListenOptions,
} from "./types";
import { CheckBot, isValidationExpired } from "./userCheckBot";
import UserItem from "./userItem";

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
      process.env.DEBUG && process.stdout.write(".");
    }

    this.isPending = false;
  }

  gotUpdate(v: Update): void {
    process.env.DEBUG && console.log("got update", v);
    try {
      let defFn;
      let chatId: number | undefined;
      let file: FileInfo | undefined;
      const type: ServiceEvents | null = (() => {
        if ((v as Update.CallbackQueryUpdate).callback_query) {
          chatId = (v as Update.CallbackQueryUpdate).callback_query?.message?.chat.id;
          return ServiceEvents.gotCallbackQuery;
        }
        if ((v as Update.MessageUpdate).message) {
          chatId = (v as Update.MessageUpdate).message.chat.id;
          const msg = (v as Update.MessageUpdate).message;
          if ((msg as Message.TextMessage).text?.startsWith("/")) {
            defFn = () => this.gotBotCommand(v as NewTextMessage, chatId);
            return ServiceEvents.gotBotCommand;
          } else if ((msg as Message.DocumentMessage).document) {
            file = (msg as Message.DocumentMessage).document;
            return ServiceEvents.gotFile;
          } else if ((msg as Message.AudioMessage).audio) {
            file = (msg as Message.AudioMessage).audio;
            return ServiceEvents.gotFile;
          } else if ((msg as Message.VoiceMessage).voice) {
            file = (msg as Message.VoiceMessage).voice;
            return ServiceEvents.gotFile;
          } else if ((msg as Message.VideoMessage).video) {
            file = (msg as Message.VideoMessage).video;
            return ServiceEvents.gotFile;
          } else if ((msg as Message.PhotoMessage).photo) {
            // we skip the other photos
            file = (msg as Message.PhotoMessage).photo[0];
            return ServiceEvents.gotFile;
          } else if ((msg as Message.AnimationMessage).animation) {
            file = (msg as Message.AnimationMessage).animation;
            return ServiceEvents.gotFile;
          }
          return ServiceEvents.gotNewMessage;
        }
        if ((v as Update.EditedMessageUpdate).edited_message) {
          chatId = (v as Update.EditedMessageUpdate).edited_message.chat.id;
          return ServiceEvents.gotEditedMessage;
        }

        objectRecursiveSearch(v, (key, obj) => {
          if (key === "chat") {
            chatId = obj[key].id;
            return true;
          }
          return false;
        });

        return null;
      })();

      let isPrevented = false;
      const preventDefault = () => {
        isPrevented = true;
      };

      const leftListeners: IEventListenerObj<Update>[] = [];
      //todo: bug => something handled after sendSelfDestroyed ???
      const isHandled = this.eventListeners.some(async (e) => {
        if (e.type === type || e.type === ServiceEvents.gotUpdate) {
          if (e.predicate) {
            if (e.predicate(v, chatId)) {
              isPrevented = true;
              await e.resolve({
                preventDefault,
                result: Object.assign({}, v, { file }) as NewFileMessage | Update,
              });
            }
          } else {
            await e.resolve({ preventDefault, result: v });
          }

          if (isPrevented) {
            return true;
          }
        } else {
          leftListeners.push(e);
        }
      });
      this.eventListeners = leftListeners;

      if (isHandled) {
        return;
      } else if (!defFn || !defFn()) {
        console.log(`TelegramService '${this.cfg.name}'. Got unhandled update\n`, v);
      }
    } catch (err) {
      console.error(`TelegramService '${this.cfg.name}'. Error in gotUpdate\n`, err);
    }
  }

  gotBotCommand(v: NewTextMessage, chat_id: number | string | undefined): boolean {
    const text = v.message.text;
    let end: number | undefined = text.indexOf(" ", 1);
    if (end === -1) {
      end = undefined;
    }
    const textCmd = text.substring(0, end);
    const cmd = this.commands.find((c) => c.command === textCmd);
    if (cmd) {
      const user = Repo.getUser(v.message.from.id);
      const allowCommand = !!user && !user.isInvalid && !isValidationExpired(user) && !process.env.DEBUG;
      // todo don't allow private commands in groupChat
      // todo allow group commands in groupChat for any user
      if (allowCommand || (cmd.allowCommand && cmd.allowCommand())) {
        chat_id && this.core.deleteMessageForce({ chat_id, message_id: v.message.message_id });
        cmd.callback(v.message, this, user);
      } else {
        process.env.DEBUG && console.log(`Decline command. User ${v.message.from.id} is not registered or invalid`);
      }
    } else if (!Repo.users.length && textCmd === appSettings.ownerRegisterCmd) {
      registerUser(v.message, this, new UserItem(v.message.from.id, CheckBot.generateUserKey()));
      return true;
    }
    return !!cmd;
  }

  /** listen for updates */
  async listen(options: TelegramListenOptions): Promise<void> {
    let si: NodeJS.Timeout;

    const info = await this.core.getWebhookInfo();
    if (!info.ok) {
      return; // case impossible because of Promise.reject on error but required for TS-checking
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
        // listen by ordinary logic
        this.listen({ ...options, certPath: undefined, ownDomainURL: undefined, keyPath: undefined });
        return;
      }
    }

    console.log(`TelegramService '${this.cfg.name}'. Listening...`);

    // listening for termination app
    onExit(() => {
      clearInterval(si);
      return this.core.tryDeleteWebhook();
    });
  }

  private commands: MyBotCommand[] = [];
  async assignCommands(arr: MyBotCommand[]): Promise<void> {
    await this.core.setMyCommands({
      commands: arr.filter((v) => !v.isHidden).map((v) => ({ command: v.command, description: v.description })),
    });
    this.commands = arr;
    this.commands.forEach((c) => {
      c.command = "/" + c.command;
      c.onServiceInit && c.onServiceInit(this);
    });
  }

  async sendSelfDestroyed(
    args: Opts<"sendMessage">,
    deleteTimeoutSec: number
  ): Promise<Tg.ApiResponse<Message.TextMessage>> {
    const res = await this.core.sendMessage(args);
    if (!res.ok) {
      return res;
    }
    const chat_id = args.chat_id as number;

    try {
      await this.onGotUpdate(chat_id, deleteTimeoutSec * 1000);
    } catch (err) {
      if (!err.isCancelled) {
        console.error(err);
        res.ok = false as true;
      }
    }
    this.core.deleteMessageForce({ chat_id, message_id: res.result.message_id });
    return res;
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
            //cancellation here
          }, waitMs);
        });
      } else {
        return delMsg();
      }
    };
    return msg;
  }

  eventListeners: IEventListenerObj<Update>[] = [];
  private addEventListener<T extends Update>(
    type: ServiceEvents,
    predicateOrChatId: number | string | EventPredicate<T>,
    cancellationOrTimeout: EventCancellation | undefined | number
  ): Promise<ServiceEvent<T>> {
    const predicate =
      typeof predicateOrChatId === "function"
        ? (predicateOrChatId as (e: Update) => boolean)
        : (_e: Update, chatId?: number) => chatId === (predicateOrChatId as number);

    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout;
      const listener = {
        type,
        predicate,
        resolve: (v) => {
          timer && clearTimeout(timer);
          return resolve(v as ServiceEvent<T>);
        },
      } as IEventListenerObj<Update>;
      this.eventListeners.push(listener);
      if (cancellationOrTimeout) {
        if (typeof cancellationOrTimeout === "function") {
          cancellationOrTimeout(() => {
            reject(Object.assign(new Error("Waiting is cancelled via cancellation()"), { isCancelled: true }));
            this.removeEventListener(listener);
          });
        } else {
          timer = setTimeout(() => {
            reject(Object.assign(new Error("Waiting is cancelled via timeout()"), { isCancelled: true }));
            this.removeEventListener(listener);
          }, cancellationOrTimeout);
        }
      }
    });
  }

  private removeEventListener(listener: IEventListenerObj<Update>) {
    const i = this.eventListeners.indexOf(listener);
    if (i !== -1) {
      this.eventListeners.splice(i, 1);
    }
  }

  onGotCallbackQuery(
    predicateOrChatId: number | string | EventPredicate<Update.CallbackQueryUpdate>,
    cancellationOrTimeout?: EventCancellation | number
  ): Promise<ServiceEvent<Update.CallbackQueryUpdate>> {
    return this.addEventListener(ServiceEvents.gotCallbackQuery, predicateOrChatId, cancellationOrTimeout);
  }

  onGotUpdate(
    predicateOrChatId: number | string | EventPredicate<Update>,
    cancellationOrTimeout?: EventCancellation | number
  ): Promise<ServiceEvent<Update>> {
    return this.addEventListener(ServiceEvents.gotUpdate, predicateOrChatId, cancellationOrTimeout);
  }

  onGotFile(
    predicateOrChatId: number | string | EventPredicate<NewFileMessage>,
    cancellationOrTimeout?: EventCancellation | number
  ): Promise<ServiceEvent<NewFileMessage>> {
    return this.addEventListener(ServiceEvents.gotFile, predicateOrChatId, cancellationOrTimeout);
  }
}

interface IEventListenerObj<T extends Update> {
  type: ServiceEvents;
  predicate?: (e: T, chatId: number | undefined) => boolean;
  resolve: (v: ServiceEvent<T> | PromiseLike<ServiceEvent<T>>) => Promise<void>;
}

const enum ServiceEvents {
  gotUpdate,
  gotCallbackQuery,
  gotNewMessage,
  gotEditedMessage,
  gotBotCommand,
  gotFile,
}
