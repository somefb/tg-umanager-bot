import { UserValidationKey } from "./userCheckBot/dictionary";

export default class UserItem {
  id: number;
  validationKey: UserValidationKey;
  /** Date in ms when the last validation is done */
  validationDate = 0;
  isInvalid = true;
  /** True when number of unsuccessful attempts of validation is over  */
  isLocked = false;
  /** Personal chat id with checkbot */
  checkBotChatId: string | number = 0;

  constructor(id: number, validationKey: UserValidationKey) {
    this.id = id;
    this.validationKey = validationKey;
  }
}
