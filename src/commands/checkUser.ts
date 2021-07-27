import { CommandRepeatBehavior, MyBotCommand } from "../types";
import { MyBotCommandTypes } from "./botCommandTypes";
import { reportValidation } from "./check";

const CommandCheckUser: MyBotCommand = {
  command: "check_user",
  type: MyBotCommandTypes.common,
  isHidden: true,
  description: "проверить пользователя",
  repeatBehavior: CommandRepeatBehavior.none,
  callback: async (ctx) => {
    ctx.removeAllByCancel = true;
    ctx.singleMessageMode = true;
    ctx.disableNotification = true;
    ctx.singleUserMode = true;

    const targetMember = await ctx.askForUser("Кого проверяем?", true);
    await reportValidation(ctx, [targetMember], false);
  },
};

export default CommandCheckUser;
