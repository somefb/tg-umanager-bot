import { MyChatMember } from "../chatItem";
import Repo from "../repo";
import { CommandRepeatBehavior, MyBotCommand } from "../types";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";

const CommandKickInvalid: MyBotCommand = {
  command: "kick_invalid",
  type: MyBotCommandTypes.group,
  isHidden: true,
  description: "удалить тех, кто ещё прошёл проверку (не отвечает)",
  repeatBehavior: CommandRepeatBehavior.restart,
  callback: async (ctx) => {
    ctx.disableNotification = true;
    ctx.singleUserMode = true;

    const arr: MyChatMember[] = [];
    for (const key in ctx.chat.members) {
      const member = ctx.chat.members[key];
      const user = Repo.getUser(member.id);
      if (!user?._isValid) {
        arr.push(member);
      }
    }

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
  },
};

export default CommandKickInvalid;
