import ChatItem from "../chatItem";
import Repo from "../repo";
import { CommandRepeatBehavior, MyBotCommand } from "../types";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";
import CommandCheck from "./check";

const CommandKickInvalid: MyBotCommand = {
  command: "kick_invalid",
  type: MyBotCommandTypes.group,
  isHidden: true,
  description: "удалить тех, кто ещё не прошёл проверку (не отвечает)",
  repeatBehavior: CommandRepeatBehavior.restart,
  callback: async (ctx) => {
    ctx.disableNotification = true;
    ctx.singleUserMode = true;

    const arr = ChatItem.getSortedMembers(ctx.chat.members, (m) => !Repo.getUser(m.id)?._isValid);

    if (!arr.length) {
      await ctx.sendMessage(
        {
          text: `Некого удалять. Вы можете обновить статус (команда ${CommandCheck}) и повторить снова...`,
        },
        { keepAfterSession: true, removeTimeout: 10000 }
      );
    } else {
      await ctx.sendAndWait(
        {
          text: `Удалить из группы следующих пользователей (я верну их как только пройдут проверку)?\n${arr
            .map((v) => "▪️" + UserItem.ToLinkUser(v, v.isAnonym))
            .join("\n")}`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Да", callback_data: "ok" },
                { text: "Отмена", callback_data: ctx.getCallbackCancel() },
              ],
            ],
          },
        },
        { removeByUpdate: true }
      );

      for (let i = 0; i < arr.length; ++i) {
        await ctx.kickUser(arr[i]);
      }
    }
  },
};

export default CommandKickInvalid;
