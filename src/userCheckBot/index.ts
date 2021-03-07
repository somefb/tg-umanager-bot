import { CallbackQuery, Message } from "typegram";
import arrayGetRandomItem from "../helpers/arrayGetRandomItem";
import arrayMapToTableByColumn from "../helpers/arrayMapToTableByColumn";
import { ITelegramService, MyBotCommand, Opts } from "../types";
import { generateWordPairs, generateWordPairsNext } from "./dictionary";

// warning: rows*columns > max ukey.num (defined in dictionary.ts)
const rows = 4;
const collumns = 3;

// validation section here
const expectedValidTimes = 2; // twice in the row
const expectedInvalidTimes = 3; // total possible == twice
//todo implement waitTimeout
const waitTimeout = 60 * 1000; //1 minute

const answersTrue = ["Неплохо", "Правильно", "Хорошо"];
const answersFalse = ["Увы", "Неверно", "Неправильно"];

const answersExpected_1 = ["Невероятно", "Хм", "Интересно", "Забавно", "Необычно"];
const answersExpected_2 = ["Ладно-ладно", "А вы настойчивы", "Вы сделали невозможное"];

// todo use answerCallbackQuery: https://core.telegram.org/bots/api#answercallbackquery
const CheckBotCommands: MyBotCommand[] = [
  {
    command: "start", //
    description: "Начать заново",
    callback: callbackStart,
  },
];
export default CheckBotCommands;

async function callbackStart(msg: Message.TextMessage, service: ITelegramService): Promise<void> {
  try {
    // todo remove previous if restart
    // todo don't allow to add bot to chat: use event onBotAddedToChat
    // todo uncomment
    // const user = Repo.getUser(msg.from?.id);
    // if (!user) {
    //   await service.core.sendMessage({
    //     chat_id: msg.chat.id,
    //     text: "Упс. Похоже я поломался",
    //   });
    //   await service.core.leaveChat({ chat_id: msg.chat.id });
    //   return;
    // }
    const chatId = msg.chat.id;
    let message_id = 0;

    const sendMessage = async (text: string, words: string[] | null) => {
      let res;
      const args: Opts<"sendMessage"> = {
        chat_id: msg.chat.id,
        text,
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
        await service.core.sendMessage({ chat_id: msg.chat.id, text: "Я поломался. Давайте ещё раз" });
        const err = new Error("Need to repeat");
        err.name = "Repeat";
        throw err;
      }

      return res.result;
    };

    const ukey = { num: 1, word: "волк" };

    let validTimes = 0;
    let invalidTimes = 0;
    let msgPrefix = "";
    while (1) {
      // first part
      const pairs = generateWordPairs(ukey, rows * collumns);
      const r = (await sendMessage(
        msgPrefix + "Выберите слово",
        pairs.map((v) => v.one)
      )) as Message.TextMessage;

      message_id = r.message_id;

      // wait for response
      const e = await service.onGotCallbackQuery((e) => e.callback_query.message?.chat.id === chatId);
      //todo start timer here and wait for 1 minutes
      const gotWord = (e.result.callback_query as CallbackQuery.DataCallbackQuery)?.data;
      const trueWordPair = gotWord && pairs.find((v) => v.one === gotWord);
      if (!trueWordPair) {
        await service.core.sendMessage({ chat_id: msg.chat.id, text: "Упс, я поломался. Давайте ещё раз" });
        return;
      }

      // second part
      const nextObj = generateWordPairsNext(ukey, trueWordPair, pairs, true);
      await sendMessage(
        `Выберите ассоциацию`,
        nextObj.pairs.map((v) => v.two)
      );

      const e2 = await service.onGotCallbackQuery((e) => e.callback_query.message?.chat.id === chatId);
      const gotWord2 = (e2.result.callback_query as CallbackQuery.DataCallbackQuery)?.data;
      if (gotWord2 === nextObj.expected) {
        ++validTimes;
        if (validTimes >= expectedValidTimes) {
          await sendMessage(arrayGetRandomItem(answersExpected_2), null);
          //todo timeout 10 sec and remove private chat
          break;
        } else {
          msgPrefix = arrayGetRandomItem(answersExpected_1) + ". Давайте повторим. ";
        }
      } else {
        validTimes = 0;
        ++invalidTimes;
        if (gotWord2 === nextObj.truthy) {
          await sendMessage(arrayGetRandomItem(answersTrue), null);
        } else {
          await sendMessage(arrayGetRandomItem(answersFalse), null);
        }
        if (invalidTimes >= expectedInvalidTimes) {
          // todo mark as invalid ???
          // todo mark as locked - requires more strict validation
          // todo timeout 10 sec and remove private chat
          break;
        }
      }
      console.warn("got result", JSON.stringify(r), r);
    }
  } catch (err) {
    if (err.name !== "repeat") {
      console.error("CheckBot error. " + err);
    }
  }
}
