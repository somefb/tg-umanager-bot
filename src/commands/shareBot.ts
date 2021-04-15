import { Message, User } from "typegram";
import BotContext from "../botContext";
import createToken from "../helpers/createToken";
import Repo from "../repo";
import { CommandRepeatBehavior, EventTypeEnum, FileInfo, IBotContext, MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";
import registerUser from "./registerUser";

const notifyTimeout = 60 * 1000; //60 sec

function getInstructionsText() {
  return [
    "Для того, чтобы поделиться ботом (зарегистрировать пользователя) выполните следующие шаги:\n",
    "1) проверьте, что ваш пользователь не мошенник (наверняка у вас есть секреты)",
    '2) запросите у него новое голосовое сообщение, которое невозможно подготовить заранее (к примеру "Сегодня хороший день, а завтра в 2022 будет лучше")',
    "3) убедитесь, что голос соответствует ожидаемому. Очень важно, чтобы бы бот не попал в руки мошенников! А уникальное голосовое сообщение на сегодня самый безопасный и относительно надёжный способ верификации пользователя",
    "4) передайте голосовое сообщение боту (мне). Бот не сохраняет сообщение, а лишь анализирует и сохраняет некоторые уникальные данные. Это нужно на крайний случай, если мошенник сможет пройти проверку в последующем",
    `\nСкоро продолжим. А пока ожидаю голосовое сообщение от пользователя (в течение ${BotContext.defSessionTimeoutStr})...`,
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
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: "cancel" }]] },
    });
    let ev = ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);
    ev.then((e) => e.data === "cancel" && ctx.cancel("user cancelled")).catch((v) => v);

    let regInfo: RegInfo | undefined;
    while (1) {
      const r = await ctx.onGotEvent(EventTypeEnum.gotFile);
      ctx.removeEvent(ev);
      await ctx.deleteMessage(r.message_id);

      if ((r as Message.VoiceMessage).voice) {
        regInfo = {
          token: createToken(),
          validationVoiceFile: r.file,
          user: r.forward_from,
          whoSharedUserId: ctx.user.id,
        };
        if (r.forward_from?.id && Repo.getUser(r.forward_from?.id)) {
          await ctx.sendMessage(
            {
              text: "Этот пользователь уже зарегистрирован",
            },
            { removeTimeout: 5000 }
          );
          ctx.singleMessageMode = false;
        } else {
          break;
        }
      }

      await ctx.sendMessage({
        text: "Я ожидаю только голосовое сообщение...",
        reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: "cancel" }]] },
      });
      ctx.singleMessageMode = true;
      //restartTimeout
      ctx.setTimeout();

      ev = ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);
      ev.then((e) => e.data === "cancel" && ctx.cancel("user cancelled")).catch((v) => v);
    } //while

    if (!regInfo) return; //requires for ignoring TS issues

    await ctx.sendMessage(
      {
        text: `В течение ${BotContext.defSessionTimeoutStr} пользователь может написать боту @${ctx.botUserName}${
          !regInfo.user ? " используя токен: <b>" + regInfo.token + "</b> как стартовое слово" : ""
        }`,
        parse_mode: "HTML",
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
      const msgRegUser = regInfo.user?.id
        ? await ctx.service.onGotEvent(
            EventTypeEnum.gotBotCommand,
            (v) => v.from.id === regInfo.user?.id,
            BotContext.defSessionTimeout
          )
        : await ctx.service.onGotEvent(
            EventTypeEnum.gotNewMessage,
            (v) => v.text === regInfo.token,
            BotContext.defSessionTimeout
          );
      await ctx.service.core.deleteMessageForce({ chat_id: msgRegUser.chat.id, message_id: msgRegUser.message_id });
      //don't allow register again
      if (!Repo.getUser(msgRegUser.from.id)) {
        regUser = new UserItem(msgRegUser.from.id, CheckBot.generateUserKey());
        regUser.whoSharedUserId = regInfo.whoSharedUserId;
        regUser.validationVoiceFile = regInfo.validationVoiceFile;
        const ctxRegUser = ctx.service.initContext(msgRegUser.chat.id, "_reg", msgRegUser, regUser);
        success = !!(await ctxRegUser.callCommand((c) => registerUser(c, ctx)));
        break;
      } else {
        console.warn(`Decline registration. User ${msgRegUser.from.id} already exists`);
      }
    }
  } catch {}

  // send report to previous chat
  await ctx.sendMessage(
    {
      text: regUser
        ? `${regUser?.toLink()} ${success ? "зарегистрирован" : "не прошёл регистрацию"}`
        : `Истекло время ожидания. Токен ${regInfo.token} не действителен`,
      parse_mode: "HTML",
    },
    { removeTimeout: notifyTimeout, removeByUpdate: true, keepAfterSession: true }
  );
  ctx.cancel("end");
}

export default ShareBot;
