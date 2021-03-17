import { ITelegramService, MyBotCommand } from "../types";
import UserItem from "../userItem";
import { generateUserKey } from "./dictionary";
import validate from "./validate";

const waitUserMs = 60000; // 1 minute
const validationExpiry = 5 * 60 * 1000; // 5 minutes - period of time that user isValid after validation
//users who wait for registration
const waitableUsers: Record<string | number, (v: false | number | string) => void> = {};

let myBotUserName = "";
export const CheckBot = {
  service: {} as ITelegramService,

  async validateUser(user: UserItem, validationExpiryMs = validationExpiry): Promise<boolean | null> {
    if (user.isLocked) {
      return Promise.resolve(false);
    }
    if (!user.isInvalid) {
      const dT = Date.now() - user.validationDate;
      if (dT < validationExpiryMs) {
        return Promise.resolve(true);
      }
    }

    // wait when user makes chat with CheckBot
    if (!user.checkBotChatId) {
      const uid = user.id;

      const wait = setTimeout(() => {
        waitableUsers[uid] && waitableUsers[uid](false);
        console.warn(`User ${uid} registration & validation failed. Chat connection timeout is expired`);
      }, waitUserMs);

      const chatId = await new Promise<false | number | string>((resolve) => {
        waitableUsers[uid] = resolve;
      });
      delete waitableUsers[uid];
      clearTimeout(wait);
      if (!chatId) {
        return null;
      } else {
        user.checkBotChatId = chatId;
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

// todo detect stopBot
// todo use answerCallbackQuery: https://core.telegram.org/bots/api#answercallbackquery
const CheckBotCommands: MyBotCommand[] = [
  {
    command: "start",
    description: "Начать заново",
    isHidden: false,
    allowCommand: () => true,
    callback: async (msg, service, user) => {
      // todo remove previous if restart
      // todo don't allow to add bot to chat: use event onBotAddedToChat
      if (!user) {
        if (msg.from?.id) {
          const resolve = waitableUsers[msg.from?.id];
          if (resolve) {
            resolve(msg.chat.id);
            return;
          }
        }
        await service.core.sendMessage({
          chat_id: msg.chat.id,
          text: "Превышено допустимое кол-во участников",
        });
      } else {
        await CheckBot.validateUser(user);
      }
    },
    onServiceInit: (service) => {
      CheckBot.service = service;
    },
  } as MyBotCommand,
];
export default CheckBotCommands;
