import Repo from "../repo";
import { ITelegramService, MyBotCommand } from "../types";
import UserItem from "../userItem";
import { generateUserKey } from "./dictionary";
import validate from "./validate";

export const CheckBot = {
  service: null as ITelegramService | null,
  // todo maybe detect expiry start from lastUserActivity ???

  validateUser: (user: UserItem, validationExpiryMs = 5 * 60 * 1000): Promise<boolean | undefined> => {
    if (user.isLocked) {
      return Promise.resolve(false);
    }
    if (!user.isInvalid) {
      const dT = Date.now() - user.validationDate;
      if (dT < validationExpiryMs) {
        return Promise.resolve(true);
      }
    }
    return validate(user, CheckBot.service as ITelegramService);
  },
  generateUserKey,
};

// todo use answerCallbackQuery: https://core.telegram.org/bots/api#answercallbackquery
const CheckBotCommands: MyBotCommand[] = [
  {
    command: "start",
    description: "Начать заново",
    callback: async (msg, service) => {
      // todo remove previous if restart
      // todo don't allow to add bot to chat: use event onBotAddedToChat
      const user = Repo.getUser(msg.from?.id);
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
