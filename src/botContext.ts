import { ApiError, ApiSuccess, Message, MessageEntity, Update, User } from "typegram";
import ChatItem, { MyChatMember } from "./chatItem";
import ErrorCancelled from "./errorCancelled";
import processNow from "./helpers/processNow";
import Repo from "./repo";
import {
  EventTypeEnum,
  EventTypeReturnType,
  IBotContext,
  IBotContextMsgOptions,
  IEventListener,
  ITelegramService,
  NewCallbackQuery,
  NewTextMessage,
  Opts,
} from "./types";
import UserItem, { IUser, searchByName } from "./userItem";

/**
 * Default rules:
 * default timeout 5 minutes
 */
export default class BotContext implements IBotContext {
  static defSessionTimeout = 5 * 60000;
  static defSessionTimeoutStr = "5 минут";

  readonly chatId: number;
  readonly initMessageId: number;
  readonly initMessage: NewTextMessage;
  readonly user: UserItem;
  readonly service: ITelegramService;

  removeAllByCancel = false;
  singleMessageMode = false;
  singleUserMode = false;
  disableNotification = false;
  name: string;

  constructor(chatId: number, cmdName: string, initMessage: NewTextMessage, user: UserItem, service: ITelegramService) {
    this.chatId = chatId;
    this.initMessageId = initMessage.message_id;
    this.initMessage = initMessage;
    this.user = user;
    this.service = service;
    this.name = cmdName;
    this.setTimeout();
  }

  get chat(): ChatItem {
    return Repo.getOrPushChat(this.chatId);
  }

  get botUserName(): string {
    return this.service.botUserName;
  }

  get userLink(): string {
    return ChatItem.isAnonymGroupBot(this.initMessage.from) ? "<b>анонимный админ</b>" : this.user.toLink();
  }

  _timer?: NodeJS.Timeout;
  setTimeout(ms = BotContext.defSessionTimeout): void {
    this._timer && clearTimeout(this._timer);
    if (ms) {
      this._timer = setTimeout(() => {
        this._cancel("timeout " + ms, true);
      }, ms);
    }
  }

  cancelObj?: ErrorCancelled;
  private _cancel(reason: string, isTimeout = false): void {
    let lastMessage;
    if (!this.removeAllByCancel && this.singleMessageMode) {
      lastMessage = this._updateMessage;
    }
    if (this._updateMessage && !this.messages.get(this._updateMessage.id)?.keepAfterSession) {
      delete this._updateMessage;
    }
    this.service.removeContext(this);
    this._timer && clearTimeout(this._timer);

    (async () => {
      if (this.removeAllByCancel) {
        for (const msg of this.messages.values()) {
          if (!msg.keepAfterSession) {
            await this.deleteMessage(msg.id);
          }
        }
      }
    })();

    // requires for cases when we need to update latest message by cancelled context
    if (lastMessage) {
      this._updateMessage = lastMessage;
    }

    const logMsg = `Context '${this.name || ""}' is cancelled. Reason: ${reason}`;
    global.DEBUG && console.log(logMsg);
    const err = new ErrorCancelled(logMsg);
    err.isTimeout = isTimeout;
    this.cancelObj = err;
    this.eventListeners.forEach((e) => e.reject(err));

    this.onCancelledListeners?.forEach((resolve) => resolve());
  }

  cancel(reason: string): void {
    this._cancel(reason, false);
  }

  async deleteMessage(id: number): Promise<void> {
    if (this._updateMessage?.id === id) {
      delete this._updateMessage;
      //ignore this because message can be removed by timeout
      //console.warn(`Context '${this.name || ""}'. Removed message that shoud be updated`);
    }

    const msg = this.messages.get(id);
    if (msg) {
      this.messages.delete(id);
      msg.reset.forEach((fn) => fn());
      if (msg.expiryTime) {
        const waitMs = msg.expiryTime - processNow();
        if (waitMs > 0) {
          setTimeout(() => {
            this.service.core.deleteMessage({ chat_id: this.chatId, message_id: id });
          }, waitMs);
          return Promise.resolve();
        }
      }
    }
    await this.service.core.deleteMessage({ chat_id: this.chatId, message_id: id });
  }

