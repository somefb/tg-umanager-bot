import { ApiSuccess, Message, Update } from "typegram";
import ChatItem from "./chatItem";
import processNow from "./helpers/processNow";
import Repo from "./repo";
import { CancelledError, IEventListener } from "./telegramService";
import {
  EventTypeEnum,
  EventTypeReturnType,
  IBotContext,
  IBotContextMsgOptions,
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
    this._timer = setTimeout(() => {
      this.cancel();
    }, ms);
  }

  cancel(): void {
    this.service.removeContext(this.chatId);
    this._timer && clearTimeout(this._timer);
    //todo everything inside context must be in try catch
    const err = new CancelledError("Context is cancelled");
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

  async sendMessage(
    args: Omit<Opts<"sendMessage">, "chat_id">,
    opts?: IBotContextMsgOptions
  ): Promise<Message.TextMessage> {
    (args as Opts<"sendMessage">).chat_id = this.chatId;
    const res = (await this.service.core.sendMessage(args as Opts<"sendMessage">)) as ApiSuccess<Message.TextMessage>;
    const data = res.result;

    //this.needRemoveMessages.add(res.result.message_id);

    if (opts) {
      let timer: NodeJS.Timeout | undefined = undefined;
      const delMsg = () => {
        timer && clearTimeout(timer);
        this.deleteMessage(data.message_id);
      };

      if (opts.removeTimeout) {
        // todo check bind this
        timer = setTimeout(delMsg, opts.removeTimeout);
      }

      if (this.removeAnyByUpdate || opts.removeByUpdate) {
        // todo check bind this
        this.onGotEvent(EventTypeEnum.gotUpdate).finally(delMsg);
      }

      if (opts.removeMinTimeout) {
        const deleteTime = processNow() + opts.removeMinTimeout;
        this.deleteSet.set(res.result.message_id, deleteTime);
      }
    }
    return data as Message.TextMessage;
  }

  eventListeners = new Map<Promise<EventTypeReturnType[EventTypeEnum]>, IEventListener<EventTypeEnum>>();

  onGotEvent<E extends EventTypeEnum>(type: E): Promise<EventTypeReturnType[E]> {
    const ref = new Promise<EventTypeReturnType[E]>((resolve, reject) => {
      this.eventListeners.set(ref, { type, resolve, reject } as IEventListener<E>);
    });

    return ref;
  }

  removeEvent<E extends EventTypeEnum>(ref: Promise<EventTypeReturnType[E]>): void {
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

  async callCommand<T extends IBotContext, U>(fn: (ctx: T) => Promise<U>): Promise<U | null> {
    let r: U | null = null;
    try {
      r = await fn((this as unknown) as T);
    } catch (err) {
      if ((err as CancelledError).isCancelled) {
        return null;
      } else {
        console.error(err);
      }
    }

    this.cancel();
    return r;
  }
}
