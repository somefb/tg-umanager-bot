import { CommandRepeatBehavior, EventTypeEnum, MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import { MyBotCommandTypes } from "./botCommandTypes";

const CommandInvite: MyBotCommand = {
  command: "invite",
  type: MyBotCommandTypes.group,
  isHidden: true,
  description: "пригласить пользователя",
  repeatBehavior: CommandRepeatBehavior.restart,
  callback: async (ctx) => {
    ctx.removeAllByCancel = true;
    ctx.singleMessageMode = true;
    ctx.disableNotification = true;
    ctx.singleUserMode = true;

    const targetMember = await ctx.askForUser(
      "Кого добавим в группу?",
      true,
      "Пригласить можно только зарегистрированных пользователей"
    );

    let valid: boolean | null = targetMember.isValid;
    if (!valid) {
      await ctx.sendMessage({ text: `Проверяю ${targetMember.toLink()} прежде, чем дать ссылку...` });
      valid = await CheckBot.validateUser(targetMember);
    }
    if (!valid) {
      await ctx.sendMessage(
        { text: `${targetMember.toLink()} не прошёл проверку и заблокирован!` },
        { keepAfterSession: true, removeTimeout: 30000 }
      );
    } else {
      const waitMs = 10 * 60000;
      const expiryDate = Date.now() + waitMs;
      const res = await ctx.service.core.createChatInviteLink({
        chat_id: ctx.chatId,
        expire_date: Math.round(expiryDate / 1000),
        member_limit: 1,
      });
      if (!res.ok) {
        return;
      }
      const link = res.result.invite_link;

      // todo maybe use CheckBot for invitation?
      const ctxInvite = ctx.service.initContext(targetMember.termyBotChatId, "_invite", null, targetMember);
      ctx.onCancelled().finally(() => ctxInvite.cancel("end"));
      ctx.setTimeout(waitMs);
      ctxInvite.setTimeout(waitMs);
      ctxInvite.removeAllByCancel = true;
      await ctxInvite.sendMessage({ text: "Вас приглашают в группу\n" + link });

      await ctx.sendMessage(
        {
          text: `${ctx.userLink} вызвал ${
            CommandInvite.command
          }. ${targetMember.toLink()} получил ссылку на эту группу`,
        },
        { removeMinTimeout: 5000 }
      );

      while (1) {
        const mArr = await ctx.onGotEvent(EventTypeEnum.addedChatMembers);
        if (mArr.new_chat_members.find((v) => v.id === targetMember.id)) {
          await ctx.deleteMessage(mArr.message_id);
          break;
        }
      }

      await ctx.sendMessage(
        { text: `${ctx.userLink} добавил ${targetMember.toLink()}` },
        { keepAfterSession: true } //
      );
    }
  },
};

export default CommandInvite;
