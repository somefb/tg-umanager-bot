import { CommandRepeatBehavior, MyBotCommand } from "../types";
import { MyBotCommandTypes } from "./botCommandTypes";
import countAllTask from "./countAllTask";

const TestCmd: MyBotCommand = {
  command: "test",
  type: MyBotCommandTypes.common,
  isHidden: true,
  description: "проверь меня",
  repeatBehavior: CommandRepeatBehavior.skip,
  callback: async (ctx) => {
    countAllTask(ctx);
    await Promise.resolve();
  },
};

export default TestCmd;
