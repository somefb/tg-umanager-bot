import { ApiError, ApiResponse, ApiSuccess, BotCommand, Message, Typegram, Update } from "typegram";
import { Document, Audio, PhotoSize, Video, Voice, Animation } from "typegram/message";
import { MyBotCommandTypes } from "./commands/botCommandTypes";
import UserItem from "./userItem";

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
  | "getMe"
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
  chat_id: number | undefined;
}

export interface NewTextMessage extends Update.MessageUpdate, Update.AbstractMessageUpdate {
  message: Update.New & Update.NonChannel & Message.TextMessage;
}

export type EventCancellation = (callback: () => void) => void;
export type EventPredicate<T extends Update> = (e: T, chatId?: number) => boolean;
export type EventPredicateOrChatId<T extends Update> = number | string | EventPredicate<T> | null | undefined;
export type OnGotEvent<T extends Update> = (
  predicateOrChatId: EventPredicateOrChatId<T>,
  cancellationOrTimeout?: EventCancellation | number
) => Promise<ServiceEvent<T>>;

type MessageFile =
  | Message.DocumentMessage
  | Message.AudioMessage
  | Message.VoiceMessage
  | Message.VideoMessage
  | Message.PhotoMessage
  | Message.AnimationMessage;
export type FileInfo = Document | Audio | Voice | Video | PhotoSize | Animation;

export interface NewFileMessage extends Update.MessageUpdate, Update.AbstractMessageUpdate {
  message: Update.New & Update.NonChannel & MessageFile;
  file: FileInfo;
}

export interface ITelegramService {
  core: ITelegramCore;
  cfg: BotConfig;
  /** sendMessage for at least 3 seconds and remove message by cancel() trigger */
  notify(args: Opts<"sendMessage">, minNotifyMs?: number): Promise<ApiError | NotifyMessage>;
  /** sendMessage that will be deleted by timeout or by userResponse (whatever happens faster) */
  sendSelfDestroyed(args: Opts<"sendMessage">, deleteTimeoutSec: number): Promise<ApiResponse<Message.TextMessage>>;

  onGotUpdate: OnGotEvent<Update>;
  onGotCallbackQuery: OnGotEvent<Update.CallbackQueryUpdate>;
  onGotFile: OnGotEvent<NewFileMessage>;
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
  callback: (msg: Message.TextMessage, service: ITelegramService, user?: UserItem) => void | Promise<void>;
  onServiceInit?: (service: ITelegramService) => void;
  /** Command that is hidden from unregistered or invalid users */
  isHidden: boolean;
  allowCommand?: () => boolean;
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
