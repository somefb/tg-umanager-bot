import { MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import { MyBotCommandTypes } from "./botCommandTypes";

// todo this is test command - remove after tests
// todo this is command doesn't work when user isInvalid
const ValidateMe: MyBotCommand = {
  command: "validate_me",
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

export default ValidateMe;
