import { CancelledError } from "../telegramService";
import { EventTypeEnum, ITelegramService, MyBotCommand } from "../types";
import UserItem from "../userItem";
import { generateUserKey } from "./dictionary";
import playValidation from "./playValidation";

const waitUserMs = 60000; // 1 minute
const validationExpiry = 5 * 60 * 1000; // 5 minutes - period of time that user isValid after validation

export function isValidationExpired(user: UserItem, validationExpiryMs = validationExpiry): boolean {
  const dT = Date.now() - user.validationDate;
  if (dT < validationExpiryMs) {
    return false;
  }
  return true;
}

const myBotUserName = "";
export const CheckBot = {
  service: {} as ITelegramService,

  async validateUser(user: UserItem, validationExpiryMs = validationExpiry): Promise<boolean | null> {
    try {
      if (user.isLocked) {
        console.warn(`User ${user.id} is locked. Validation is declined`);
        return Promise.resolve(false);
      }
      if (!user.isInvalid && !isValidationExpired(user, validationExpiryMs)) {
        return Promise.resolve(true);
      }

      // wait when user makes chat with CheckBot
      if (!user.checkBotChatId) {
        const e = await this.service.onGotEvent(EventTypeEnum.gotBotCommand, (e) => e.from.id === user.id, waitUserMs);
        user.checkBotChatId = e.chat.id;
      }

      // todo detect stopBot
      const ctx = this.service.getContext(user.checkBotChatId, null, user);
      const r = await ctx.callCommand(playValidation);
      return r;
    } catch (err) {
      if (!(err as CancelledError).isCancelled) {
        console.error(err);
        return null;
      }
    }
    return false;
  },
  generateUserKey,
};

// todo use answerCallbackQuery: https://core.telegram.org/bots/api#answercallbackquery
const CheckBotCommands: MyBotCommand[] = [
  {
    command: "start",
    description: "Начать заново",
    isHidden: false,
    //allowCommand: () => true,
    // todo: bug user can reset session with this command and try to do anything many times
    callback: (ctx) => CheckBot.validateUser(ctx.user),
    onServiceInit: (service) => {
      CheckBot.service = service;
    },
  } as MyBotCommand,
  // todo add command stop
];
export default CheckBotCommands;