  private _updateMessage?: { id: number; data: Message.TextMessage };
  /** history with messages that was sent */
  private messages = new Map<number, MsgHistoryItem>();
  async sendMessage(
    args: Omit<Opts<"sendMessage">, "chat_id">,
    opts?: IBotContextMsgOptions
  ): Promise<Message.TextMessage> {
    (args as Opts<"sendMessage">).chat_id = this.chatId;
    if (this.disableNotification && args.disable_notification == null) {
      args.disable_notification = this.disableNotification;
    }

    let data: Message.TextMessage | undefined;

    if (this.singleMessageMode && this._updateMessage) {
      //reset previous timers and events because we need to apply new
      this.messages.get(this._updateMessage.id)?.reset.forEach((fn) => fn());
      (args as Opts<"editMessageText">).message_id = this._updateMessage.id;
      data = this._updateMessage.data;
      try {
        await this.service.core.editMessageText(args as Opts<"editMessageText">);
        if (!this._updateMessage) {
          console.error(
            `Context '${this.name}' is cancelled but sendMessage() is not finished. You missed await for async function`,
            args.text
          );
        }
      } catch (error) {
        const err = error as ApiError;
        // possible when user can message by mistake
        if (err.error_code === 400) {
          // description: 'Bad Request: message to edit not found',
          if (err.description.includes("not found")) {
            delete this._updateMessage;
          }
        }
      }
    }

    if (!this.singleMessageMode || !this._updateMessage) {
      const res = await this.service.core.sendMessage(args as Opts<"sendMessage">);
      data = (res as ApiSuccess<Message.TextMessage>).result;
      if (this.singleMessageMode) {
        this._updateMessage = { id: data.message_id, data };
      }
    } else {
      // case impossible but requires for TS
      data = this._updateMessage.data;
    }

    const msgHist: MsgHistoryItem = {
      id: data.message_id,
      reset: [],
      keepAfterSession: opts?.keepAfterSession,
    };
    this.messages.set(msgHist.id, msgHist);

    if (opts) {
      const delMsg = () => data && this.deleteMessage(data.message_id);

      if (opts.removeTimeout) {
        const timer = setTimeout(delMsg, opts.removeTimeout);
        msgHist.reset.push(() => clearTimeout(timer));
      }

      if (opts.removeByUpdate) {
        let eventRef: Promise<Update> | undefined;
        if (opts.keepAfterSession) {
          const cid = this.chatId;
          eventRef = this.service.onGotEvent(EventTypeEnum.gotUpdate, (_u, chatId) => chatId === cid);
          const ref = eventRef;
          msgHist.reset.push(() => this.service.removeEvent(ref));
        } else {
          // WARN: for singleMessageMode send-without-removeByUpdate doesn't cancel previous send-with-removeByUpdate
          eventRef = this.onGotEvent(EventTypeEnum.gotUpdate);
          const ref = eventRef;
          msgHist.reset.push(() => this.removeEvent(ref));
        }
        eventRef.then(delMsg).catch((v) => v);
      }

      if (opts.removeMinTimeout) {
        msgHist.expiryTime = processNow() + opts.removeMinTimeout;
      }
    }
    return data as Message.TextMessage;
  }

  eventListeners = new Map<Promise<EventTypeReturnType[EventTypeEnum]>, IEventListener<EventTypeEnum>>();

  onGotEvent<E extends EventTypeEnum>(type: E): Promise<EventTypeReturnType[E]> {
    let e: IEventListener<E> | undefined;
    const ref = new Promise<EventTypeReturnType[E]>((resolve, reject) => {
      e = { type, resolve, reject } as IEventListener<E>;
    });
    // undefined required for avoiding TS-bug
    e && this.eventListeners.set(ref, e);

    return ref;
  }

  removeEvent<E extends EventTypeEnum>(ref: Promise<EventTypeReturnType[E]>, needReject?: boolean): void {
    needReject && this.eventListeners.get(ref)?.reject(new ErrorCancelled("Cancelled by argument [needReject]"));
    this.eventListeners.delete(ref);
  }

  fireEvent<E extends EventTypeEnum>(
    type: E | null,
    v: EventTypeReturnType[E],
    u: Update,
    from: User | undefined
  ): boolean {
    let isHandled = false;
    let wasNotified = false;

    this.eventListeners.forEach(async (e, ref) => {
      if (e.type == type || e.type === EventTypeEnum.gotUpdate) {
        isHandled = true;

        // prevents interaction other users with command
        if (
          this.chat.isGroup &&
          this.singleUserMode &&
          type !== EventTypeEnum.addedChatMembers &&
          type !== EventTypeEnum.memberUpated &&
          type !== EventTypeEnum.addedChatMembers &&
          (await this.isSameUser(from, wasNotified))
        ) {
          wasNotified = true;
          return;
        }

        this.removeEvent(ref);
        if (e.type === EventTypeEnum.gotUpdate) {
          e.resolve(u);
        } else {
          e.resolve(v);
        }
      }
    });
    return isHandled;
  }

