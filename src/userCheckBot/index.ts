import ErrorCancelled from "../errorCancelled";
import { CommandRepeatBehavior, EventTypeEnum, ITelegramService, MyBotCommand } from "../types";
import UserItem from "../userItem";
import { generateUserKey } from "./dictionary";
import playValidation from "./playValidation";

const waitUserConnectMs = 60000; // 1 minute

export const CheckBot = {
  service: {} as ITelegramService,

  async validateUser(user: UserItem, allowPlayAgain = false): Promise<boolean | null> {
    try {
      if (user.isLocked) {
        console.warn(`User ${user.id} is locked. Validation is declined`);
        return false;
      }
      if (user.isValid && !allowPlayAgain) {
        return true;
      }

      // wait when user makes chat with CheckBot
      if (!user.checkBotChatId) {
        const e = await this.service.onGotEvent(
          EventTypeEnum.gotBotCommand,
          (e) => e.from.id === user.id,
          waitUserConnectMs
        );
        user.checkBotChatId = e.chat.id;
      }

      // todo detect stopBot
      const ctx = this.service.initContext(user.checkBotChatId, "_validate", null, user);
      const r = await ctx.callCommand((ctx) => playValidation(ctx));
      return r;
    } catch (err) {
      if (!(err as ErrorCancelled).isCancelled) {
        console.error(err);
        return null;
      }
    }
    return false;
  },
  generateUserKey,
};

const CheckBotCommands: MyBotCommand[] = [
  {
    command: "start",
    description: "Начать заново",
    isHidden: false,
    repeatBehavior: CommandRepeatBehavior.skip,
    allowCommand: (user) => !user?.isLocked,
    callback: (ctx) => CheckBot.validateUser(ctx.user, true),
    onServiceInit: (service) => {
      CheckBot.service = service;
    },
  } as MyBotCommand,
];
export default CheckBotCommands;
