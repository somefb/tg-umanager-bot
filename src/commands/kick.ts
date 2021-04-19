import { MessageEntity } from "typegram";
import ChatItem, { MyChatMember } from "../chatItem";
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

    await ctx.sendMessage({
      text: "Кого удаляем?",
      reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: "kC0" }]] },
    });

    ctx.onGotEvent(EventTypeEnum.gotCallbackQuery).then((q) => q.data === "kC0" && ctx.cancel("user cancelled"));

    let removedMember: MyChatMember | undefined | null;
    while (1) {
      const res = await ctx.onGotEvent(EventTypeEnum.gotNewMessage);
      console.warn(res);
      const msg = res.entities?.find((v) => v.type === "mention" || v.type === "text_mention");
      if (msg?.offset === 0) {
        await ctx.deleteMessage(res.message_id);
        ctx.singleMessageMode = false;

        const mentioned = (msg as MessageEntity.TextMentionMessageEntity).user;
        let mention = "";
        if (!mentioned) {
          mention = res.text.substring(msg.offset, msg.length);
          removedMember = ctx.chat.getMemberByName(mention);
        } else {
          removedMember = ChatItem.userToMember(mentioned, false);
        }

        if (!removedMember) {
          if (mention === "@" + ctx.botUserName) {
            await ctx.sendMessage({ text: "Вы не можете удалить меня..." }, { removeTimeout: 5000 });
          } else {
            await ctx.sendMessage({ text: "Не могу определить пользователя" }, { removeTimeout: 5000 });
          }
        } else if (removedMember.id === ctx.initMessage.from.id || removedMember.id === ctx.user.termyBotChatId) {
          await ctx.sendMessage({ text: "Вы не можете удалить себя или меня..." }, { removeTimeout: 5000 });
        } else {
          break;
        }
      }
    }

    ctx.singleMessageMode = true;

    if (!removedMember) {
      await ctx.sendMessage(
        { text: "Такой пользователь не найден" },
        { keepAfterSession: true, removeMinTimeout: 5000 }
      );
      return;
    }

    const uRemovedLink = UserItem.ToLinkUser(removedMember, removedMember.isAnonym);

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
          user_id: removedMember.id,
          revoke_messages: true,
        });
        await ctx.service.core.unbanChatMember({
          chat_id: ctx.chatId,
          user_id: removedMember.id,
          only_if_banned: true,
        });

        ctx.chat.removeMember(removedMember.id);

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
