import { ApiResponse, CallbackQuery, Message, Update, User } from "typegram";
import BotContext from "./botContext";
import ErrorCancelled from "./errorCancelled";
import gotBotCommand from "./events/gotBotCommand";
import onMeAdded from "./events/onMeAdded";
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
  IEventListener,
  ITelegramService,
  MyBotCommand,
  NewTextMessage,
  TelegramListenOptions,
} from "./types";
import UserItem from "./userItem";

const services: TelegramService[] = [];

export default class TelegramService implements ITelegramService {
  core: TelegramCore;
  cfg: BotConfig;
  botUserName = "";
  botUserId = 0;

  get services(): TelegramService[] {
    return services;
  }

  constructor(botConfig: BotConfig) {
    services.push(this);
    this.cfg = botConfig;
    this.core = new TelegramCore(botConfig.token);

    this.assignCommands(botConfig.commands);

    // todo: bug if not successfull we should destroy such service!
    this.core.getMe().then((v) => {
      if (v.ok) {
        this.botUserName = v.result.username;
        this.botUserId = v.result.id;
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

  gotUpdate(upd: Update): void {
    //process.env.DEBUG && console.log("got update", v);
    try {
      let defFn: null | (() => boolean) = null;
      let chatId: number | undefined;

      const updateMember = (chatId: number, from: User, isAnonym: boolean | null | undefined) => {
        if (from) {
          Repo.getСhat(chatId)?.addOrUpdateMember(from, isAnonym);
          Repo.updateUser(from);
        }
      };

      const removeMember = (chatId: number, userId: number) => {
        Repo.getСhat(chatId)?.removeMember(userId);
      };

      const r = ((): { value: EventTypeReturnType[EventTypeEnum]; type: EventTypeEnum } => {
        if ((upd as Update.CallbackQueryUpdate).callback_query) {
          const q = (upd as Update.CallbackQueryUpdate).callback_query as CallbackQuery.DataCallbackQuery;
          chatId = q.message?.chat.id;
          chatId && updateMember(chatId, q.from, null);
          return {
            type: EventTypeEnum.gotCallbackQuery,
            value: q as EventTypeReturnType[EventTypeEnum.gotCallbackQuery],
          };
        }
        if ((upd as Update.MessageUpdate).message) {
          const m = (upd as Update.MessageUpdate).message;
          chatId = m.chat.id;
          updateMember(chatId, m.from, null);

          if ((m as Message.TextMessage).text?.startsWith("/")) {
            if (chatId) {
              const cid = chatId;
              defFn = () => gotBotCommand.call(this, m as NewTextMessage, cid);
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
            //WARN: we skip the other photos
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
          } else if ((m as Message.NewChatMembersMessage).new_chat_members) {
            const members = (m as Message.NewChatMembersMessage).new_chat_members;
            const cid = chatId;
            members.forEach((v) => updateMember(cid, v, false));

            const chat = Repo.getСhat(chatId);
            chat?.onChatMembersCountChanged?.call(chat, members.length);

            return {
              type: EventTypeEnum.addedChatMembers,
              value: m as EventTypeReturnType[EventTypeEnum.addedChatMembers],
            };
          }
        } else if ((upd as Update.EditedMessageUpdate).edited_message) {
          const m = (upd as Update.EditedMessageUpdate).edited_message;
          if ((m as Message.TextMessage).text) {
            chatId = m.chat.id;
            updateMember(chatId, m.from, null);
            return {
              type: EventTypeEnum.gotEditedMessage,
              value: m as EventTypeReturnType[EventTypeEnum.gotEditedMessage],
            };
          }
        } else if ((upd as Update.ChatMemberUpdate).chat_member || (upd as Update.MyChatMemberUpdate).my_chat_member) {
          // todo we can detect blocked/unblocked for private chat here
          const m = (upd as Update.MyChatMemberUpdate).my_chat_member || (upd as Update.ChatMemberUpdate).chat_member;
          chatId = m.chat.id;
          const mbot = m.new_chat_member;
          if (mbot.user.id === this.botUserId && mbot.status === "member") {
            const cid = chatId;
            defFn = () => {
              onMeAdded.call(this, m as EventTypeReturnType[EventTypeEnum.memberUpated], cid);
              return true;
            };
          } else {
            const isLeft = m.new_chat_member.status === "kicked" || m.new_chat_member.status === "left";
            if (isLeft) {
              removeMember(chatId, m.new_chat_member.user.id);
            } else {
              updateMember(chatId, mbot.user, m.new_chat_member.is_anonymous);
            }
          }
          return {
            type: EventTypeEnum.memberUpated,
            value: m as EventTypeReturnType[EventTypeEnum.memberUpated],
          };
        }

        !chatId &&
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
            isHandled = true;
          }
        }
      });

      const ctx = r && chatId && this.getContexts(chatId);
      isHandled = (ctx && ctx.forEach((c) => c.fireEvent(r.type, r.value, upd))) || isHandled;
      isHandled = (defFn && defFn()) || isHandled;

      if (!isHandled) {
        process.env.DEBUG && console.log(`TelegramService '${this.cfg.name}'. Got unhandled update\n`, upd);
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
        const port = (process.env.PORT_HTTPS && Number.parseInt(process.env.PORT_HTTPS, 10)) || 3000;
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

  commands: MyBotCommand[] = [];
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
            Object.assign(new ErrorCancelled(`Waiting is cancelled via timeout(${timeout})`), { isCancelled: true })
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

  removeEvent<E extends EventTypeEnum>(ref: Promise<EventTypeReturnType[E]>, needReject?: boolean): void {
    needReject && this.eventListeners.get(ref)?.reject(new ErrorCancelled("Cancelled by argument [needReject]"));
    this.eventListeners.delete(ref);
  }

  private contexts: Record<number, Set<IBotContext>> = {};
  removeContext(ctx: IBotContext): void {
    const arr = this.contexts[ctx.chatId];
    arr.delete(ctx);
    if (!arr.size) {
      delete this.contexts[ctx.chatId];
    }
  }

  getContexts(chat_id: number): Set<IBotContext> | undefined {
    return this.contexts[chat_id];
  }

  initContext(chatId: number, cmdName: string, initMsg: NewTextMessage | null, user: UserItem): IBotContext {
    const item = new BotContext(
      chatId,
      cmdName,
      initMsg || ({ message_id: 0, from: {} } as NewTextMessage),
      user,
      this
    );
    const arr = this.contexts[chatId];
    if (!arr) {
      this.contexts[chatId] = new Set();
    }
    this.contexts[chatId].add(item);
    return item;
  }
}

interface IEventListenerRoot<E extends EventTypeEnum> extends IEventListener<E> {
  // such typing is required otherwise TS can't match types properly
  predicate: <T extends EventTypeEnum>(e: EventTypeReturnType[T], chatId?: number) => boolean;
  ref: Promise<EventTypeReturnType[E]>;
}
