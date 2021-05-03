import { ApiError } from "typegram/api";
import ErrorCancelled from "../errorCancelled";
import arrayGetRandomItem from "../helpers/arrayGetRandomItem";
import arrayMapToTableByColumn from "../helpers/arrayMapToTableByColumn";
import Repo from "../repo";
import { EventTypeEnum, IBotContext, NewCallbackQuery, NewFileMessage } from "../types";
import UserItem from "../userItem";
import { generateWordPairs, generateWordPairsNext } from "./dictionary";

// WARN: rows*columns > max ukey.num (defined in dictionary.ts)
const rows = 4;
const collumns = 3;

// validation section here
const expectedValidTimes = 2; // twice in the row
export const expectedInvalidTimes = 3; // total possible == twice
export const validationTimeoutPartyMinutes = 2;
export const validationTimeoutMinutes = expectedValidTimes * validationTimeoutPartyMinutes;
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
  ".\nИ напоследок передайте мне любой уникальный файл (картинка/фото, аудио/голосовое, текстовый - абсолютно любой).",
  "▪️ файл должен быть уникальным для вас, но бесполезным и бесмысленным для остальных",
  "▪️ сохраните его в доступном для вас месте и не теряйте никогда",
  "\nВсякий раз, как вы проходите игру с ошибкой, а также с некоторой периодичностью, бот будет выдавать сообщение:",
  `\n<b>${askFile}</b>\n`,
  "Запомните этот вопрос❗️",
  "На него нужно передать мне тот самый файл (каждый раз когда увидите этот вопрос). Ни в коем случае не отвечайте текстом - только файлом (иначе будете заблокированы). Прочтите ещё раз и запомните❗️",
  `\nЯ жду ваш файл в течение ${Math.floor(timeoutFirstFile / 60000)} минут...`,
].join("\n");

const enum CancelReason {
  sucсess,
  file,
  invalidTimes,
  timeout,
}

export const checkWaitResponseStr = "10ч";
export const checkWaitResponse = 10 * 60 * 60000; //wait for 10 hours for the first response

export default async function playValidation(ctx: IBotContext, skipAskForPlay = false): Promise<void> {
  ctx.singleMessageMode = true;
  ctx.setTimeout(checkWaitResponse);
  //todo we should remove by this timeout

  const isFirstTime = !ctx.user.validationDate;

  let validTimes = 0;
  let invalidTimes = 0;
  let msgPrefix = "";
  let repeatCnt = 0;

  if (!skipAskForPlay) {
    await askForPlay(ctx);
  }
  delete ctx.user.isCheckBotChatBlocked;

  // play game block
  try {
    while (1) {
      // first part
      const pairs = generateWordPairs(ctx.user.validationKey, rows * collumns);
      let gotWord = await sendAndWait(
        ctx,
        msgPrefix + (isFirstTime ? "Выберите любое слово" : repeatCnt > 0 ? "Выберите новое слово" : "Выберите слово"),
        pairs.map((v) => v.one),
        isFirstTime ? validationTimeout * 5 : validationTimeout
      );

      const trueWordPair = gotWord && pairs.find((v) => v.one === gotWord);
      if (!trueWordPair) {
        await ctx.sendMessage({ text: "Упс... Давайте ещё раз" });
        return;
      }

      // second part
      const nextObj = generateWordPairsNext(ctx.user.validationKey, trueWordPair, pairs, true);
      gotWord = "";
      while (!gotWord) {
        gotWord = await sendAndWait(
          ctx,
          isFirstTime ? "Выберите вашу ассоциацию❗️❗️❗️" : "Выберите ассоциацию❗️",
          nextObj.pairs.map((v) => v.two),
          null
        );
        if (!nextObj.pairs.find((v) => v.two === gotWord)) {
          await ctx.sendMessage({ text: "Упс... Давайте ещё раз" });
          return;
        }
      }

      if (isFirstTime && gotWord !== nextObj.expected) {
        ctx.singleMessageMode = false;
        ctx.setTimeout(validationTimeout * 5);
        await ctx.sendAndWait(
          {
            text: `Неправильно. Ожидаю '${nextObj.expected}'.\nПорядок сверху-вниз!\nНачнём заново!`,
            reply_markup: { inline_keyboard: [[{ callback_data: "Ok", text: "Ok" }]] },
          },
          { removeByUpdate: true, removeTimeout: validationTimeout }
        );
        ctx.singleMessageMode = true;
        invalidTimes = 0;
        validTimes = 0;
        continue;
      }
      if (gotWord === nextObj.expected) {
        ++validTimes;
        if (validTimes >= expectedValidTimes) {
          msgPrefix = arrayGetRandomItem(answersExpected_2);
          if (!ctx.user.validationFile) {
            // init 2step validation
            ctx.setTimeout(timeoutFirstFile);
            await ctx.sendMessage({ text: msgPrefix + uploadFileInstructions });
            ctx.setTimeout(timeoutFirstFile);
            const res = await ctx.onGotEvent(EventTypeEnum.gotFile);
            await ctx.deleteMessage(res.message_id);
            ctx.user.validationFile = res.file;
          } else if (invalidTimes) {
            // 2step validation
            ctx.setTimeout(timeoutFile);
            await ctx.sendMessage({ text: msgPrefix + " " + askFile });
            ctx.setTimeout(timeoutFile);

            let res: NewFileMessage | undefined;
            // WARN: important not to wait event
            ctx
              .onGotEvent(EventTypeEnum.gotFile)
              .then((v) => (res = v))
              .catch();
            await ctx.onGotEvent(EventTypeEnum.gotUpdate);
            res && (await ctx.deleteMessage(res.message_id));

            if (!res || !UserItem.isFilesEqual(ctx.user.validationFile, res.file)) {
              console.log(`User ${ctx.user.id} failed validation via file and locked`);
              await cancelSession(ctx, true, isFirstTime, CancelReason.file);
              return;
            }
          }
          await cancelSession(ctx, true, isFirstTime, CancelReason.sucсess);
          return;
        } else {
          msgPrefix = arrayGetRandomItem(answersExpected_1) + ". Давайте повторим. ";
        }
      } else {
        validTimes = 0;
        ++invalidTimes;
        if (gotWord === nextObj.truthy) {
          msgPrefix = arrayGetRandomItem(answersTrue);
        } else {
          msgPrefix = arrayGetRandomItem(answersFalse);
        }
        if (invalidTimes >= expectedInvalidTimes) {
          console.log(`User ${ctx.user.id} failed validation and locked: invalidTimes = ${invalidTimes}`);
          await cancelSession(ctx, false, isFirstTime, CancelReason.invalidTimes);
          return;
        } else {
          msgPrefix += ". ";
        }
      }
      ++repeatCnt;
    } // while(1)
  } catch (err) {
    if ((err as ErrorCancelled).isTimeout) {
      console.log(`User ${ctx.user.id} failed validation and locked: timeout is over`);
      await cancelSession(ctx, false, isFirstTime, CancelReason.timeout);
    }
    throw err;
  }
}

