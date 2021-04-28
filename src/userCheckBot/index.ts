import ErrorCancelled from "../errorCancelled";
import Repo from "../repo";
import { CommandRepeatBehavior, IBotContext, ITelegramService, MyBotCommand } from "../types";
import UserItem from "../userItem";
import { generateUserKey } from "./dictionary";
import playValidation from "./playValidation";

export const CheckBot = {
  service: {} as ITelegramService,

  async validateUser(user: UserItem): Promise<boolean | null> {
    try {
      if (user.isLocked) {
        console.warn(`User ${user.id} is locked. Validation is declined`);
        return false;
      }

      // possible when others calls validateUser();
      const c = this.service.getContexts(user.checkBotChatId);
      if (c) {
        const ctx = c.values().next().value as IBotContext;
        await ctx.onCancelled();
      } else {
        const cmd = CheckBotCommands[0];
        const ctx = this.service.initContext(user.checkBotChatId, cmd.command, null, user);
        await ctx.callCommand(cmd.callback);
      }
      return user._isValid;
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
    onServiceInit: (service) => {
      CheckBot.service = service;
    },
    callback: async (ctx) => {
      await playValidation(ctx);
      ctx.onCancelled().finally(() => Repo.commit());
    },
  } as MyBotCommand,
  {
    command: "go",
    description: "Начать",
    isHidden: true,
    repeatBehavior: CommandRepeatBehavior.skip,
    allowCommand: (user) => !user?.isLocked,
    callback: async (ctx) => {
      await playValidation(ctx, true);
      ctx.onCancelled().finally(() => Repo.commit());
    },
  } as MyBotCommand,
];
export default CheckBotCommands;
