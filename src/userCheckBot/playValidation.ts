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
export const validationTimeoutMinutes = expectedValidTimes * 2;
export const validationTimeout = (validationTimeoutMinutes / 2) * 60000; // for each parti
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

const enum CancelReason {
  sucсess,
  file,
  invalidTimes,
  timeout,
}

export default async function playValidation(ctx: IBotContext): Promise<boolean | null> {
  ctx.singleMessageMode = true;
  ctx.setTimeout(10 * 60 * 60000); //wait for 10 hours for first response

  const isFirstTime = !ctx.user.validationDate;

  let validTimes = 0;
  let invalidTimes = 0;
  let msgPrefix = "";
  let repeatCnt = 0;

  const cancelSession = async (isValid: boolean, reason: CancelReason) => {
    ctx.user.isValid = isValid;
    if (!isValid) {
      ctx.user.isLocked = true;
      // todo such timeouts is not ideal because 1) poor internet connection 2) bad proxy 3) ETIMEDOUT
      // for timeoutError we can allow user to recover via file
      await ctx.sendMessage(
        {
          text: isFirstTime
            ? `${reason === CancelReason.timeout ? "Время истекло. " : ""}Вы не прошли игру! \n`
            : "На сегодня всё!",
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

  await ctx.sendMessage({
    text: "Поиграем?",
    reply_markup: { inline_keyboard: [[{ text: "Да", callback_data: "Ok" }]] },
  });

  await ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);

  try {
    while (1) {
      // first part
      const pairs = generateWordPairs(ctx.user.validationKey, rows * collumns);
      await sendMessage(
        ctx,
        msgPrefix + (isFirstTime ? "Выберите любое слово" : repeatCnt > 0 ? "Выберите новое слово" : "Выберите слово"),
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
        ctx,
        isFirstTime ? "Выберите правильную ассоциацию❗️" : "Выберите ассоциацию❗️",
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
        continue;
      }
      if (gotWord2 === nextObj.expected) {
        ++validTimes;
        if (validTimes >= expectedValidTimes) {
          msgPrefix = arrayGetRandomItem(answersExpected_2);
          if (!ctx.user.validationFile) {
            // init 2step validation
            await sendMessage(ctx, msgPrefix + uploadFileInstructions, null);
            ctx.setTimeout(timeoutFirstFile);
            const res = await ctx.onGotEvent(EventTypeEnum.gotFile);
            await ctx.deleteMessage(res.message_id);
            ctx.user.validationFile = res.file;
          } else if (invalidTimes) {
            // 2step validation
            ctx.setTimeout(timeoutFile);
            await sendMessage(ctx, msgPrefix + ". " + askFile, null);
            const res = await ctx.onGotEvent(EventTypeEnum.gotFile);
            await ctx.deleteMessage(res.message_id);

            if (!UserItem.isFilesEqual(ctx.user.validationFile, res.file)) {
              console.log(`User ${ctx.user.id} failed validation via file and locked`);
              await cancelSession(false, CancelReason.file);
              return false;
            }
          }
          await cancelSession(true, CancelReason.sucсess);
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
          console.log(`User ${ctx.user.id} failed validation and locked: invalidTimes = ${invalidTimes}`);
          await cancelSession(false, CancelReason.invalidTimes);
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
      await cancelSession(false, CancelReason.timeout);
      return false;
    }
    console.error("CheckBot error. " + err.message || err);
  }

  return null;
}

function sendMessage(ctx: IBotContext, text: string, words: string[] | null) {
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

  return ctx.sendMessage(args);

  //todo detect if chat is blocked and somehow notify user
}