async function sendAndWait(
  ctx: IBotContext,
  text: string,
  words: string[],
  restartTimeoutMs: number | null
): Promise<string | undefined> {
  const msg = await ctx.sendMessage({
    text,
    reply_markup: {
      inline_keyboard: arrayMapToTableByColumn(words, rows, collumns, (v) => ({
        text: v,
        callback_data: v,
      })),
    },
  });
  if (restartTimeoutMs) {
    ctx.setTimeout(restartTimeoutMs);
  }

  let q: NewCallbackQuery | null = null;
  while (!q) {
    q = await ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);
    if (q.message?.message_id !== msg.message_id) {
      q = null;
    }
  }
  return q.data;
}

async function cancelSession(ctx: IBotContext, isValid: boolean, isFirstTime: boolean, reason: CancelReason) {
  // WARN: validationDate set inside
  ctx.user.isValid = isValid;
  let text: string;
  if (!isValid) {
    ctx.user.isLocked = true;
    // todo such timeouts is not ideal because 1) poor internet connection 2) bad proxy 3) ETIMEDOUT
    // for timeoutError we can allow user to recover via file
    text = isFirstTime
      ? `${reason === CancelReason.timeout ? "Время истекло. " : ""}Вы не прошли игру! \n`
      : "На сегодня всё!";
  } else {
    text = isFirstTime ? "Спасибо. Можете вернуться в предыдущий чат с ботом \n" : "Спасибо за игру";
  }
  const msg = await ctx.sendMessage({ text }, { removeMinTimeout: notifyDeleteLastTimeout, removeTimeout: 30 * 1000 });
  Repo.commit();
  await ctx.clearChat(msg.message_id - 1);
}

async function askForPlay(ctx: IBotContext) {
  let timer: NodeJS.Timeout | undefined;
  let removeMessageId: number | undefined;

  const sendQuestion = async (silent = false) => {
    // notify to play after 1hour
    timer = setTimeout(async () => {
      removeMessageId && (await ctx.deleteMessage(removeMessageId));
      removeMessageId = undefined;
      timer = undefined;
      await sendQuestion();
    }, 59 * 60000); //ask every 59min

    try {
      const msg = await ctx.sendMessage({
        text: "Поиграем?",
        reply_markup: { inline_keyboard: [[{ text: "Да", callback_data: "/go" }]] },
        disable_notification: silent,
      });
      removeMessageId = msg.message_id;
    } catch (error) {
      const err = error as ApiError;
      if (err.error_code === 403) {
        // error_code: 403, description: 'Forbidden: user is deactivated' when user is Deleted account
        // error_code: 403, description: 'Forbidden: bot was blocked by the user'
        if (err.description.includes("deactivated")) {
          Repo.removeUser(ctx.user.id);
          timer && clearTimeout(timer);
          ctx.cancel(`User ${ctx.user.toLink()} deleted account`);
        } else if (err.description.includes("blocked")) {
          ctx.user.isCheckBotChatBlocked = true;
          timer && clearTimeout(timer);
        } else {
          throw error;
        }
      }
      return null;
    }
  };

  await sendQuestion();
  ctx.onCancelled().finally(() => timer && clearTimeout(timer));
  // wait for any response because user can remove previous message by mistake
  await ctx.onGotEvent(EventTypeEnum.gotUpdate);

  timer && clearTimeout(timer);
  timer = undefined;
}
