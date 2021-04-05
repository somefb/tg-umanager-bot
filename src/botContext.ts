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

  removeAnyByUpdate = false;
  singleMessageMode = false;

  constructor(chatId: number, initMessage: NewTextMessage, user: UserItem, service: ITelegramService) {
    this.chatId = chatId;
    this.initMessageId = initMessage.message_id;
    this.initMessage = initMessage;
    this.user = user;
    this.service = service;
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
        this.cancel();
      }, ms);
    }
  }

  cancel(): void {
    this._updateMessageId = 0;
    this.service.removeContext(this.chatId);
    this._timer && clearTimeout(this._timer);
    const err = new ErrorCancelled("Context is cancelled");
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

  deleteSet = new Map<number, number>();
  deleteMessage(id: number): Promise<void> {
    if (this._updateMessageId === id) {
      this._updateMessageId = 0;
      console.warn("Removed message that shoud be updated");
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

  private _updateMessageId = 0;
  private _updateMessageData: Message.TextMessage | undefined;
  async sendMessage(
    args: Omit<Opts<"sendMessage">, "chat_id">,
    opts?: IBotContextMsgOptions
  ): Promise<Message.TextMessage> {
    (args as Opts<"sendMessage">).chat_id = this.chatId;

    let data: Message.TextMessage;

    if (this.singleMessageMode && this._updateMessageId) {
      (args as Opts<"editMessageText">).message_id = this._updateMessageId;
      //WARN: editMessage returns text-result but we don't need one
      // todo: user can remove message by mistake. We need to create sendNew instead. Need to handle apiError
      await this.service.core.editMessageText(args as Opts<"editMessageText">);
      data = this._updateMessageData as Message.TextMessage;
    } else {
      const res = await this.service.core.sendMessage(args as Opts<"sendMessage">);
      data = (res as ApiSuccess<Message.TextMessage>).result;
      if (this.singleMessageMode) {
        this._updateMessageId = data.message_id;
        this._updateMessageData = data;
      }
    }

    //this.needRemoveMessages.add(res.result.message_id);

    if (opts) {
      let timer: NodeJS.Timeout | undefined;
      let delEvent: undefined | (() => void);
      const delMsg = () => {
        timer && clearTimeout(timer);
        delEvent && delEvent();
        this.deleteMessage(data.message_id);
      };

      if (opts.removeTimeout) {
        timer = setTimeout(delMsg, opts.removeTimeout);
      }

      if (this.removeAnyByUpdate || opts.removeByUpdate) {
        let eventRef: Promise<Update> | undefined;
        if (opts.keepAfterSession) {
          const cid = this.chatId;
          eventRef = this.service.onGotEvent(EventTypeEnum.gotUpdate, (_u, chatId) => chatId === cid);
          const ref = eventRef;
          delEvent = () => this.service.removeEvent(ref);
        } else {
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

    this.cancel();
    return r;
  }
}
