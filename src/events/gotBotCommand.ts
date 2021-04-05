import appSettings from "../appSettingsGet";
import ChatItem from "../chatItem";
import { MyBotCommandTypes } from "../commands/botCommandTypes";
import registerUser from "../commands/registerUser";
import Repo from "../repo";
import TelegramService from "../telegramService";
import { EventTypeEnum, NewTextMessage } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";

export default function gotBotCommand(this: TelegramService, msg: NewTextMessage, chat_id: number): boolean {
  const text = msg.text;
  let end: number | undefined = text.indexOf(" ", 1);
  if (end === -1) {
    end = text.length;
  }

  const chat = Repo.getСhat(chat_id);
  //all chats must be groupChat beside privateChats assigned to
  const isGroupChat = chat?.isGroup || msg.chat.type !== "private";
  if (chat && chat.isGroup == null) {
    // possible case for old entities
    console.warn("chat group is not defined");
    chat.isGroup = true;
    Repo.commit();
  }

  //extract command from /cmd@botName
  if (isGroupChat) {
    let i = 2;
    for (; i < end; ++i) {
      if (text[i] === "@") {
        break;
      }
    }
    const toBotName = text.substring(i + 1, end);
    if (toBotName !== this.botUserName) {
      return true;
    }
    end = i;
  }

  const textCmd = text.substring(0, end);
  const cmd = this.commands.find((c) => c.command === textCmd);
  if (cmd) {
    const user = Repo.getUser(msg.from.id);

    if (!isGroupChat && !user) {
      process.env.DEBUG && console.log(`Decline command. User ${msg.from.id} is not registered`);
    } else {
      this.core.deleteMessageForce({ chat_id, message_id: msg.message_id });

      if (!isGroupChat && user && !user.isValid) {
        process.env.DEBUG && console.log(`Decline private command. User ${msg.from.id} is invalid`);
        return true;
      }

      let notifyText: string | undefined;

      if (!isGroupChat && cmd.type === MyBotCommandTypes.group) {
        notifyText = "Групповые команды доступны только в групповом чате";
      } else if (isGroupChat && cmd.type === MyBotCommandTypes.personal) {
        notifyText = "Персональные команды доступны только в приватном чате";
      } else if (isGroupChat && !user && !ChatItem.isAnonymGroupBot(msg.from)) {
        notifyText = "Команды доступны только для зарегестрированных пользователей";
      }

      if (notifyText) {
        this.core.sendMessage({ chat_id, text: notifyText, disable_notification: true }).then((v) => {
          setTimeout(() => {
            v.ok && this.core.deleteMessageForce({ chat_id, message_id: v.result.message_id });
          }, 5000);
        });
      } else {
        // (async () => {
        //   let ctx = this.tryGetContext(chat_id);
        //   if (ctx) {
        //     // todo it's wrong for some commands that should be itself
        //     const m = await ctx.sendMessage({
        //       text: "Прервать предыдущую команду?",
        //       reply_markup: {
        //         inline_keyboard: [
        //           [
        //             { text: "Да", callback_data: "yes" },
        //             { text: "Нет", callback_data: "no" },
        //           ],
        //         ],
        //       },
        //     });
        //     ctx.onCancelling = () => ctx?.deleteMessage(m.message_id);
        //     const q = await ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);
        //     if (q.message?.message_id === m.message_id) {
        //       if (q.data === "yes") {
        //         ctx.cancel();
        //       } else {
        //         ctx?.deleteMessage(m.message_id);
        //       }
        //     }
        //   }

        //   // WARN: user can be undefined (anonym) for groupCommands
        //   ctx = ctx || this.getContext(chat_id, msg, user || new UserItem(msg.from?.id || 0, { num: 0, word: "" }));
        //   await ctx.callCommand(cmd.callback);
        // })();
        const ctx = this.initContext(chat_id, msg, user || new UserItem(msg.from?.id || 0, { num: 0, word: "" }));
        ctx.callCommand(cmd.callback);
      }
    }
    return true;
  }
  //todo; WARN remove after first assignment
  else if (textCmd === appSettings.ownerRegisterCmd && !Repo.hasAnyUser) {
    this.core.deleteMessageForce({ chat_id, message_id: msg.message_id });
    const newUser = new UserItem(msg.from.id, CheckBot.generateUserKey());

    const ctx = this.initContext(chat_id, msg, newUser);
    ctx.callCommand(registerUser);

    return true;
  }
  return false;
}
