import { Message } from "typegram";
import BotContext from "../botContext";
import { EventTypeEnum, ITelegramService, MyBotCommand, NewTextMessage } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";
import registerUser from "./registerUser";

const notifyTimeout = 15000;

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
  callback: async (ctx) => {
    //todo what about several messages sent at once
    ctx.removeAnyByUpdate = true;

    await ctx.sendMessage({
      text: getInstructionsText(),
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: "cancel" }]] },
    });
    let ev = ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);
    ev.then((e) => e.data === "cancel" && ctx.cancel());

    let regUser: UserItem | undefined;
    while (1) {
      const r = await ctx.onGotEvent(EventTypeEnum.gotFile);
      ctx.removeEvent(ev);
      await ctx.deleteMessage(r.message_id);
      if ((r as Message.VoiceMessage).voice) {
        const file = r.file;
        const regUserId = r.forward_from?.id;
        if (regUserId) {
          regUser = new UserItem(regUserId, CheckBot.generateUserKey());
          regUser.validationVoiceFile = file;
          regUser.whoSharedUserId = ctx.user.id;

          break;
        }
      }

      await ctx.sendMessage({
        text: "Я ожидаю только голосовое сообщение...",
        reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: "cancel" }]] },
      });
      //restartTimeout
      ctx.setTimeout();

      ev = ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);
      ev.then((e) => e.data === "cancel" && ctx.cancel());
    } //while

    // this case impossible but required for TS
    if (!regUser) {
      return;
    }

    await ctx.sendMessage({
      text: `В течение ${BotContext.defSessionTimeoutStr} пользователь может написать боту @${ctx.botUserName}`,
    });

    //WARN: it's important not to wait for task
    registrationTask(ctx.service, regUser, ctx.chatId, ctx.user);
  },
};

async function registrationTask(
  service: ITelegramService,
  regUser: UserItem,
  reportChatId: number,
  reportUser: UserItem
) {
  let msgRegUser: NewTextMessage | null = null;
  let success = false;
  try {
    // wait for new user connection to this bot
    msgRegUser = await service.onGotEvent(
      EventTypeEnum.gotNewMessage,
      (v) => v.from.id === regUser?.id,
      BotContext.defSessionTimeout
    );

    const ctxRegUser = service.getContext(msgRegUser.chat.id, msgRegUser, regUser);
    success = !!(await ctxRegUser.callCommand(registerUser));
  } catch {}

  const ctx = service.getContext(reportChatId, null, reportUser);
  await ctx.sendMessage(
    {
      text: `Пользователь ${regUser.toLink()} ${success ? "зарегистрирован" : "не прошёл регистрацию"}`,
    },
    { removeTimeout: notifyTimeout, removeByUpdate: true, keepAfterSession: true }
  );
  ctx.cancel();
}

export default ShareBot;
