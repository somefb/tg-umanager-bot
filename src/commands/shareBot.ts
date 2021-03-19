import { CallbackQuery, Message, Update } from "typegram";
import { EventCancellation, MyBotCommand, NewTextMessage } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";
import registerUser from "./registerUser";

let myBotUserName = "";
const waitMinutes = 5;
const waitTimeout = waitMinutes * 600; //000;
const deleteTimeoutSec = waitMinutes * 60;

function getInstructionsText() {
  return [
    "Для того, чтобы поделиться ботом (зарегистрировать пользователя) выполните следующие шаги:\n",
    "1) проверьте, что ваш пользователь не мошенник (наверняка у вас есть секреты)",
    '2) запросите у него новое голосовое сообщение, которое невозможно подготовить заранее (к примеру "Сегодня хороший день, а завтра в 2022 будет лучше")',
    "3) убедитесь, что голос соответствует ожидаемому. Очень важно, чтобы бы бот не попал в руки мошенников! А уникальное голосовое сообщение на сегодня самый безопасный и относительно надёжный способ верификации пользователя",
    "4) передайте голосовое сообщение боту (мне). Бот не сохраняет сообщение, а лишь анализирует и сохраняет некоторые уникальные данные. Это нужно на крайний случай, если мошенник сможет пройти проверку в последующем",
    `\nСкоро продолжим. А пока ожидаю голосовое сообщение от пользователя (в течение ${waitMinutes} минут)...`,
  ].join("\n");
}

const ShareBot: MyBotCommand = {
  command: "share_bot",
  type: MyBotCommandTypes.personal,
  description: "поделиться ботом",
  isHidden: true,
  callback: async (msg, service) => {
    const chat_id = msg.chat.id;

    let cancel: (() => void) | null = null;
    service.sendSelfDestroyed(
      {
        chat_id,
        text: getInstructionsText(),
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: "cancel" }]] },
      },
      deleteTimeoutSec
    );

    let timer: NodeJS.Timeout | null = null;

    const assignCancel: EventCancellation = (v) => {
      timer && clearTimeout(timer);
      timer = setTimeout(() => {
        cancel && cancel();
      }, waitTimeout);

      cancel = () => {
        timer && clearTimeout(timer);
        cancel = null;
        v();
      };
    };

    // todo timeout doesn't dispose this method because assignCancel is rewritten by await service.onGotFile(chat_id, assignCancel);
    service.onGotCallbackQuery(chat_id, assignCancel).then((e) => {
      const gotWord = (e.result.callback_query as CallbackQuery.DataCallbackQuery)?.data;
      if (gotWord === "cancel") {
        cancel && cancel();
      }
    });

    while (1) {
      const r = await service.onGotFile(chat_id, assignCancel);
      if ((r.result.message as Message.VoiceMessage).voice) {
        const file = r.result.file;
        const regUserId = r.result.message.forward_from?.id;
        if (regUserId) {
          const regUser = new UserItem(regUserId, CheckBot.generateUserKey());
          regUser.validationVoiceFile = file;
          regUser.sharedUserId = regUser.id;

          if (!myBotUserName) {
            const r = await service.core.getMe();
            myBotUserName = (r.ok && r.result.username) || myBotUserName;
          }

          await service.sendSelfDestroyed(
            {
              chat_id,
              text: `В течение ${waitMinutes} минут пользователь может написать боту @${myBotUserName}`,
            },
            deleteTimeoutSec
          );

          // wait for new user connection to this bot
          let msgFromRegUser: NewTextMessage | null = null;
          try {
            msgFromRegUser = (
              await service.onGotUpdate((v) => {
                return ((v as Update.MessageUpdate)?.message as Message.TextMessage)?.from?.id === regUser.id;
              }, waitTimeout)
            ).result as NewTextMessage;
          } catch {}

          const success = msgFromRegUser && (await registerUser(msgFromRegUser.message, service, regUser));
          service.sendSelfDestroyed(
            {
              chat_id,
              text: `Пользователь ${regUser.toLinkName()} ${success ? "зарегистрирован" : "не прошёл регистрацию"}`,
            },
            deleteTimeoutSec
          );
          break;
        }
      }

      service.core.deleteMessageForce({ chat_id, message_id: r.result.message.message_id });
      await service.sendSelfDestroyed(
        {
          chat_id,
          text: "Я ожидаю только голосовое сообщение...",
          reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: "cancel" }]] },
        },
        deleteTimeoutSec
      );

      service.onGotCallbackQuery(chat_id, assignCancel).then((e) => {
        const gotWord = (e.result.callback_query as CallbackQuery.DataCallbackQuery)?.data;
        if (gotWord === "cancel") {
          cancel && cancel();
        }
      });
    } //while
  },
};

export default ShareBot;
