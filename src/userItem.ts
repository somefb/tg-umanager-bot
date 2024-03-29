/* eslint-disable @typescript-eslint/ban-ts-comment */
import { FileInfo } from "./types";
import { UserValidationKey } from "./userCheckBot/dictionary";

export const validationExpiryStr = "5мин";
export const validationExpiry = 5 * 60000; // 5 minutes - period of time that user isValid after validation

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
  static ToLinkUser(user: IUser, isAnonym = false): string {
    return this.ToLink(user.id, user.userName, user.firstName, user.lastName, isAnonym);
  }

  static ToLink(
    userId: number,
    userName: string | undefined,
    firstName: string,
    lastName: string | undefined,
    isAnonym = false
  ): string {
    if (isAnonym) {
      const ln = lastName || firstName;
      // filtering for emoji because it costs 2...8 chars
      const firstLetter = firstName.codePointAt(0) === firstName.charCodeAt(0) ? firstName[0] : "?";
      let lastLetter = "";
      if (ln.length > 2 && ln.codePointAt(ln.length - 2) == ln.charCodeAt(ln.length - 2)) {
        lastLetter = ln[ln.length - 1];
      }
      return `анон.админ (${firstLetter}..${lastLetter})`;
    }
    if (!userId && userName) {
      return "@" + userName;
    }
    return `<a href="tg://user?id=${userId}">${[firstName, lastName].filter((v) => v).join(" ")}</a>`;
  }

  static isFilesEqual(a: FileInfo, b: FileInfo): boolean {
    if (a.file_unique_id === b.file_unique_id) {
      return true;
    }

    for (const key in a) {
      if (key === "file_id" || key === "file_name" || key === "thumb" || key === "file_unique_id") {
        //we can't compare by file_id and lets skip fileName
        continue;
      }

      // @ts-ignore
      if (a[key] !== b[key]) {
        // @ts-ignore
        console.log(`File validation is wrong. a.${key} (${a[key]}) !== b.${key} (${b[key]})`);
        return false;
      }
    }

    return true;
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
  isCheckBotChatBlocked?: true;

  _isValid = true;
  /** Date in ms when the last validation is done/failed */
  validationDate = 0;
  validationFileDate = 0;
  /** Time when need to checkUser in minutes from 00:00 */
  validationScheduledTime = 21 * 60; // default is 21:00
  validationNextDate = 0;

  /** Is use has english mode for game */
  isGameModeEnglish?: boolean;

  declinedChats = new Set<number>();

  get isValid(): boolean {
    if (!this._isValid) {
      return false;
    }
    // if (global.DEV) {
    //   return this.validationDate !== 0;
    // }
    return !isValidationExpired(this);
  }

  set isValid(v: boolean) {
    this._isValid = v;
    this.validationDate = Date.now();
  }

  toLink(isAnonym = false): string {
    return UserItem.ToLinkUser(this, isAnonym);
  }

  constructor(id: number, validationKey: UserValidationKey) {
    this.id = id;
    this.validationKey = validationKey;
  }
}

export function searchByName<T extends IUser>(arrSet: Record<number, T>, searchText: string): T | null {
  let predicate: (user: T) => boolean;
  if (searchText.startsWith("@")) {
    searchText = searchText.replace("@", "");
    predicate = (user: T) => user.userName === searchText;
  } else {
    predicate = (u: T) => `${u.firstName}${u.lastName ? " " + u.lastName : ""}` === searchText;
  }

  for (const id in arrSet) {
    if (predicate(arrSet[id])) {
      return arrSet[id];
    }
  }

  return null;
}
