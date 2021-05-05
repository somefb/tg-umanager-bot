import { CommandRepeatBehavior, MyBotCommand } from "../types";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";

const CommandKick: MyBotCommand = {
  command: "kick",
  type: MyBotCommandTypes.group,
  isHidden: false,
  description: "удалить пользователя",
  repeatBehavior: CommandRepeatBehavior.restart,
  callback: async (ctx) => {
    ctx.removeAllByCancel = true;
    ctx.singleMessageMode = true;
    ctx.disableNotification = true;
    ctx.singleUserMode = true;

    const delMember = await ctx.askForUser("Кого удаляем?");

    await ctx.sendAndWait({
      text: `Удалить ${UserItem.ToLinkUser(delMember)} из группы?`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Да", callback_data: "kOk" },
            { text: "Отмена", callback_data: ctx.getCallbackCancel() },
          ],
        ],
      },
    });

    //todo option kickFromGroupList
    await ctx.kickUser(delMember);
  },
};

export default CommandKick;
