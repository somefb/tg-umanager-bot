import Repo from "../repo";
import { MyBotCommand } from "../types";
import { MyBotCommandTypes } from "./botCommandTypes";

const CommandClearDisableUntilHere: MyBotCommand = {
  command: "clear_disable_until_here",
  type: MyBotCommandTypes.group,
  isHidden: false,
  description: "добавить предыдущие сообщения в исключение (не будут удаляться)",
  callback: async (msg, service) => {
    const resMsg = await service.notify({
      chat_id: msg.chat.id,
      disable_notification: true,
      text: "Предыдущие сообщения не будут удаляться...",
    });

    await service.core.deleteMessageForce({ chat_id: msg.chat.id, message_id: msg.message_id });

    if (resMsg.ok) {
      const chat = Repo.getOrPushChat(msg.chat.id);
      resMsg.cancel();
      chat.lastDeleteIndex = resMsg.result.message_id + 1;
    }
  },
};

export default CommandClearDisableUntilHere;
