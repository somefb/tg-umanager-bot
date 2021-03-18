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
  callback: async (msg, service, user) => {
    const chat_id = msg.chat.id;
    //todo remove all commands automatically
    await service.core.deleteMessageForce({ chat_id, message_id: msg.message_id });

    if (user) {
      const isValid = await CheckBot.validateUser(user);
      service.core.sendMessage({
        chat_id,
        text: isValid ? "Проверка пройдена" : "Провалено",
      });
    }
  },
};

export default ValidateMe;