  async isSameUser(from: User | undefined, notify: boolean): Promise<boolean> {
    let isSame = !!(
      from &&
      from.id !== this.initMessage.from.id &&
      !(this.chat.members[from.id]?.isAnonym && ChatItem.isAnonymGroupBot(this.initMessage.from))
    );

    if (isSame && from) {
      if (ChatItem.isAnonymGroupBot(this.initMessage.from)) {
        const r = await this.service.core.getChatAdministrators({ chat_id: this.chatId });
        if (r.ok) {
          r.result.forEach((admin) => {
            const isMe = admin.user.is_bot && admin.user.username === this.botUserName;
            !isMe && this.chat.addOrUpdateMember(admin.user, admin.is_anonymous);
          });
          const isAnonym = r.result.some((admin) => admin.user.id === from.id && admin.is_anonymous);
          isSame = isAnonym;
        }
      }
    }

    if (isSame && notify) {
      const was = this.singleMessageMode;
      this.singleMessageMode = false;
      await this.sendMessage(
        { text: "Жду ответа от того, кто вызвал команду..." },
        { removeTimeout: 5000 } //
      );
      this.singleMessageMode = was;
    }

    return isSame;
  }

  getListener<E extends EventTypeEnum>(ref: Promise<EventTypeReturnType[E]>): IEventListener<E> | undefined {
    return this.eventListeners.get(ref) as IEventListener<E>;
  }

  async callCommand<T extends IBotContext, U>(fn: (ctx: T) => Promise<U>): Promise<U | null> {
    let r: U | null = null;
    try {
      r = await fn((this as unknown) as T);
    } catch (err) {
      if ((err as ErrorCancelled).isCancelled) {
        return null;
      } else {
        console.error(err);
      }
    }

    this.cancel("end");
    return r;
  }

