import { CommandRepeatBehavior, EventTypeEnum, IBotContext, MyBotCommand } from "../types";
import UserItem, { IUser } from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";

export async function kickUser(ctx: IBotContext, delMember: IUser): Promise<boolean> {
  ctx.setTimeout();
  ctx.removeAllByCancel = true;
  ctx.singleMessageMode = true;
  ctx.disableNotification = true;
  ctx.singleUserMode = true;

  const uRemovedLink = UserItem.ToLinkUser(delMember); //, delMember.isAnonym);

  const m = await ctx.sendMessage({
    text: `Удалить ${uRemovedLink} из группы?`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Да", callback_data: "kOk" },
          { text: "Отмена", callback_data: ctx.getCallbackCancel() },
        ],
      ],
    },
  });

  while (1) {
    const q = await ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);
    if (m.message_id === q.message?.message_id) {
      break;
    }
  }

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
    //todo option kickFromGroupList
    ctx.chat.removeMember(delMember.id, true);

    await ctx.sendMessage(
      {
        text: `${ctx.userLink} удалил ${uRemovedLink}`,
        parse_mode: "HTML",
        disable_notification: false,
      },
      { keepAfterSession: true }
    );
    return true;
  } catch (error) {
    console.error(error);
    await ctx.sendMessage(
      {
        text: `Не могу удалить ${uRemovedLink}. Вероятно недостаточно прав`,
        parse_mode: "HTML", //
      },
      { keepAfterSession: true, removeTimeout: 5000 }
    );
  }

  return false;
}

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
    await kickUser(ctx, delMember);
  },
};

export default CommandKick;
