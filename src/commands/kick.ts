import { CommandRepeatBehavior, EventTypeEnum, MyBotCommand } from "../types";
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
    const uRemovedLink = UserItem.ToLinkUser(delMember); //, delMember.isAnonym);

    await ctx.sendMessage({
      text: `Выбран ${uRemovedLink}. Удалить?`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Да", callback_data: "kOk" },
            { text: "Отмена", callback_data: "kC0" },
          ],
        ],
      },
    });

    const q = await ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);
    if (q.data === "kOk") {
      try {
        await ctx.service.core.kickChatMember({
          chat_id: ctx.chatId,
          user_id: delMember.id,
          revoke_messages: true,
        });
        await ctx.service.core.unbanChatMember({
          chat_id: ctx.chatId,
          user_id: delMember.id,
          only_if_banned: true,
        });

        ctx.chat.removeMember(delMember.id);

        await ctx.sendMessage(
          {
            text: `${ctx.userLink} удалил ${uRemovedLink}`,
            parse_mode: "HTML",
            disable_notification: false,
          },
          { keepAfterSession: true }
        );
      } catch (error) {
        console.error(error);
        await ctx.sendMessage(
          {
            text: `Не могу удалить пользователя ${uRemovedLink}. Вероятно недостаточно прав`,
            parse_mode: "HTML", //
          },
          { keepAfterSession: true, removeTimeout: 5000 }
        );
      }
    }
  },
};

export default CommandKick;
