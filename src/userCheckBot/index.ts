import Repo from "../repo";
import { ITelegramService, MyBotCommand } from "../types";
import UserItem from "../userItem";
import { generateUserKey } from "./dictionary";
import validate from "./validate";

let myBotUserName = "";
export const CheckBot = {
  service: {} as ITelegramService,
  // todo maybe detect expiry start from lastUserActivity ???

  validateUser(user: UserItem, validationExpiryMs = 5 * 60 * 1000): Promise<boolean | undefined> {
    if (user.isLocked) {
      return Promise.resolve(false);
    }
    if (!user.isInvalid) {
      const dT = Date.now() - user.validationDate;
      if (dT < validationExpiryMs) {
        return Promise.resolve(true);
      }
    }
    return validate(user, this.service as ITelegramService);
  },
  generateUserKey,

  async getMyUserName(): Promise<string> {
    if (myBotUserName) {
      return Promise.resolve(myBotUserName);
    } else {
      const r = await this.service.core.getMe();
      myBotUserName = (r.ok && r.result.username) || myBotUserName;
      return myBotUserName;
    }
  },
};

// todo use answerCallbackQuery: https://core.telegram.org/bots/api#answercallbackquery
const CheckBotCommands: MyBotCommand[] = [
  {
    command: "start",
    description: "Начать заново",
    callback: async (msg, service) => {
      // todo remove previous if restart
      // todo don't allow to add bot to chat: use event onBotAddedToChat
      const user =
        Repo.getUser(msg.from?.id) ||
        ({ id: 1, validationKey: { num: 1, word: "волк" }, checkBotChatId: msg.chat.id } as UserItem);

      if (!user) {
        await service.core.sendMessage({
          chat_id: msg.chat.id,
          text: "Упс, похоже я поломался",
        });
        // todo we can't remove private chat and should notify users about this
        // await service.core.leaveChat({ chat_id: msg.chat.id });
      } else {
        await validate(user, service);
      }
    },
    onServiceInit: (service) => {
      CheckBot.service = service;
    },
  } as MyBotCommand,
];
export default CheckBotCommands;
