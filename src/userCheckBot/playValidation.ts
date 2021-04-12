import ErrorCancelled from "../errorCancelled";
import arrayGetRandomItem from "../helpers/arrayGetRandomItem";
import arrayMapToTableByColumn from "../helpers/arrayMapToTableByColumn";
import { EventTypeEnum, IBotContext } from "../types";
import UserItem from "../userItem";
import { generateWordPairs, generateWordPairsNext } from "./dictionary";

// WARN: rows*columns > max ukey.num (defined in dictionary.ts)
const rows = 4;
const collumns = 3;

// validation section here
const expectedValidTimes = 2; // twice in the row
export const expectedInvalidTimes = 3; // total possible == twice
export const validationTimeoutMinutes = 1;
export const validationTimeout = validationTimeoutMinutes * 60000; //1 minute
const timeoutFile = 5 * 60000; // 5 minute
const timeoutFirstFile = 15 * 60000;
const notifyDeleteLastTimeout = 60000; //1 minute

const answersTrue = ["Верно", "Правильно", "Хорошо"];
const answersFalse = ["Увы", "Неверно", "Неправильно"];

const answersExpected_1 = ["Невероятно", "Хм", "Интересно", "Забавно", "Необычно"];
const answersExpected_2 = ["Ладно-ладно!", "А вы настойчивы!", "Вы сделали невозможное!"];
const askFile = "Понравилась игра?";

const uploadFileInstructions = [
  ".\nИ напоследок передайте мне любой уникальный файл (картинка/фото, аудио/голосовое, текстовый).",
  "* файл должен быть уникальным для вас, но абсолютно бесполезным для остальных",
  "* сохраните его в доступном для вас месте и не теряйте никогда!",
  "\nВсякий раз как вы проходите игру с ошибкой, а также с некоторой периодичностью, бот будет выдавать сообщение:",
  `<b>${askFile}</b>`,
  "на это сообщение нужно передать боту (мне) тот самый файл.",
  `\nЯ жду ваш файл в течение ${timeoutFirstFile / 60000} минут...`,
].join("\n");

export default async function playValidation(ctx: IBotContext): Promise<boolean | null> {
  ctx.singleMessageMode = true;
  ctx.setTimeout(validationTimeout);
  const isFirstTime = !ctx.user.validationDate;

  const sendMessage = async (text: string, words: string[] | null) => {
    const args: Parameters<IBotContext["sendMessage"]>["0"] = {
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

    await ctx.sendMessage(args);

    //todo detect if chat is blocked and somehow notify user
  };

  let validTimes = 0;
  let invalidTimes = 0;
  let msgPrefix = "";
  let repeatCnt = 0;

  const cancelSession = async (isValid: boolean) => {
    ctx.user.isValid = isValid;
    if (!isValid) {
      // todo implement unlock behavior
      ctx.user.isLocked = true;
      await ctx.sendMessage(
        {
          text: isFirstTime ? "Вы не прошли игру! \n" : "На сегодня всё!",
        },
        { removeMinTimeout: notifyDeleteLastTimeout, removeTimeout: 30 * 1000 }
      );
    } else {
      await ctx.sendMessage(
        {
          text: isFirstTime ? "Спасибо. Можете вернуться в предыдущий чат с ботом \n" : "Спасибо за игру",
        },
        { removeMinTimeout: notifyDeleteLastTimeout, removeTimeout: 30 * 1000 }
      );
    }
  };

  try {
    while (1) {
      // first part
      const pairs = generateWordPairs(ctx.user.validationKey, rows * collumns);
      await sendMessage(
        msgPrefix + (repeatCnt > 0 ? "Выберите новое слово" : "Выберите слово"),
        pairs.map((v) => v.one)
      );

      ctx.setTimeout(validationTimeout);
      const gotWord = (await ctx.onGotEvent(EventTypeEnum.gotCallbackQuery)).data;
      const trueWordPair = gotWord && pairs.find((v) => v.one === gotWord);
      if (!trueWordPair) {
        await ctx.sendMessage({ text: "Упс, я поломался. Давайте ещё раз" });
        return false;
      }

      // second part
      const nextObj = generateWordPairsNext(ctx.user.validationKey, trueWordPair, pairs, true);
      await sendMessage(
        `Выберите ассоциацию`,
        nextObj.pairs.map((v) => v.two)
      );

      const gotWord2 = (await ctx.onGotEvent(EventTypeEnum.gotCallbackQuery)).data;
      if (isFirstTime && gotWord2 !== nextObj.expected) {
        ctx.singleMessageMode = false;
        ctx.setTimeout(validationTimeout * 5);
        await ctx.sendMessage(
          {
            text: `Неправильно. Ожидаю '${nextObj.expected}'.\nПорядок сверху-вниз!\nНачнём заново!`,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ callback_data: "Ok", text: "Ok" }]] },
          },
          { removeByUpdate: true, removeTimeout: validationTimeout }
        );
        ctx.singleMessageMode = true;
        await ctx.onGotEvent(EventTypeEnum.gotUpdate);
        invalidTimes = 0;
        validTimes = 0;
        ctx.setTimeout(validationTimeout);
        continue;
      }
      if (gotWord2 === nextObj.expected) {
        ++validTimes;
        if (validTimes >= expectedValidTimes) {
          msgPrefix = arrayGetRandomItem(answersExpected_2);
          if (!ctx.user.validationFile) {
            // init 2step validation
            await sendMessage(msgPrefix + uploadFileInstructions, null);
            ctx.setTimeout(timeoutFirstFile);
            const res = await ctx.onGotEvent(EventTypeEnum.gotFile);
            await ctx.deleteMessage(res.message_id);
            ctx.user.validationFile = res.file;
          } else if (invalidTimes) {
            // 2step validation
            // todo also special command to force validation via file
            ctx.setTimeout(timeoutFile);
            await sendMessage(msgPrefix + ". " + askFile, null);
            const res = await ctx.onGotEvent(EventTypeEnum.gotFile);
            await ctx.deleteMessage(res.message_id);

            if (UserItem.isFilesEqual(ctx.user.validationFile, res.file)) {
              await sendMessage(arrayGetRandomItem(answersExpected_2), null);
            } else {
              await sendMessage(arrayGetRandomItem(answersFalse), null);
              console.log(`User ${ctx.user.id} failed validation via file and locked`);
              await cancelSession(false);
              return false;
            }
          } else {
            await sendMessage(msgPrefix, null);
          }
          await cancelSession(true);
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
          console.log(`User ${ctx.user.id} failed validation and locked: invalidTimes = ${invalidTimes}`);
          await cancelSession(false);
          return false;
        } else {
          msgPrefix += ". ";
        }
      }
      ++repeatCnt;
    } // while(1)
  } catch (err) {
    if ((err as ErrorCancelled).isCancelled) {
      console.log(`User ${ctx.user.id} failed validation and locked: timeout is over`);
      await cancelSession(false);
      return false;
    }
    console.error("CheckBot error. " + err.message || err);
  }

  return null;
}
