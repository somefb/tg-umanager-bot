import { Message, User } from "typegram";
import BotContext from "../botContext";
import ErrorCancelled from "../errorCancelled";
import createToken from "../helpers/createToken";
import Repo from "../repo";
import { CommandRepeatBehavior, EventTypeEnum, FileInfo, IBotContext, MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";
import registerUser from "./registerUser";

const notifyTimeout = 60 * 1000; //60 sec

export function getInstructionsText(isUnlock = false, targetUser?: UserItem): string {
  return [
    `Для того, чтобы ${isUnlock ? "разблокировать" : "зарегистрировать"} ${
      targetUser ? targetUser.toLink() : "пользователя"
    } выполните следующие шаги:\n`,
    "1) проверьте, что ваш пользователь не мошенник (наверняка у вас есть секреты)",
    `2) запросите у него ${
      isUnlock ? "новое " : ""
    }голосовое сообщение, которое невозможно подготовить заранее (к примеру назвать сегодняшнюю дату + 1 год)`,
    isUnlock
      ? "3) Убедитесь, что голос соответствует ожидаемому или если не знаете, то сравните с голосом в сообщении ниже"
      : "3) убедитесь, что голос соответствует ожидаемому. Очень важно, чтобы бы бот не попал в руки мошенников! А уникальное голосовое сообщение на сегодня самый безопасный и относительно надёжный способ верификации пользователя",
    "4) передайте голосовое сообщение боту (мне). Бот не сохраняет сообщение, а лишь анализирует и сохраняет некоторые уникальные данные. Это нужно на крайний случай, если мошенник сможет пройти проверку в последующем",
    `\nСкоро продолжим. А пока ожидаю голосовое сообщение от ${
      targetUser ? targetUser.toLink() : "пользователя"
    } (в течение ${BotContext.defSessionTimeoutStr})...`,
  ].join("\n");
}

const ShareBot: MyBotCommand = {
  command: "share_bot",
  type: MyBotCommandTypes.personal,
  description: "поделиться ботом",
  isHidden: true,
  repeatBehavior: CommandRepeatBehavior.skip,
  callback: async (ctx) => {
    ctx.singleMessageMode = true;
    ctx.removeAllByCancel = true;

    await ctx.sendMessage({
      text: getInstructionsText(),

      reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: ctx.getCallbackCancel() }]] },
    });

    let regInfo: RegInfo | undefined;
    while (1) {
      ctx.setTimeout();
      const r = await ctx.onGotEvent(EventTypeEnum.gotFile);
      ctx.setTimeout();
      await ctx.deleteMessage(r.message_id);

      if ((r as Message.VoiceMessage).voice) {
        regInfo = {
          token: createToken(),
          validationVoiceFile: r.file,
          user: r.forward_from,
          whoSharedUserId: ctx.user.id,
        };
        break;
      }

      await ctx.sendMessage({
        text: "Я ожидаю только голосовое сообщение...",
        reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: ctx.getCallbackCancel() }]] },
      });
    } //while

    if (!regInfo) return; //requires for ignoring TS issues

    ctx.singleMessageMode = true;
    //todo looks like the message isn't deleted after
    await ctx.sendMessage(
      {
        text: `В течение ${BotContext.defSessionTimeoutStr} пользователь может написать боту @${ctx.botUserName}${
          !regInfo.user ? " используя токен: <b>" + regInfo.token + "</b> как стартовое слово" : ""
        }\n`,
      },
      { keepAfterSession: true }
    );

    //WARN: it's important not to wait for task
    registrationTask(ctx, regInfo);
  },
};

interface RegInfo {
  token: string;
  validationVoiceFile: FileInfo;
  user?: User;
  whoSharedUserId: number;
}

// WARN: ctx here is already cancelled
async function registrationTask(ctx: IBotContext, regInfo: RegInfo) {
  let success = false;
  let regUser: UserItem | undefined;
  setTimeout(() => {
    ctx.name = "_regReport";
  });

  try {
    // wait for new user connection to this bot
    while (1) {
      const msgRegUser = await ctx.service.onGotEvent(
        EventTypeEnum.gotNewMessage,
        (v) => v.text === regInfo.token,
        BotContext.defSessionTimeout
      );
      await ctx.service.core.deleteMessageForce({ chat_id: msgRegUser.chat.id, message_id: msgRegUser.message_id });
      //don't allow register again
      const u = Repo.getUser(msgRegUser.from.id);
      if (!u) {
        regUser = new UserItem(msgRegUser.from.id, CheckBot.generateUserKey());
        regUser.whoSharedUserId = regInfo.whoSharedUserId;
        regUser.validationVoiceFile = regInfo.validationVoiceFile;
        const ctxRegUser = ctx.service.initContext(msgRegUser.chat.id, "_reg", msgRegUser, regUser);
        success = !!(await ctxRegUser.callCommand((c) => registerUser(c, ctx)));
        break;
      } else {
        console.log(`Decline registration. User ${msgRegUser.from.id} already exists`);
        await ctx.sendMessage(
          { text: `${u.toLink()} уже зарегистрирован ранее!` },
          { keepAfterSession: true, removeTimeout: 30000 }
        );
      }
    }
  } catch (err) {
    if (!(err as ErrorCancelled).isCancelled) {
      console.error(err);
    }
  }

  // send report to previous chat
  await ctx.sendMessage(
    {
      text: regUser
        ? `${regUser?.toLink()} ${success ? "зарегистрирован" : "не прошёл регистрацию"}`
        : `Истекло время ожидания. Токен ${regInfo.token} не действителен`,
    },
    { removeTimeout: notifyTimeout, removeByUpdate: true, keepAfterSession: true }
  );
  ctx.cancel("end");
}

export default ShareBot;
