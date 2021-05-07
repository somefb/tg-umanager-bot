import ChatItem from "../chatItem";
import Repo from "../repo";
import { CommandRepeatBehavior, ITelegramService, MyBotCommand, NewTextMessage } from "../types";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";

let service: ITelegramService;

export async function handleKickTextAAA(msg: NewTextMessage & { text: string | undefined }): Promise<void> {
  if (msg.text && /^[\s\S]{0,1}([AaАаFfФф]){3,}/.test(msg.text)) {
    let user = Repo.getUser(msg.from.id);
    if (!user && ChatItem.isAnonymGroupBot(msg.from)) {
      const ctx = service.initContext(msg.chat.id, "_aaa", msg, user || new UserItem(0, { num: 0, word: "" }));
      await ctx.callCommand(async (ctx) => {
        ctx.singleUserMode = true;
        ctx.removeAllByCancel = true;
        const q = await ctx.sendAndWait({
          text: "Вы анонимны! Нажмите кнопку ниже...",
          reply_markup: { inline_keyboard: [[{ text: "AAA", callback_data: "ok" }]] },
        });
        user = Repo.getUser(q.from.id);
      });
    }

    if (user) {
      await kickUserFull(user, "использовал код ААА");
      if (msg.chat.type === "private") {
        const ctx = service.initContext(msg.chat.id, "_aaaClear", msg, user);
        ctx.callCommand((ctx) => ctx.clearChat(msg.message_id));
      }
      // todo clear all chats but required lastMessageId
    } else {
      await service.core.sendMessage({
        reply_to_message_id: msg.message_id,
        chat_id: msg.chat.id,
        text: "Вы не зарегистрированы",
      });
    }
  }
}

export async function kickUserFull(user: UserItem, reason: string): Promise<void> {
  // remove user from all chats
  for (const key in Repo.chats) {
    if (Repo.chats[key].members[user.id]) {
      const me = new UserItem(0, { num: 0, word: "" });
      me.firstName = "Я";
      const ctxKick = service.initContext(Repo.chats[key].id, "_kickUser", null, me);
      await ctxKick.kickUser(user, `Причина: пользователь ${reason}`);
      ctxKick.cancel("end");
    }
  }
}

const CommandKick: MyBotCommand = {
  command: "kick",
  type: MyBotCommandTypes.group,
  isHidden: false,
  description: "удалить пользователя",
  repeatBehavior: CommandRepeatBehavior.restart,
  onServiceInit: (serv) => (service = serv),
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
