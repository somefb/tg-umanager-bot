import { ApiResponse, CallbackQuery, Message, Update } from "typegram";
import appSettings from "./appSettingsGet";
import BotContext from "./botContext";
import registerUser from "./commands/registerUser";
import objectRecursiveSearch from "./helpers/objectRecursiveSearch";
import onExit from "./onExit";
import Repo from "./repo";
import TelegramCore from "./telegramCore";
import {
  BotConfig,
  EventPredicate,
  EventTypeEnum,
  EventTypeReturnType,
  IBotContext,
  ITelegramService,
  MyBotCommand,
  NewTextMessage,
  TelegramListenOptions,
} from "./types";
import { CheckBot, isValidationExpired } from "./userCheckBot";
import UserItem from "./userItem";

const services: TelegramService[] = [];

export default class TelegramService implements ITelegramService {
  core: TelegramCore;
  cfg: BotConfig;
  botUserName = "";

  get services(): TelegramService[] {
    return services;
  }

  constructor(botConfig: BotConfig) {
    services.push(this);
    this.cfg = botConfig;
    this.core = new TelegramCore(botConfig.token);

    this.assignCommands(botConfig.commands);

    this.core.getMe().then((v) => {
      if (v.ok) {
        this.botUserName = v.result.username;
      }
    });
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

  async gotUpdate(upd: Update): Promise<void> {
    //process.env.DEBUG && console.log("got update", v);
    try {
      let defFn: null | (() => boolean) = null;
      let chatId: number | undefined;

      const r = ((): { value: EventTypeReturnType[EventTypeEnum]; type: EventTypeEnum } => {
        if ((upd as Update.CallbackQueryUpdate).callback_query) {
          const q = (upd as Update.CallbackQueryUpdate).callback_query as CallbackQuery.DataCallbackQuery;
          chatId = q.message?.chat.id;
          return {
            type: EventTypeEnum.gotCallbackQuery,
            value: q as EventTypeReturnType[EventTypeEnum.gotCallbackQuery],
          };
        }
        if ((upd as Update.MessageUpdate).message) {
          const m = (upd as Update.MessageUpdate).message;
          chatId = m.chat.id;
          if ((m as Message.TextMessage).text?.startsWith("/")) {
            if (chatId) {
              const cid = chatId;
              defFn = () => this.gotBotCommand(m as NewTextMessage, cid);
            }
            return {
              type: EventTypeEnum.gotBotCommand,
              value: m as EventTypeReturnType[EventTypeEnum.gotBotCommand],
            };
          } else if ((m as Message.DocumentMessage).document) {
            const file = (m as Message.DocumentMessage).document;
            (m as EventTypeReturnType[EventTypeEnum.gotFile]).file = file;
            return {
              type: EventTypeEnum.gotFile,
              value: m as EventTypeReturnType[EventTypeEnum.gotFile],
            };
          } else if ((m as Message.AudioMessage).audio) {
            const file = (m as Message.AudioMessage).audio;
            (m as EventTypeReturnType[EventTypeEnum.gotFile]).file = file;
            return {
              type: EventTypeEnum.gotFile,
              value: m as EventTypeReturnType[EventTypeEnum.gotFile],
            };
          } else if ((m as Message.VoiceMessage).voice) {
            const file = (m as Message.VoiceMessage).voice;
            (m as EventTypeReturnType[EventTypeEnum.gotFile]).file = file;
            return {
              type: EventTypeEnum.gotFile,
              value: m as EventTypeReturnType[EventTypeEnum.gotFile],
            };
          } else if ((m as Message.VideoMessage).video) {
            const file = (m as Message.VideoMessage).video;
            (m as EventTypeReturnType[EventTypeEnum.gotFile]).file = file;
            return {
              type: EventTypeEnum.gotFile,
              value: m as EventTypeReturnType[EventTypeEnum.gotFile],
            };
          } else if ((m as Message.PhotoMessage).photo) {
            // we skip the other photos
            const file = (m as Message.PhotoMessage).photo[0];
            (m as EventTypeReturnType[EventTypeEnum.gotFile]).file = file;
            return {
              type: EventTypeEnum.gotFile,
              value: m as EventTypeReturnType[EventTypeEnum.gotFile],
            };
          } else if ((m as Message.AnimationMessage).animation) {
            const file = (m as Message.AnimationMessage).animation;
            (m as EventTypeReturnType[EventTypeEnum.gotFile]).file = file;
            return {
              type: EventTypeEnum.gotFile,
              value: m as EventTypeReturnType[EventTypeEnum.gotFile],
            };
          } else if ((m as Message.TextMessage).text) {
            return {
              type: EventTypeEnum.gotNewMessage,
              value: m as EventTypeReturnType[EventTypeEnum.gotNewMessage],
            };
          }
        } else if ((upd as Update.EditedMessageUpdate).edited_message) {
          const m = (upd as Update.EditedMessageUpdate).edited_message;
          if ((m as Message.TextMessage).text) {
            chatId = m.chat.id;
            return {
              type: EventTypeEnum.gotEditedMessage,
              value: m as EventTypeReturnType[EventTypeEnum.gotEditedMessage],
            };
          }
        }

        objectRecursiveSearch(upd, (key, obj) => {
          if (key === "chat") {
            chatId = obj[key].id;
            return true;
          }
          return false;
        });

        return {
          type: EventTypeEnum.gotUpdate,
          value: upd as EventTypeReturnType[EventTypeEnum.gotUpdate],
        };
      })();

      let isHandled = false;
      this.eventListeners.forEach((e) => {
        if (e.type === r.type || e.type === EventTypeEnum.gotUpdate) {
          const val = e.type === EventTypeEnum.gotUpdate ? upd : r.value;
          if (e.predicate(val, chatId)) {
            this.removeEvent(e.ref);
            e.resolve(val);
          }
        }
      });

      const ctx = r && chatId && this.tryGetContext(chatId);
      if (ctx) {
        if (r.type === EventTypeEnum.gotBotCommand) {
          ctx.cancel();
        } else {
          isHandled = ctx.fireEvent(r.type, r.value, upd) || isHandled;
        }
      }

      isHandled = (defFn && defFn()) || isHandled;

      if (!isHandled) {
        console.log(`TelegramService '${this.cfg.name}'. Got unhandled update\n`, upd);
      }
    } catch (err) {
      console.error(`TelegramService '${this.cfg.name}'. Error in gotUpdate\n`, err);
    }
  }

  gotBotCommand(msg: NewTextMessage, chat_id: number): boolean {
    const text = msg.text;
    let end: number | undefined = text.indexOf(" ", 1);
    if (end === -1) {
      end = undefined;
    }
    const textCmd = text.substring(0, end);
    const cmd = this.commands.find((c) => c.command === textCmd);
    if (cmd) {
      const user = Repo.getUser(msg.from.id);
      const allowCommand = !!user && !user.isInvalid && (!isValidationExpired(user) || process.env.DEBUG);
      // todo: bug don't allow private commands in groupChat
      // todo: bug allow group commands in groupChat for any user
      if (user && (allowCommand || (cmd.allowCommand && cmd.allowCommand()))) {
        this.core.deleteMessageForce({ chat_id, message_id: msg.message_id });

        const ctx = this.getContext(chat_id, msg, user);
        ctx.callCommand(cmd.callback);
      } else {
        process.env.DEBUG && console.log(`Decline command. User ${msg.from.id} is not registered or invalid`);
      }
      return true;
    } else if (textCmd === appSettings.ownerRegisterCmd && !Repo.hasAnyUser) {
      this.core.deleteMessageForce({ chat_id, message_id: msg.message_id });
      const newUser = new UserItem(msg.from.id, CheckBot.generateUserKey());

      const ctx = this.getContext(chat_id, msg, newUser);
      ctx.callCommand(registerUser);

      return true;
    }
    return false;
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

  eventListeners = new Map<Promise<EventTypeReturnType[EventTypeEnum]>, IEventListenerRoot<EventTypeEnum>>();

  onGotEvent<E extends EventTypeEnum>(
    type: E,
    predicate: EventPredicate<E>,
    timeout?: number
  ): Promise<EventTypeReturnType[E]> {
    let e: IEventListenerRoot<E> | undefined;

    const ref = new Promise<EventTypeReturnType[E]>((resolve, reject) => {
      let fn = predicate;
      if (timeout) {
        const timer = setTimeout(() => {
          this.removeEvent(ref);
          reject(
            Object.assign(new CancelledError(`Waiting is cancelled via timeout(${timeout})`), { isCancelled: true })
          );
        }, timeout);
        fn = (e, chatId) => {
          const ok = predicate(e, chatId);
          if (ok) {
            clearTimeout(timer);
          }
          return ok;
        };
      }
      e = { type, predicate: fn, resolve, reject } as IEventListenerRoot<E>;
    });
    if (e) {
      e.ref = ref;
      this.eventListeners.set(ref, e);
    }
    return ref;
  }

  removeEvent<E extends EventTypeEnum>(ref: Promise<EventTypeReturnType[E]>): void {
    this.eventListeners.delete(ref);
  }

  contexts: Record<number, IBotContext> = {};
  getContext(chatId: number, initMsg: NewTextMessage, user: UserItem): IBotContext {
    let ctx = this.contexts[chatId];
    if (!ctx) {
      ctx = new BotContext(chatId, initMsg, user, this);
      this.contexts[chatId] = ctx;
    }
    return ctx;
  }

  tryGetContext(chat_id: number): IBotContext | undefined {
    return this.contexts[chat_id];
  }

  removeContext(chat_id: number): void {
    delete this.contexts[chat_id];
  }
}

interface IEventListenerRoot<E extends EventTypeEnum> extends IEventListener<E> {
  // such typing is required otherwise TS can't match types properly
  predicate: <T extends EventTypeEnum>(e: EventTypeReturnType[T], chatId?: number) => boolean;
  ref: Promise<EventTypeReturnType[E]>;
}

export interface IEventListener<E extends EventTypeEnum> {
  type: E;
  // such typing is required otherwise TS can't match types properly
  resolve: <T extends EventTypeEnum>(value: EventTypeReturnType[T]) => void;
  reject: (reason: CancelledError) => void;
}

export class CancelledError extends Error {
  isCancelled = true;
}
