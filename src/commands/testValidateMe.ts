import { CommandRepeatBehavior, MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import { MyBotCommandTypes } from "./botCommandTypes";

const TestValidateMe: MyBotCommand = {
  command: "test",
  type: MyBotCommandTypes.personal,
  isHidden: true,
  description: "проверь меня",
  repeatBehavior: CommandRepeatBehavior.skip,
  callback: async (ctx) => {
    // ctx.sendMessage({
    //   text: "test",
    //   reply_markup: { inline_keyboard: [[{ text: "share me", switch_inline_query: "regMe" }]] },
    // });
    // return;
    ctx.singleMessageMode = true;
    ctx.removeAllByCancel = true;

    const isValid = await CheckBot.validateUser(ctx.user);
    await ctx.sendMessage(
      {
        text: isValid ? "Проверка пройдена" : "Провалено",
      },
      { removeByUpdate: true, keepAfterSession: true }
    );
  },
};

export default TestValidateMe;
