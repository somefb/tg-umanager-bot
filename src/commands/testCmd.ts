import { CommandRepeatBehavior, MyBotCommand } from "../types";
import { MyBotCommandTypes } from "./botCommandTypes";
import { getInstructionsMarkup, getInstructionsText } from "./registerUser";

const TestCmd: MyBotCommand = {
  command: "test",
  type: MyBotCommandTypes.common,
  isHidden: true,
  description: "test",
  repeatBehavior: CommandRepeatBehavior.skip,
  callback: async (ctx) => {
    await ctx.sendMessage({
      text: getInstructionsText(ctx.botUserName),
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: getInstructionsMarkup() },
    });
  },
};

export default TestCmd;
