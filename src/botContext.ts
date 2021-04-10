import { ApiSuccess, Message, Update } from "typegram";
import ChatItem from "./chatItem";
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
  NewTextMessage,
  Opts,
} from "./types";
import UserItem from "./userItem";

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

  singleMessageMode = false;
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

  _timer?: NodeJS.Timeout;
  setTimeout(ms = BotContext.defSessionTimeout): void {
    this._timer && clearTimeout(this._timer);
    if (ms) {
      this._timer = setTimeout(() => {
        this.cancel("timeout " + ms);
      }, ms);
    }
  }

  cancel(reason: string): void {
    //todo we need also remove timeout and event for such
    delete this._updateMessage;
    this.service.removeContext(this);
    this._timer && clearTimeout(this._timer);
    const logMsg = `Context '${this.name || ""}' is cancelled. Reason: ${reason}`;
    process.env.DEBUG && console.log(logMsg);
    const err = new ErrorCancelled(logMsg);
    this.eventListeners.forEach((e) => e.reject(err));

    //todo clear all by cancel (in private chat)
    //todo clear bot messages by cancel (in group chat)

    // const delAll = async () => {
    //   for (const id of this.needRemoveMessages) {
    //     await this.deleteMessage(id);
    //   }
    // };
    // delAll();
  }
  //needRemoveMessages = new Set<number>();

  /* set of messages with removeMinTimeout */
  deleteSet = new Map<number, number>();
  deleteMessage(id: number): Promise<void> {
    //todo we need also remove event and timeout for such messages that can be removed manually
    if (this._updateMessage?.id === id) {
      delete this._updateMessage;
      console.warn(`Context '${this.name || ""}'. Removed message that shoud be updated`);
    }

    const expiryTime = this.deleteSet.get(id);
    if (expiryTime) {
      this.deleteSet.delete(id);

      const waitMs = expiryTime - processNow();
      if (waitMs > 0) {
        setTimeout(() => {
          this.service.core.deleteMessageForce({ chat_id: this.chatId, message_id: id });
        }, waitMs);
        return Promise.resolve();
      }
    }
    return this.service.core.deleteMessageForce({ chat_id: this.chatId, message_id: id });
  }

  private _updateMessage?: { id: number; data: Message.TextMessage; timer?: NodeJS.Timeout };
  async sendMessage(
    args: Omit<Opts<"sendMessage">, "chat_id">,
    opts?: IBotContextMsgOptions
  ): Promise<Message.TextMessage> {
    (args as Opts<"sendMessage">).chat_id = this.chatId;

    let data: Message.TextMessage;

    if (this.singleMessageMode && this._updateMessage) {
      (args as Opts<"editMessageText">).message_id = this._updateMessage.id;
      // WARN: user can remove message by mistake and we can't detect id
      await this.service.core.editMessageText(args as Opts<"editMessageText">);
      data = this._updateMessage.data as Message.TextMessage;
    } else {
      const res = await this.service.core.sendMessage(args as Opts<"sendMessage">);
      data = (res as ApiSuccess<Message.TextMessage>).result;
      if (this.singleMessageMode) {
        this._updateMessage = { id: data.message_id, data: data };
      }
    }

    //this.needRemoveMessages.add(res.result.message_id);

    if (opts) {
      let timer: NodeJS.Timeout | undefined;
      let delEvent: undefined | (() => void);
      const delMsg = () => {
        timer && clearTimeout(timer);
        delEvent && delEvent();
        if (data.message_id === this._updateMessage?.id) {
          delete this._updateMessage;
        }
        this.deleteMessage(data.message_id);
      };

      if (opts.removeTimeout) {
        timer = setTimeout(delMsg, opts.removeTimeout);
        if (this.singleMessageMode && this._updateMessage) {
          this._updateMessage.timer && clearTimeout(this._updateMessage.timer);
          this._updateMessage.timer = timer;
        }
      }

      if (opts.removeByUpdate) {
        let eventRef: Promise<Update> | undefined;
        if (opts.keepAfterSession) {
          const cid = this.chatId;
          eventRef = this.service.onGotEvent(EventTypeEnum.gotUpdate, (_u, chatId) => chatId === cid);
          const ref = eventRef;
          delEvent = () => this.service.removeEvent(ref);
        } else {
          // WARN: for singleMessageMode send-without-removeByUpdate doesn't cancel previous send-with-removeByUpdate
          eventRef = this.onGotEvent(EventTypeEnum.gotUpdate);
          const ref = eventRef;
          delEvent = () => this.removeEvent(ref);
        }
        eventRef.then(delMsg).catch((v) => v);
      }

      if (opts.removeMinTimeout) {
        const deleteTime = processNow() + opts.removeMinTimeout;
        this.deleteSet.set(data.message_id, deleteTime);
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

  fireEvent<E extends EventTypeEnum>(type: E | null, v: EventTypeReturnType[E], u: Update): boolean {
    let isHandled = false;
    this.eventListeners.forEach((e, ref) => {
      if (e.type == type || e.type === EventTypeEnum.gotUpdate) {
        isHandled = true;
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

  _onCancelled?: () => void;
  set onCancelled(v: undefined | (() => void)) {
    if (v && this._onCancelled) {
      console.error("BotContext.onCancelled has not multiple listeners");
    }
    this._onCancelled = v;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  get onCancelled() {
    return this._onCancelled;
  }
}
