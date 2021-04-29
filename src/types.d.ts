import { BotCommand, CallbackQuery, ChatMemberUpdated, Message, Typegram, Update, User } from "typegram";
import { Animation, Audio, Document, PhotoSize, Video, Voice } from "typegram/message";
import ChatItem from "./chatItem";
import { MyBotCommandTypes } from "./commands/botCommandTypes";
import ErrorCancelled from "./errorCancelled";
import UserItem, { IUser } from "./userItem";

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
  | "sendVoice"
  | "deleteMessage"
  | "setWebhook"
  | "getWebhookInfo"
  | "deleteWebhook"
  | "leaveChat"
  | "editMessageText"
  | "getChatAdministrators"
  | "getChatMembersCount"
  | "answerCallbackQuery"
  | "kickChatMember"
  | "unbanChatMember"
  | "createChatInviteLink"
> & {
  //
  deleteMessageForce(args: Opts<"deleteMessage">): Promise<void>;
};

export type NewTextMessage = Update.New & Update.NonChannel & Message.TextMessage;
export type EditedTextMessage = Update.Edited & Update.NonChannel & Message.TextMessage;
export type NewCallbackQuery = (CallbackQuery.DataCallbackQuery | CallbackQuery.GameShortGameCallbackQuery) & {
  data?: string;
};

type MessageFile =
  | Message.DocumentMessage
  | Message.AudioMessage
  | Message.VoiceMessage
  | Message.VideoMessage
  | Message.PhotoMessage
  | Message.AnimationMessage;
export type FileInfo = Document | Audio | Voice | Video | PhotoSize | Animation;

export type NewFileMessage = Update.New &
  Update.NonChannel &
  MessageFile & {
    file: FileInfo;
  };

export type EventPredicate<E extends EventTypeEnum> = (e: EventTypeReturnType[E], chatId?: number) => boolean;

export interface ITelegramService {
  botUserName: string;
  core: ITelegramCore;
  cfg: BotConfig;

  onGotEvent<E extends EventTypeEnum>(
    type: E,
    predicate: EventPredicate<E>,
    timeout?: number
  ): Promise<EventTypeReturnType[E]>;

  removeEvent<E extends EventTypeEnum>(ref: Promise<EventTypeReturnType[E]>, needReject?: boolean): void;

  initContext(chatId: number, cmdName: string | null, initMsg: NewTextMessage | null, user: UserItem): IBotContext;
  getContexts(chat_id: number): Set<IBotContext> | undefined;
  removeContext(ctx: IBotContext): void;
}

export interface TelegramListenOptions {
  /** How often request updates (in ms) */
  interval: number;
  //  * @param {number} interval - How often request updates (in ms)
  //  * @param {string} certificateKeyPath - Point certificateKey for using setWebhook logic: https://core.telegram.org/bots/api#setwebhook
  //  * @param {string} callbackURL - DomainURL that recevies webHook messages

  ownDomainURL?: string;
  /** Point certificateKeyPath for using setWebhook logic: https://core.telegram.org/bots/api#setwebhook */
  keyPath?: string;
  /** Point certificatePath for using setWebhook logic: https://core.telegram.org/bots/api#setwebhook */
  certPath?: string;
}

type valueof<T> = T[keyof T];

export const enum CommandRepeatBehavior {
  none = 0,
  /** ignore new command if any previous in progress*/
  skip = 1,
  /** cancel previous same command and start new */
  restart,
  /** show confirm message so user makes decision Cancel/Continue */
  //confirmation
}

