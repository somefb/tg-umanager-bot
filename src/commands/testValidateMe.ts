import { MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import { MyBotCommandTypes } from "./botCommandTypes";

const TestValidateMe: MyBotCommand = {
  command: "test_validate_me",
  type: MyBotCommandTypes.personal,
  isHidden: true,
  description: "проверь меня",
  callback: async (ctx) => {
    const isValid = await CheckBot.validateUser(ctx.user);
    ctx.sendMessage({
      text: isValid ? "Проверка пройдена" : "Провалено",
    });
  },
};

export default TestValidateMe;
