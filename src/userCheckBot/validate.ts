import { Opts, Message, CallbackQuery } from "typegram";
import arrayGetRandomItem from "../helpers/arrayGetRandomItem";
import arrayMapToTableByColumn from "../helpers/arrayMapToTableByColumn";
import { ITelegramService } from "../types";
import UserItem from "../userItem";
import { generateWordPairs, generateWordPairsNext } from "./dictionary";

// WARN: rows*columns > max ukey.num (defined in dictionary.ts)
const rows = 4;
const collumns = 3;

// validation section here
const expectedValidTimes = 2; // twice in the row
const expectedInvalidTimes = 3; // total possible == twice
//todo implement waitTimeout
const waitTimeout = 60 * 1000; //1 minute
const notifyTimeout = 5000;
const notifyDeleteLastTimeout = 60000;

const answersTrue = ["Верно", "Правильно", "Хорошо"];
const answersFalse = ["Увы", "Неверно", "Неправильно"];

const answersExpected_1 = ["Невероятно", "Хм", "Интересно", "Забавно", "Необычно"];
const answersExpected_2 = ["Ладно-ладно!", "А вы настойчивы!", "Вы сделали невозможное!"];
const askFile = "Понравилась игра?";

const uploadFileInstructions = [
  ".\nИ напоследок передайте мне любой ваш уникальный файл (картинка/фото, аудио/голосовое, текстовый).",
  "* файл должен быть уникальным для вас, но абсолютно бесполезным для остальных",
  "* сохраните его где-нибудь в доступном для вас месте и не теряйте его никогда!",
  "\nВсякий раз как вы проходите игру с ошибкой, а также с некоторой периодичностью бот будет выдавать сообщение:",
  `<b>${askFile}</b>`,
  "на это сообщение вам нужно будет передать боту (мне) тот самый уникальный файл.",
  "\nЯ жду ваш файл...",
].join("\n");

export default async function validate(user: UserItem, service: ITelegramService): Promise<boolean | null> {
  try {
    let message_id = 0;

    if (!user.checkBotChatId) {
      console.error(`Error in validate(). checkBotChatId is not defined for user ${user.id}`);
      return null;
    }

    //todo detect if chat is blocked and somehow notify user
    const sendMessage = async (text: string, words: string[] | null) => {
      let res;
      const args: Opts<"sendMessage"> = {
        chat_id: user.checkBotChatId,
        text,
        parse_mode: "HTML",
      };

      if (words) {
        args.reply_markup = {
          inline_keyboard: arrayMapToTableByColumn(words, rows, collumns, (v) => ({
            text: v,
            callback_data: v,
          })),
        };
      }

      if (!message_id) {
        res = await service.core.sendMessage(args);
      } else {
        const args2 = args as Opts<"editMessageText">;
        args2.message_id = message_id;
        res = await service.core.editMessageText(args2);
      }

      if (!res.ok) {
        await service.core.sendMessage({ chat_id: user.checkBotChatId, text: "Я поломался. Давайте ещё раз" });
        const err = new Error("Need to repeat");
        err.name = "Repeat";
        throw err;
      }

      return res.result;
    };

    let validTimes = 0;
    let invalidTimes = 0;
    let msgPrefix = "";
    let repeatCnt = 0;

    const cancelSession = (isValid: boolean) => {
      user.validationDate = Date.now();
      user.isInvalid = !isValid;
      // todo do we need to save reason?
      if (!isValid) {
        // todo implement unlock behavior
        user.isLocked = true;
      }
      setTimeout(() => {
        sendMessage("Рекомендуется удалить этот чат (бот не может это сделать)!", null);
        setTimeout(() => {
          service.core.deleteMessageForce({ chat_id: user.checkBotChatId, message_id });
        }, notifyDeleteLastTimeout);
      }, notifyTimeout);
    };

    while (1) {
      // first part
      const pairs = generateWordPairs(user.validationKey, rows * collumns);
      const r = (await sendMessage(
        msgPrefix + (repeatCnt > 0 ? "Выберите новое слово" : "Выберите слово"),
        pairs.map((v) => v.one)
      )) as Message.TextMessage;

      message_id = r.message_id;
      //todo start timer here and wait for 1 minutes
      const e = await service.onGotCallbackQuery(user.checkBotChatId);
      const gotWord = (e.result.callback_query as CallbackQuery.DataCallbackQuery)?.data;
      const trueWordPair = gotWord && pairs.find((v) => v.one === gotWord);
      if (!trueWordPair) {
        await service.core.sendMessage({ chat_id: user.checkBotChatId, text: "Упс, я поломался. Давайте ещё раз" });
        return false;
      }

      // second part
      const nextObj = generateWordPairsNext(user.validationKey, trueWordPair, pairs, true);
      await sendMessage(
        `Выберите ассоциацию`,
        nextObj.pairs.map((v) => v.two)
      );

      const e2 = await service.onGotCallbackQuery(user.checkBotChatId);
      const gotWord2 = (e2.result.callback_query as CallbackQuery.DataCallbackQuery)?.data;
      if (gotWord2 === nextObj.expected) {
        ++validTimes;
        if (validTimes >= expectedValidTimes) {
          msgPrefix = arrayGetRandomItem(answersExpected_2);
          if (!user.validationFile) {
            // init 2step validation
            await sendMessage(msgPrefix + uploadFileInstructions, null);
            // todo resetWaitTimeoutHere (because of loading file takes a time)
            // todo wait for any update and lock user ???
            const res = await service.onGotFile(user.checkBotChatId);
            await service.core.deleteMessageForce({
              chat_id: res.result.message.chat.id,
              message_id: res.result.message.message_id,
            });
            user.validationFile = res.result.file;
          } else if (invalidTimes) {
            // 2step validation
            // todo also special command to force validation via file
            await sendMessage(msgPrefix + ". " + askFile, null);
            const res = await service.onGotFile(user.checkBotChatId);
            await service.core.deleteMessageForce({
              chat_id: res.result.message.chat.id,
              message_id: res.result.message.message_id,
            });
            if (UserItem.isFilesEqual(user.validationFile, res.result.file)) {
              await sendMessage(arrayGetRandomItem(answersExpected_2), null);
            } else {
              await sendMessage(arrayGetRandomItem(answersFalse), null);
              console.log(`User ${user.id} failed validation via file and locked`);
              cancelSession(false);
              return false;
            }
          } else {
            await sendMessage(msgPrefix, null);
          }
          cancelSession(true);
          return true;
        } else {
          msgPrefix = arrayGetRandomItem(answersExpected_1) + ". Давайте повторим. ";
        }
      } else {
        validTimes = 0;
        ++invalidTimes;
        if (gotWord2 === nextObj.truthy) {
          msgPrefix = arrayGetRandomItem(answersTrue);
        } else {
          msgPrefix = arrayGetRandomItem(answersFalse);
        }
        if (invalidTimes >= expectedInvalidTimes) {
          await sendMessage(msgPrefix, null);
          console.log(`User ${user.id} failed validation and locked: invalidTimes = ${invalidTimes}`);
          cancelSession(false);
          return false;
        } else {
          msgPrefix += ". ";
        }
      }
      ++repeatCnt;
    }
  } catch (err) {
    if (err.name !== "repeat") {
      console.error("CheckBot error. " + err.message || err);
    }
  }
  return null;
}
