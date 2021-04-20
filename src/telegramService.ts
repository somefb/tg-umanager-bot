import BotContext from "./botContext";
import ErrorCancelled from "./errorCancelled";
import gotUpdate from "./events/gotUpdate";
import onExit from "./onExit";
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

    this.core.getMe().then((v) => {
      if (v.ok) {
        this.botUserName = v.result.username;
        this.botUserId = v.result.id;
      }
    });
  }

  updateOffset?: number;
  async getUpdates(): Promise<void> {
    try {
      process.env.DEBUG &&
        // console.warn(
        //   `The script uses approximately ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`
        // );
        process.stdout.write(".");

      const v = await this.core.getUpdates({ offset: this.updateOffset });

      if (v && v.ok && v.result.length) {
        this.updateOffset = v.result[v.result.length - 1].update_id + 1;
        v.result.forEach((r) => {
          gotUpdate.call(this, r);
        });
      }
    } catch (err) {
      process.env.DEBUG && process.stdout.write("\n");
      console.log(`TelegramService '${this.cfg.name}'. Error in getUpdates()\n` + err);
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

      const listenFn = () => this.getUpdates().finally(() => (si = setTimeout(listenFn, options.interval)));
      await listenFn();
    } else {
      console.log(`TelegramService '${this.cfg.name}'. Setting up webhook logic`);

      try {
        await this.core.setWebhook({ url: options.ownDomainURL, certificate: options.certPath });
        const port = (process.env.PORT_HTTPS && Number.parseInt(process.env.PORT_HTTPS, 10)) || 3000;
        this.core.listenWebhook(port, (v) => gotUpdate.call(this, v));
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

  contexts: Record<number, Set<IBotContext>> = {};
  removeContext(ctx: IBotContext): void {
    const arr = this.contexts[ctx.chatId];
    if (arr) {
      arr.delete(ctx);
      if (!arr.size) {
        delete this.contexts[ctx.chatId];
      }
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
