import { CommandRepeatBehavior, MyBotCommand } from "../types";
import { MyBotCommandTypes } from "./botCommandTypes";

const CommandClearDisableHere: MyBotCommand = {
  command: "clear_disable_here",
  type: MyBotCommandTypes.common,
  isHidden: false,
  description: "добавить предыдущие сообщения в исключение (не будут удаляться)",
  repeatBehavior: CommandRepeatBehavior.none,
  callback: async (ctx) => {
    const res = await ctx.sendMessage(
      {
        disable_notification: true,
        text: "Предыдущие сообщения не будут удаляться...",
      },
      { removeMinTimeout: 5000 }
    );

    ctx.chat.lastDeleteIndex = res.message_id + 1;
    await ctx.deleteMessage(res.message_id);
  },
};

export default CommandClearDisableHere;
