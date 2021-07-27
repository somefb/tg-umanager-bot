import { CommandRepeatBehavior, MyBotCommand } from "../types";
import { MyBotCommandTypes } from "./botCommandTypes";
import { getFinishInstructions } from "./registerUser";

const TestCmd: MyBotCommand = {
  command: "test",
  type: MyBotCommandTypes.common,
  isHidden: true,
  description: "test",
  repeatBehavior: CommandRepeatBehavior.skip,
  callback: async (ctx) => {
    await ctx.sendMessage({
      text: getFinishInstructions(),

      //reply_markup: { inline_keyboard: getInstructionsMarkup() },
    });
  },
};

export default TestCmd;