export type MyBotCommand = BotCommand & {
  type?: valueof<typeof MyBotCommandTypes[]>;
  callback: (context: IBotContext) => Promise<unknown>;
  onServiceInit?: (service: ITelegramService) => void;
  /** Command that is hidden from unregistered or invalid users */
  isHidden: boolean;
  allowCommand?: (user: UserItem | undefined) => boolean;
  repeatBehavior: CommandRepeatBehavior;
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

/** Session context that exists per chat and fired from any command */
export interface IBotContext {
  //cmdName that initialized context
  name: string;
  /** Chat that session assigned to */
  readonly chatId: number;
  readonly chat: ChatItem;
  /** Message that initilaized context */
  readonly initMessageId: number;
  readonly initMessage: NewTextMessage;
  readonly botUserName: string;
  /** WARN: user can be with zero values when msg.from = anonym for groupCommands */
  readonly user: UserItem;
  readonly userLink: string;
  readonly service: ITelegramService;

  /** remove all messages that's sent via context except option 'keepAfterSession' */
  removeAllByCancel: boolean;
  /** every next sendMessage will update existed */
  singleMessageMode: boolean;
  /** sends the message silently. Users will receive a notification with no sound. */
  disableNotification: boolean;
  /** command works only for who called it in group chat  */
  singleUserMode: boolean;

  /**
   * set timeout; after expiring session will be cancelled automatically
   * set 0 if you need to disable timeout
   */
  setTimeout(ms?: number): void;
  /** method cancelled session and removes any listeners inside */
  cancel(reason: string): void;
  onCancelled: () => Promise<void>;
  /** returns unique callback_data: string that user can click for cancelling  */
  getCallbackCancel: () => string;
  /** use this method to call context-dependant function properly */
  callCommand<T extends IBotContext, U>(fn: (ctx: T) => Promise<U>): Promise<U | null>;

  sendMessage(args: Omit<Opts<"sendMessage">, "chat_id">, opts?: IBotContextMsgOptions): Promise<Message.TextMessage>;
  /** sendMessage and wait for callbackQuery related to this message */
  sendAndWait(
    args: Omit<Opts<"sendMessage">, "chat_id"> & Required<Pick<Opts<"sendMessage">, "reply_markup">>,
    opts?: IBotContextMsgOptions
  ): Promise<NewCallbackQuery>;
  deleteMessage(id: number): Promise<void>;
  askForUser(text: string, onlyRegistered?: false, note?: string): Promise<UserItem | IUser>;
  askForUser(text: string, onlyRegistered: true, note?: string): Promise<UserItem>;

  onGotEvent<E extends EventTypeEnum>(type: E): Promise<EventTypeReturnType[E]>;
  removeEvent<E extends EventTypeEnum>(ref: Promise<EventTypeReturnType[E]>, needReject?: boolean): void;
  fireEvent<E extends EventTypeEnum>(
    type: E | null,
    v: EventTypeReturnType[E],
    u: Update,
    from: User | undefined
  ): boolean;
  getListener<E extends EventTypeEnum>(ref: Promise<EventTypeReturnType[E]>): IEventListener<E> | undefined;
}

export interface IEventListener<E extends EventTypeEnum> {
  type: E;
  // such typing is required otherwise TS can't match types properly
  resolve: <T extends EventTypeEnum>(value: EventTypeReturnType[T]) => void;
  reject: (reason: ErrorCancelled) => void;
}

export type IBotContextMsgOptions = Partial<{
  /** Don't remove message after botSession is cancelled */
  keepAfterSession: boolean;
  /** Removing message by any user-activity */
  removeByUpdate: boolean;
  /** After pointed time message will be removed */
  removeTimeout: number;
  /** Min time that's must expired for able to remove message */
  removeMinTimeout: number;
}>;

export const enum EventTypeEnum {
  gotUpdate = 0,
  /** such binary possible to combine but need to implement in the IBotSession */
  gotBotCommand = 0b10, // 1 << 1,
  gotCallbackQuery = 0b100, // 1<< 2,
  gotNewMessage = 0b1000, // 1 << 3,
  gotEditedMessage = 0b10000, // 1 << 4,
  gotFile = 0b100000, //1 << 5,
  /** A chat member's status was updated in a chat. The bot must be an administrator in the chat and must explicitly specify “chat_member” in the list of allowed_updates to receive these updates. */
  memberUpated = 0b1000000, //1 << 6,
  addedChatMembers = 0b10000000, //1 << 7,
}

interface EventTypeReturnType {
  [EventTypeEnum.gotUpdate]: Update;
  [EventTypeEnum.gotCallbackQuery]: NewCallbackQuery;
  [EventTypeEnum.gotNewMessage]: NewTextMessage;
  [EventTypeEnum.gotEditedMessage]: EditedTextMessage;
  [EventTypeEnum.gotBotCommand]: NewTextMessage;
  [EventTypeEnum.gotFile]: NewFileMessage;
  /** happens when user/bot permissions are updated (or user added/removed) in the chat */
  [EventTypeEnum.memberUpated]: ChatMemberUpdated;
  [EventTypeEnum.addedChatMembers]: Message.NewChatMembersMessage;
}
//type KeyForTypeEnum<T extends EventTypeEnum> = EventTypeReturnType[T];
