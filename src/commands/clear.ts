import Repo from "../repo";
import { MyBotCommand } from "../types";
import { MyBotCommandTypes } from "./botCommandTypes";

const CommandClear: MyBotCommand = {
  command: "clear",
  type: MyBotCommandTypes.group,
  isHidden: false,
  description: "удалить все возможные сообщения", // Possible restrictions: https://core.telegram.org/bots/api#deletemessage",
  callback: async (msg, service) => {
    const resMsg = await service.notify({
      chat_id: msg.chat.id,
      disable_notification: true,
      text: "Удаляю...",
    });

    const chat = Repo.getOrPushChat(msg.chat.id);

    try {
      //todo wrong if some message is excluded from deleting
      await service.core.unpinAllChatMessages({ chat_id: msg.chat.id });
      for (let i = msg.message_id - 1; i >= chat.lastDeleteIndex; --i) {
        await service.core.deleteMessageForce({ chat_id: msg.chat.id, message_id: i });
      }
    } catch (err) {
      console.error("BotCommand. Clear. Error during deleting messages\n", err);
    }

    if (resMsg.ok) {
      resMsg.cancel();
      chat.lastDeleteIndex = resMsg.result.message_id + 1;
    } else {
      chat.lastDeleteIndex = msg.message_id + 1;
    }
  },
};

export default CommandClear;
