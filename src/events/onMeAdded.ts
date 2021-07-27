import { ChatMember } from "typegram";
import ChatItem from "../chatItem";
import countAllTask from "../commands/countAllTask";
import Repo from "../repo";
import TelegramService from "../telegramService";
import { EventTypeEnum, EventTypeReturnType, IBotContext, NewTextMessage } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";

/** Bot added to group chat */
export default async function onMeAdded(
  this: TelegramService,
  msg: EventTypeReturnType[EventTypeEnum.memberUpated],
  chat_id: number
): Promise<void> {
  const isGroup = msg.chat.type !== "private";

  // WARN: bot cant leave private chat itself
  if (!isGroup) {
    return;
  }

  if (this === CheckBot.service) {
    await this.core.leaveChat({ chat_id });
    return;
  }

  const user = Repo.getUser(msg.from?.id);
  const isAnonym = ChatItem.isAnonymGroupBot(msg.from);
  if (user?.isLocked && !isAnonym) {
    console.warn(`I'm leaving chat. Reason: user ${user?.id} is locked`);
    await this.core.leaveChat({ chat_id });
    return;
  }

  const m = await this.core.sendMessage({
    chat_id,
    text: "Создатель чата, назначьте меня администратором. Иначе я бесполезен! Ожидаю...",
  });
  if (!m.ok) {
    //case impossible but requires to TS
    return;
  }
  const c = this.getContexts(chat_id);
  c?.forEach((v) => v.cancel("fired onMeAdded again")); // case possible when user removes bot and adds again (there is no onLeave event)

  let admins: ChatMember[] | undefined;
  const ctx = this.initContext(
    chat_id,
    "_meAdded",
    m.result as NewTextMessage,
    user || new UserItem(msg.from?.id || 0, { num: 0, word: "" })
  );
  ctx.singleMessageMode = true;

  const waitAdminRights = async (ctx: IBotContext) => {
    while (1) {
      ctx.setTimeout(30 * 60000);
      const resRights = await ctx.onGotEvent(EventTypeEnum.memberUpated);
      const member = resRights.new_chat_member || resRights.old_chat_member;
      if (member.user.id === this.botUserId && member.status === "administrator") {
        const resAdmins = await ctx.service.core.getChatAdministrators({ chat_id });
        if (!resAdmins.ok) {
          // impossible but requires for TS
          return false;
        }
        admins = resAdmins.result;
        if (admins.length > 1 && admins.find((v) => v.user.id === resRights.from.id)?.status !== "creator") {
          await ctx.sendMessage({
            text: "Только создатель чата должен назначить меня администратором. Ожидаю...",
          });
          continue;
        }

        if (!member.can_invite_users) {
          await ctx.sendMessage({
            text: "Права ограничены: не могу приглашать пользователей. Дайте мне права. Ожидаю...",
            disable_notification: true,
          });
          continue;
        }

        if (!member.can_delete_messages) {
          await ctx.sendMessage({
            text: "Права ограничены: не могу удалять сообщения. Дайте мне права. Ожидаю...",
            disable_notification: true,
          });
          continue;
        }

        return true;
      }
    } //while 1
  };

  const gotRights = await ctx.callCommand(waitAdminRights);
  await ctx.deleteMessage(m.result.message_id);

  if (!gotRights) {
    await this.core.leaveChat({ chat_id });
    //WARN: ctx is cancelled in waitAdminRights
    return;
  }

  const chat = Repo.getOrPushChat(chat_id);
  chat.isGroup = true;

  await ctx.sendMessage(
    {
      text: [
        "Привет. Я ваш новый помощник",
        "Одна из моих задач - быть максимально неприметным и бестолковым для мошенников, а потому часть команд скрыта..",
        `Все команды можно увидеть используя /help@${ctx.botUserName}`,
        "\nКоманды доступны для каждого в чате (но только для зарегестрированных пользователей)",
        "Для прохождения регистрации к вам обратятся те, кто уже её прошёл...",
      ].join(".\n"),
    },
    { keepAfterSession: true }
  );

  // WARN: it's important not to wait for task
  countAllTask(ctx);
}
