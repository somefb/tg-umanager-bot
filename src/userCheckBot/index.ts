import ErrorCancelled from "../errorCancelled";
import Repo from "../repo";
import { CommandRepeatBehavior, IBotContext, ITelegramService, MyBotCommand } from "../types";
import UserItem from "../userItem";
import { generateUserKey } from "./dictionary";
import playValidation from "./playValidation";

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

      const c = this.service.getContexts(user.checkBotChatId);
      // possible when others calls validateUser();
      if (c) {
        const ctx = c.values().next().value as IBotContext;
        // skip circural ctx detection when fired from previous context
        if (!ctx.name.includes(CheckBotCommands[0].command)) {
          await ctx.onCancelled();
          return user.isValid;
        }
      }
      // todo detect stopBot
      const ctx = this.service.initContext(user.checkBotChatId, "_validate", null, user);
      const r = await ctx.callCommand((ctx) => playValidation(ctx));
      Repo.commit();
      return r;
    } catch (err) {
      if (!(err as ErrorCancelled).isCancelled) {
        console.error(err);
        return null;
      }
    }
    Repo.commit();
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
