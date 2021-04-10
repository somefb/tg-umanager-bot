import { CommandRepeatBehavior, MyBotCommand } from "../types";
import { MyBotCommandTypes } from "./botCommandTypes";

const CommandClear: MyBotCommand = {
  command: "clear",
  type: MyBotCommandTypes.common,
  isHidden: false,
  description: "удалить все возможные сообщения", // Possible restrictions: https://core.telegram.org/bots/api#deletemessage",
  repeatBehavior: CommandRepeatBehavior.skip,
  callback: async (ctx) => {
    const resMsg = await ctx.sendMessage(
      {
        disable_notification: true,
        text: "Удаляю...",
      },
      { removeMinTimeout: 3000 }
    );

    //await service.core.unpinAllChatMessages({ chat_id: msg.chat.id });
    for (let i = ctx.initMessageId - 1; i >= ctx.chat.lastDeleteIndex; --i) {
      await ctx.service.core.deleteMessageForce({ chat_id: ctx.chatId, message_id: i });
    }
    await ctx.deleteMessage(resMsg.message_id);

    ctx.chat.lastDeleteIndex = resMsg.message_id + 1;
  },
};

export default CommandClear;
