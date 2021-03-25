/* eslint-disable @typescript-eslint/ban-ts-comment */
import { FileInfo } from "./types";
import { UserValidationKey } from "./userCheckBot/dictionary";

// const t: FileInfo = {
//   // we can't compare by file_id
//   file_id: "",
//   file_unique_id: "",
//   file_name: "",
//   file_size: 0,
//   mime_type: "",
//   duration: 0,
//   width: 0,
//   height: 0,
// };

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
  sharedUserId = 0;

  validationVoiceFile?: FileInfo;
  validationFile?: FileInfo;
  validationKey: UserValidationKey;
  /** Date in ms when the last validation is done/failed */
  validationDate = 0;
  isInvalid = true;
  /** True when number of unsuccessful attempts of validation is over  */
  isLocked = false;
  /** Personal chat id with checkbot */
  checkBotChatId = 0;
  /** Personal chat id with termyKickBot */
  termyBotChatId = 0;

  toLinkName(): string {
    return UserItem.userToLink(this);
  }

  constructor(id: number, validationKey: UserValidationKey) {
    this.id = id;
    this.validationKey = validationKey;
  }
}
