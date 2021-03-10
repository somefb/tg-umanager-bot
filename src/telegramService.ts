import * as Tg from "typegram";
import { ApiResponse, Message, Update } from "typegram";
import objectRecursiveSearch from "./helpers/objectRecursiveSearch";
import processNow from "./helpers/processNow";
import TelegramCore from "./telegramCore";
import {
  BotConfig,
  EventCancellation,
  EventPredicate,
  ITelegramService,
  MyBotCommand,
  NewTextMessage,
  NotifyMessage,
  Opts,
  ServiceEvent,
  TelegramListenOptions,
} from "./types";

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
      const type: ServiceEvents | null = (() => {
        if ((v as Update.CallbackQueryUpdate).callback_query) {
          chatId = (v as Update.CallbackQueryUpdate).callback_query?.message?.chat.id;
          return ServiceEvents.gotCallbackQuery;
        }
        if ((v as Update.MessageUpdate).message) {
          chatId = (v as Update.MessageUpdate).message.chat.id;
          const msg = (v as Update.MessageUpdate).message;
          if ((msg as Message.TextMessage).text?.startsWith("/")) {
            defFn = () => this.gotBotCommand(v as NewTextMessage);
            return ServiceEvents.gotBotCommand;
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
      const isHandled = this.eventListeners.some(async (e) => {
        if (e.type === type || e.type === ServiceEvents.gotUpdate) {
          if (e.predicate) {
            if (e.predicate(v, chatId)) {
              isPrevented = true;
              await e.resolve({ preventDefault, result: v });
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

  gotBotCommand(v: NewTextMessage): boolean {
    const text = v.message.text;
    let end: number | undefined = text.indexOf(" ", 1);
    if (end === -1) {
      end = undefined;
    }
    const textCmd = text.substring(0, end);
    const cmd = this.commands.find((c) => c.command === textCmd);
    cmd && cmd.callback(v.message, this);
    return !!cmd;
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
        // listen by ordinary logic
        this.listen({ ...options, certPath: undefined, ownDomainURL: undefined, keyPath: undefined });
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
    this.commands.forEach((c) => {
      c.command = "/" + c.command;
      c.onServiceInit && c.onServiceInit(this);
    });
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

  eventListeners: IEventListenerObj<Update>[] = [];
  private addEventListener<T extends Update>(
    type: ServiceEvents,
    predicateOrChatId: number | EventPredicate<T>,
    cancellation: EventCancellation | undefined
  ): Promise<ServiceEvent<T>> {
    const predicate =
      typeof predicateOrChatId === "function"
        ? (predicateOrChatId as (e: Update) => boolean)
        : (_e: Update, chatId?: number) => chatId === (predicateOrChatId as number);

    return new Promise((resolve, reject) => {
      const listener = {
        type,
        predicate,
        resolve,
      } as IEventListenerObj<Update>;
      this.eventListeners.push(listener);
      cancellation &&
        cancellation(() => {
          reject(Object.assign(new Error("Waiting is cancelled via cancellation()"), { isCancelled: true }));
          this.removeEventListener(listener);
        });
    });
  }

  private removeEventListener(listener: IEventListenerObj<Update>) {
    const i = this.eventListeners.indexOf(listener);
    if (i !== -1) {
      this.eventListeners.splice(i, 1);
    }
  }

  onGotCallbackQuery(
    predicateOrChatId: number | EventPredicate<Update.CallbackQueryUpdate>,
    cancellation?: EventCancellation
  ): Promise<ServiceEvent<Update.CallbackQueryUpdate>> {
    return this.addEventListener(ServiceEvents.gotCallbackQuery, predicateOrChatId, cancellation);
  }

  onGotUpdate(
    predicateOrChatId: number | EventPredicate<Update>,
    cancellation?: EventCancellation
  ): Promise<ServiceEvent<Update>> {
    return this.addEventListener(ServiceEvents.gotUpdate, predicateOrChatId, cancellation);
  }
}

interface IEventListenerObj<T extends Update> {
  type: ServiceEvents;
  predicate?: (e: T, chatId: number | undefined) => boolean;
  resolve: (v: ServiceEvent<T>) => Promise<void>;
}

const enum ServiceEvents {
  gotUpdate,
  gotCallbackQuery,
  gotNewMessage,
  gotEditedMessage,
  gotBotCommand,
}
