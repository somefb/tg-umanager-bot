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

export default class UserItem {
  static userToLink(user: UserItem): string {
    if (user.nickName) {
      return "@" + user.nickName;
    }
    return `<a href="tg://user?id=${user.id}">${[user.firstName, user.lastName].filter((v) => v).join(" ")}</a>`;
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
  nickName = "";
  firstName = "";
  lastName = "";
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
    return isValidationExpired(this) || !!process.env.DEBUG;
  }

  set isValid(v: boolean) {
    this._isValid = !v;
    this.validationDate = Date.now();
  }

  toLinkName(): string {
    return UserItem.userToLink(this);
  }

  constructor(id: number, validationKey: UserValidationKey) {
    this.id = id;
    this.validationKey = validationKey;
  }
}
