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

  removeAllByCancel = false;
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

    const logMsg = `Context '${this.name || ""}' is cancelled. Reason: ${reason}`;
    process.env.DEBUG && console.log(logMsg);
    const err = new ErrorCancelled(logMsg);
    this.eventListeners.forEach((e) => e.reject(err));

    this.onCancelledListeners?.forEach((resolve) => resolve());
  }

  deleteMessage(id: number): Promise<void> {
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
            this.service.core.deleteMessageForce({ chat_id: this.chatId, message_id: id });
          }, waitMs);
          return Promise.resolve();
        }
      }
    }
    return this.service.core.deleteMessageForce({ chat_id: this.chatId, message_id: id });
  }

  private _updateMessage?: { id: number; data: Message.TextMessage };
  /** history with messages that was sent */
  private messages = new Map<number, MsgHistoryItem>();
  async sendMessage(
    args: Omit<Opts<"sendMessage">, "chat_id">,
    opts?: IBotContextMsgOptions
  ): Promise<Message.TextMessage> {
    (args as Opts<"sendMessage">).chat_id = this.chatId;

    let data: Message.TextMessage;

    if (this.singleMessageMode && this._updateMessage) {
      //reset previous timers and events because we need to apply new
      this.messages.get(this._updateMessage.id)?.reset.forEach((fn) => fn());
      (args as Opts<"editMessageText">).message_id = this._updateMessage.id;
      // WARN: user can remove message by mistake and we can't detect id
      data = this._updateMessage.data;
      await this.service.core.editMessageText(args as Opts<"editMessageText">);
      if (!this._updateMessage) {
        console.error(
          `Context '${this.name}' is cancelled but sendMessage() is not finished. You missed await for async function`,
          args.text
        );
      }
    } else {
      const res = await this.service.core.sendMessage(args as Opts<"sendMessage">);
      data = (res as ApiSuccess<Message.TextMessage>).result;
      if (this.singleMessageMode) {
        this._updateMessage = { id: data.message_id, data };
      }
    }

    const msgHist: MsgHistoryItem = {
      id: data.message_id,
      reset: [],
      keepAfterSession: opts?.keepAfterSession,
    };
    this.messages.set(msgHist.id, msgHist);

    if (opts) {
      const delMsg = () => this.deleteMessage(data.message_id);

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

  onCancelledListeners?: Array<() => void>;
  onCancelled(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.onCancelledListeners) {
        this.onCancelledListeners = [];
      }
      this.onCancelledListeners.push(resolve);
    });
  }
}

interface MsgHistoryItem {
  id: number;
  reset: Array<() => void>;
  /** time when we can remove message (setted via opts.removeMinTimeout) */
  expiryTime?: number;
  keepAfterSession?: boolean;
}
