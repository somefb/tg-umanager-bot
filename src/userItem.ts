/* eslint-disable @typescript-eslint/ban-ts-comment */
import { FileInfo } from "./types";
import { UserValidationKey } from "./userCheckBot/dictionary";

export const validationExpiry = 5 * 60 * 1000; // 5 minutes - period of time that user isValid after validation

function isValidationExpired(user: UserItem, validationExpiryMs = validationExpiry): boolean {
  const dT = Date.now() - user.validationDate;
  if (dT < validationExpiryMs) {
    return false;
  }
  return true;
}

export interface IUser {
  id: number;
  firstName: string;
  lastName?: string;
  userName?: string;
}

export default class UserItem implements IUser {
  static ToLinkUser(user: IUser): string {
    return this.ToLink(user.id, user.userName, user.firstName, user.lastName);
  }

  static ToLink(userId: number, userName: string | undefined, firstName: string, lastName: string | undefined): string {
    if (userName) {
      return "@" + userName;
    }
    return `<a href="tg://user?id=${userId}">${[firstName, lastName].filter((v) => v).join(" ")}</a>`;
  }

  static isFilesEqual(a: FileInfo, b: FileInfo): boolean {
    const someDifferent = Object.keys(a).some((key: string | keyof typeof a) => {
      if (key === "file_id" || key === "file_name" || key === "thumb") {
        //we can't compare by file_id and lets skip fileName
        return false;
      }
      // @ts-ignore
      if (a[key] !== b[key]) {
        // @ts-ignore
        console.log(`File validation is wrong. a.${key} (${a[key]}) !== b.${key} (${b[key]})`);
      }
      return;
    });
    return !someDifferent;
  }

  id: number;
  firstName = "";
  lastName?: string;
  userName?: string;
  whoSharedUserId = 0;

  validationVoiceFile?: FileInfo;
  validationFile?: FileInfo;
  validationKey: UserValidationKey;

  /** True when number of unsuccessful attempts of validation is over  */
  isLocked = false;
  /** Personal chat id with checkbot */
  checkBotChatId = 0;
  /** Personal chat id with termyKickBot */
  termyBotChatId = 0;

  private _isValid = true;
  /** Date in ms when the last validation is done/failed */
  validationDate = 0;

  get isValid(): boolean {
    if (!this._isValid) {
      return false;
    }
    if (process.env.DEV) {
      return this.validationDate !== 0;
    }
    return !isValidationExpired(this);
  }

  set isValid(v: boolean) {
    this._isValid = v;
    this.validationDate = Date.now();
  }

  toLink(): string {
    return UserItem.ToLinkUser(this);
  }

  constructor(id: number, validationKey: UserValidationKey) {
    this.id = id;
    this.validationKey = validationKey;
  }
}
