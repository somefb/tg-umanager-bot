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
  static isFilesEqual(a: FileInfo, b: FileInfo): boolean {
    //todo we can't work with PhotoSize[] !!!
    // @ts-ignore
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

  validationFile?: FileInfo;
  validationKey: UserValidationKey;
  /** Date in ms when the last validation is done */
  validationDate = 0;
  isInvalid = true;
  /** True when number of unsuccessful attempts of validation is over  */
  isLocked = false;
  /** Personal chat id with checkbot */
  checkBotChatId: string | number = 0;
  /** Personal chat id with termyKickBot */
  termyBotChatId: string | number = 0;

  constructor(id: number, validationKey: UserValidationKey) {
    this.id = id;
    this.validationKey = validationKey;
  }
}
