import { ApiError, ApiSuccess, BotCommand, Message, Typegram, Update } from "typegram";
import { MyBotCommandTypes } from "./commands/botCommandTypes";

/** This object represents the contents of a file to be uploaded. Must be posted using multipart/form-data in the usual way that files are uploaded via the browser. */
export type InputFile = { path: string };

type DefaultTypegram = Typegram<InputFile | string>;

/** Wrapper type to bundle all methods of the Telegram API */
type Telegram = DefaultTypegram["Telegram"];

/** Utility type providing the argument type for the given method name or `{}` if the method does not take any parameters */
export type Opts<M extends keyof Telegram> = DefaultTypegram["Opts"][M];

/** This object represents the content of a media message to be sent. It should be one of
- InputMediaAnimation
- InputMediaDocument
- InputMediaAudio
- InputMediaPhoto
- InputMediaVideo */
export type InputMedia = DefaultTypegram["InputMedia"];
/** Represents a photo to be sent. */
export type InputMediaPhoto = DefaultTypegram["InputMediaPhoto"];
/** Represents a video to be sent. */
export type InputMediaVideo = DefaultTypegram["InputMediaVideo"];
/** Represents an animation file (GIF or H.264/MPEG-4 AVC video without sound) to be sent. */
export type InputMediaAnimation = DefaultTypegram["InputMediaAnimation"];
/** Represents an audio file to be treated as music to be sent. */
export type InputMediaAudio = DefaultTypegram["InputMediaAudio"];
/** Represents a general file to be sent. */
export type InputMediaDocument = DefaultTypegram["InputMediaDocument"];

export type ITelegramCore = Pick<
  DefaultTypegram["TelegramPR"],
  | "unpinAllChatMessages"
  | "getUpdates"
  | "setMyCommands"
  | "sendMessage"
  | "deleteMessage"
  | "setWebhook"
  | "getWebhookInfo"
  | "deleteWebhook"
  | "leaveChat"
  | "editMessageText"
> & {
  //
  deleteMessageForce(args: Opts<"deleteMessage">): Promise<void>;
};

export interface NotifyMessage extends ApiSuccess<Message.TextMessage> {
  cancel: () => Promise<void>;
}

export type ServiceEventCallback<T> = (event: ServiceEvent<T>) => void;

export interface ServiceEvent<T> {
  preventDefault: () => void;
  result: T;
}

export interface NewTextMessage extends Update.MessageUpdate, Update.AbstractMessageUpdate {
  message: Update.New & Update.NonChannel & Message.TextMessage;
}

export interface ITelegramService {
  core: ITelegramCore;
  cfg: BotConfig;
  /** sendMessage for at least 3 seconds and remove message by cancel() trigger */
  notify(args: Opts<"sendMessage">, minNotifyMs?: number): Promise<ApiError | NotifyMessage>;

  onGotCallbackQuery(
    predicate: (e: Update.CallbackQueryUpdate) => boolean
  ): Promise<ServiceEvent<Update.CallbackQueryUpdate>>;
}

export interface TelegramListenOptions {
  /** How often request updates (in ms) */
  interval: number;
  //    * @param {number} interval - How often request updates (in ms)
  //  * @param {string} certificateKeyPath - Point certificateKey for using setWebhook logic: https://core.telegram.org/bots/api#setwebhook
  //  * @param {string} callbackURL - DomainURL that recevies webHook messages

  ownDomainURL?: string;
  /** Point certificateKeyPath for using setWebhook logic: https://core.telegram.org/bots/api#setwebhook */
  keyPath?: string;
  /** Point certificatePath for using setWebhook logic: https://core.telegram.org/bots/api#setwebhook */
  certPath?: string;
}

type valueof<T> = T[keyof T];

export type MyBotCommand = BotCommand & {
  type?: valueof<typeof MyBotCommandTypes[]>;
  callback: (msg: Message.TextMessage, service: ITelegramService) => void;
};

export interface BotConfig {
  name: string;
  token: string;
  commands: MyBotCommand[];
}

export interface IRepository {
  get<T>(pathName: string): Promise<T | null>;
  save<T>(pathNam: string, item: T): Promise<void>;
}