  onCancelledListeners?: Array<() => void>;
  onCancelled(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.onCancelledListeners) {
        this.onCancelledListeners = [];
      }
      this.onCancelledListeners.push(resolve);
    });
  }

  private _askMsgId?: number;
  async askForUser(text: string, onlyRegistered?: boolean, note?: string): Promise<UserItem>;
  async askForUser(text: string, onlyRegistered?: boolean, note?: string): Promise<UserItem | MyChatMember> {
    if (!this._askMsgId) {
      const arrText = [`${text} Укажите имя/@никнейм пользователя`];
      if (note) {
        arrText.push("\n" + note);
      } else if (this.chat.isGroup) {
        arrText.push("\nДля указания анонимных администраторов используйте функцию телеграмма 'ответить на сообщение'");
      }
      const msg = await this.sendMessage({
        text: arrText.join("\n"),
        reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: this.getCallbackCancel() }]] },
      });
      this._askMsgId = msg.message_id;
    }

    let found: UserItem | MyChatMember | null = null;

    while (!found) {
      const msg = await this.onGotEvent(EventTypeEnum.gotNewMessage);
      let mention = "";

      const entity = msg.entities?.find((v) => v.type === "mention" || v.type === "text_mention");
      if (entity?.offset === 0 && entity.length === msg.text.length) {
        await this.deleteMessage(msg.message_id);
        const mUser = (entity as MessageEntity.TextMentionMessageEntity).user;
        if (mUser) {
          found = ChatItem.userToMember(mUser, false);
        } else {
          mention = msg.text.substring(entity.offset, entity.length);
        }
      } else if (!this.chat.isGroup || msg.reply_to_message?.message_id === this._askMsgId) {
        await this.deleteMessage(msg.message_id);
        mention = msg.text;
      }

      if (!found && !mention) {
        continue;
      }

      let reportText = "";

      if (!found) {
        if (mention.startsWith("@") && mention === "@" + this.botUserName) {
          reportText = "Вы не можете указать на меня";
        } else if (this.chat.isGroup) {
          found = searchByName(this.chat.members, mention);
        }
        if (!found) {
          found = searchByName(Repo.users, mention);
        }
      }

      if (!reportText) {
        if (!found) {
          reportText = "Пользователь не найден/не зарегистрирован";
          console.warn("Can't define user from mention", JSON.stringify(entity));
        } else if (found.id === this.initMessage.from.id || found.id === this.user.termyBotChatId) {
          reportText = "Вы не можете указать на себя или меня...";
          found = null;
        }
      }

      if (found && onlyRegistered) {
        const user = Repo.getUser(found.id);
        if (!user) {
          reportText = `${UserItem.ToLinkUser(found)} не зарегистрирован`;
          found = null;
        } else {
          found = user;
        }
      }

      if (reportText) {
        const was = this.singleMessageMode;
        this.singleMessageMode = false;
        await this.sendMessage({ text: reportText }, { removeTimeout: 5000 });
        this.singleMessageMode = was;
      }
    }

    return found;
  }

  private callbackData?: string;
  getCallbackCancel(callback?: () => Promise<unknown> | void): string {
    if (!this.callbackData) {
      this.callbackData = "_bc" + getNextUniqueId().toString();
      const applyEvent = () => {
        this.onGotEvent(EventTypeEnum.gotCallbackQuery)
          .then((e) => {
            if (e.data === this.callbackData) {
              this.callbackData = undefined;
              if (callback) {
                callback();
              } else {
                this.cancel("user cancelled");
              }
            } else {
              applyEvent();
            }
          })
          .catch((v) => v);
      };
      applyEvent();
    }
    return this.callbackData;
  }

  async sendAndWait(
    args: Omit<Opts<"sendMessage">, "chat_id"> & Required<Pick<Opts<"sendMessage">, "reply_markup">>,
    opts?: IBotContextMsgOptions
  ): Promise<NewCallbackQuery> {
    const msg = await this.sendMessage(args, opts);
    let q: NewCallbackQuery | null = null;
    const wasCancel = this.cancelObj;
    while (!q) {
      q = await this.onGotEvent(EventTypeEnum.gotCallbackQuery);
      if (q.message?.message_id !== msg.message_id) {
        q = null;
      }
    }
    // if ctx isCancelled we need reject it (case when cancelEvent and thisEvent fires in a row)
    if (wasCancel !== this.cancelObj) {
      throw this.cancelObj;
    }
    return q;
  }

  async clearChat(fromMessageId: number): Promise<void> {
    const endIndex = this.chat.lastDeleteIndex || 1;
    for (let i = fromMessageId; i >= endIndex; --i) {
      await this.service.core.deleteMessageForce({ chat_id: this.chatId, message_id: i });
    }

    this.chat.lastDeleteIndex = fromMessageId + 1;
  }

  async kickUser(user: IUser, note?: string): Promise<void> {
    try {
      await this.service.core.kickChatMember({
        chat_id: this.chatId,
        user_id: user.id,
        revoke_messages: true,
      });

      // some mistake in tg: ,"error_code":400,"description":"Bad Request: method is available for supergroup and channel chats only"
      try {
        await this.service.core.unbanChatMember({
          chat_id: this.chatId,
          user_id: user.id,
          only_if_banned: true,
        });
      } catch {}

      this.chat.removeMember(user.id, true);

      await this.sendMessage(
        { text: `${this.userLink} удалил ${UserItem.ToLinkUser(user)}${note ? ". " + note : ""}` },
        { keepAfterSession: true }
      );

      (async () => {
        const ref = this.service.onGotEvent(
          EventTypeEnum.removedChatMember,
          (e, chatId) => chatId === this.chatId && e.left_chat_member.id === user.id
        );
        const t = setTimeout(() => this.service.removeEvent(ref, true), 60000);
        try {
          const msg = await ref;
          clearTimeout(t);
          await this.service.core.deleteMessage({ chat_id: this.chatId, message_id: msg.message_id });
        } catch (error) {}
      })();
    } catch (err) {
      if (!err.error_code) {
        console.error(err);
      }
      await this.sendMessage(
        { text: `Не могу удалить ${UserItem.ToLinkUser(user)}. Вероятно недостаточно прав` },
        { keepAfterSession: true }
      );
    }
  }
}

interface MsgHistoryItem {
  id: number;
  reset: Array<() => void>;
  /** time when we can remove message (setted via opts.removeMinTimeout) */
  expiryTime?: number;
  keepAfterSession?: boolean;
}

let _uid = 0;
function getNextUniqueId(): number {
  //we can reduce number via checking service contexts
  return ++_uid;
}
