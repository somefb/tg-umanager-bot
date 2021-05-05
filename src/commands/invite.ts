import ErrorCancelled from "../errorCancelled";
import { CommandRepeatBehavior, EventTypeEnum, IBotContext, ITelegramService, MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";

let BotService: ITelegramService;

/** Invite user to chat if it's possible */
export async function sendInviteLinkTask(target: UserItem, inviteToChatId: number): Promise<void | null> {
  // decline invitation if user rejected it previously
  if (target.declinedChats.has(inviteToChatId)) {
    return;
  }
  const ctxReport = BotService.initContext(inviteToChatId, "_inviteTask", null, target);
  const r = await ctxReport.callCommand((ctx) => sendInviteLink(ctx, target, null));
  return r;
}

async function sendInviteLink(ctxReport: IBotContext, target: UserItem, whoInviteLink: string | null) {
  ctxReport.setTimeout(0);
  ctxReport.singleMessageMode = true;
  ctxReport.disableNotification = true;
  ctxReport.removeAllByCancel = true;

  try {
    let valid: boolean | null = target.isValid;
    let wasChecked = false;
    if (!valid) {
      await ctxReport.sendMessage({ text: `Проверяю ${target.toLink()} прежде, чем дать ссылку...` });
      valid = await CheckBot.validateUser(target);
      wasChecked = true;
    }
    if (!valid) {
      await ctxReport.sendMessage(
        { text: `${target.toLink()} не прошёл проверку и заблокирован!` },
        { keepAfterSession: true, removeTimeout: 30000 }
      );
      return;
    }

    const waitMs = (wasChecked ? 2 : 10) * 60000;
    const expiryDate = Date.now() + waitMs;
    const res = await ctxReport.service.core.createChatInviteLink({
      chat_id: ctxReport.chatId,
      expire_date: Math.round(expiryDate / 1000),
      member_limit: 1,
    });
    if (!res.ok) {
      return;
    }

    const link = res.result.invite_link;

    await ctxReport.service.core.unbanChatMember({
      chat_id: ctxReport.chatId,
      user_id: target.id,
      only_if_banned: true,
    });

    const ctxInvite = CheckBot.service.initContext(target.checkBotChatId, "_inviteLink", null, target);
    ctxInvite.setTimeout();
    ctxInvite.removeAllByCancel = true;

    ctxReport.setTimeout(waitMs);
    ctxReport.onCancelled().finally(() => ctxInvite.cancel("end"));

    const callbackCancel = (isForever: boolean) => {
      if (isForever) {
        target.declinedChats.add(ctxReport.chatId);
      }
      return ctxInvite.getCallbackCancel(async () => {
        await ctxReport.sendMessage(
          { text: `${target.toLink()} отказалася`, disable_notification: false },
          { keepAfterSession: true, removeTimeout: 60000 }
        );
        ctxReport.cancel("user cancelled");
      });
    };

    await ctxInvite.sendMessage({
      text: "Вас приглашают в группу\n" + link,
      reply_markup: {
        inline_keyboard: [
          [{ text: "Отказаться", callback_data: callbackCancel(false) }],
          [{ text: "Отказаться навсегда", callback_data: callbackCancel(true) }],
        ],
      },
    });

    let text = `${target.toLink()} получил ссылку на эту группу`;
    if (whoInviteLink) {
      text = `${whoInviteLink} пригласил пользователя. ` + text;
    }
    await ctxReport.sendMessage({ text }, { removeMinTimeout: 5000 });

    while (1) {
      const mArr = await ctxReport.onGotEvent(EventTypeEnum.addedChatMembers);
      if (mArr.new_chat_members.find((v) => v.id === target.id)) {
        await ctxReport.deleteMessage(mArr.message_id);
        break;
      }
    }

    if (whoInviteLink) {
      text = `${whoInviteLink} добавил ${target.toLink()}`;
    } else {
      text = `${target.toLink()} вернулся в группу`;
    }

    await ctxReport.sendMessage({ text, disable_notification: false }, { keepAfterSession: true });
  } catch (error) {
    const err = error as ErrorCancelled;
    if (err.isTimeout) {
      await ctxReport.sendMessage(
        {
          text: [
            `Истекло время ожидания. Ссылка для пользователя ${target.toLink()} удалена`,
            `Вы можете поделиться ссылкой на группу используя комманду ${CommandInvite.command}`,
          ].join(". "),
          disable_notification: false,
        },
        { keepAfterSession: true, removeTimeout: 60000 }
      );
    }

    throw error;
  }
}

const CommandInvite: MyBotCommand = {
  command: "invite",
  type: MyBotCommandTypes.group,
  isHidden: true,
  description: "пригласить пользователя",
  repeatBehavior: CommandRepeatBehavior.restart,
  onServiceInit: (service) => {
    BotService = service;
  },
  callback: async (ctx) => {
    ctx.removeAllByCancel = true;
    ctx.singleMessageMode = true;
    ctx.disableNotification = true;
    ctx.singleUserMode = true;

    const target = await ctx.askForUser(
      "Кого добавим в группу?",
      true,
      "Пригласить можно только зарегистрированных пользователей"
    );

    if (ctx.chat.members[target.id]) {
      await ctx.sendMessage(
        { text: `${target.toLink()} уже в этой группе` },
        { keepAfterSession: true, removeTimeout: 10000 }
      );
      return;
    }

    if (target.declinedChats.has(ctx.chat.id)) {
      await ctx.sendMessage(
        { text: `${target.toLink()} навсегда отказался вступать в группу` },
        { keepAfterSession: true, removeTimeout: 10000 }
      );
      return;
    }

    await sendInviteLink(ctx, target, ctx.userLink);
  },
};

export default CommandInvite;
