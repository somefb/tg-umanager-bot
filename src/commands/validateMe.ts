import cfg from "../appSettingsGet";
import arrayMapToTableByColumn from "../helpers/arrayMapToTableByColumn";
import Repo from "../repo";
import { MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";

const destroyKeyTimeoutSec = 15;
const destroyInstructionsTimeoutSec = 120;

function getInstructionsText(botName: string) {
  return [
    "Проверка проходит следующим образом:\n",
    `1) вы пишите боту @${botName} и начинаете играть`,
    "2) из предложенного списка слов выбирайте любое",
    "3) из последующего списка ассоциаций важно выбрать слово согласно вашему ключу",
    "\nК примеру ваш ключ '2 танка'",
    "В списке ассоциаций вы находите любое слово, которое начинается с буквы 'Т' (первая буква вашего ключа) и отсчитываете 2 слова (2 - цифра вашего ключа)",
    "\nПримечания:",
    "* если при счёте нужно выбрать слово на 8-м месте, а всего их 6, - то ответ = слово на 2-м месте (счёт продолжается с начала списка - по кругу)",
    "* каждый раз проверку нужно пройти дважды",
    "* на проверку выделена 1 минута (с того момента как выберите 1-е слово) и 3 попытки",
    "* если проверка провалена - вы это узнаете по тому, что бот перестанет отвечать (типа поломался). Также узнают те, кто прошёл проверку и имеет с вами связь (через бота или чат)",
    "* бот не может удалить персональный чат (ограничение телеграмма). Потому удаляйте такой чат с ботом каждый раз самостоятельно",
    "* если вы прошли проверку и решили продолжить играть не по правилам описанным выше - вы будете заблокированы автоматически",
    "* если вы заблокированы - Пока нет возможности разблокировать (скоро реализуем)",
  ].join("\n");
}

function getInstructionsMarkup() {
  const arr = arrayMapToTableByColumn(
    ["1) вера", "2) Тиран (точка отсчёта)", "3) анис", "4) маслина (ваш ответ)", "5) дерево", "6) куст"],
    3,
    2,
    (v) => ({
      text: v,
      callback_data: v,
    })
  );

  arr.push([{ text: "Всё понятно. Начнём проверку", callback_data: "go" }]);
  return arr;
}

// todo this is test command - remove after tests
const ValidateMe: MyBotCommand = {
  command: "validate_me",
  type: MyBotCommandTypes.personal,
  description: "проверь меня",
  callback: async (msg, service) => {
    const chat_id = msg.chat.id;
    //todo try catch ?
    //todo remove all commands automatically
    await service.core.deleteMessageForce({ chat_id, message_id: msg.message_id });

    const uid = msg.from?.id;
    let user = Repo.getUser(uid);
    if (!user) {
      if (!Repo.users?.length && uid === cfg.ownerUserId) {
        const key = CheckBot.generateUserKey();
        const r = await service.sendSelfDestroyed(
          {
            chat_id,
            text: `Ваш ключ:\n\n"${key.num} ${key.word}"\n\nЗапомните его.`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[{ text: "ОК", callback_data: "OK" }]],
            },
          },
          destroyKeyTimeoutSec
        );
        if (r.ok) {
          user = new UserItem(cfg.ownerUserId, key);
          //todo uncomment
          //Repo.users.push(user);
          console.log("registered user");

          const botName = await CheckBot.getMyUserName();
          await service.sendSelfDestroyed(
            {
              chat_id,
              text: getInstructionsText(botName),
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: getInstructionsMarkup() },
            },
            destroyInstructionsTimeoutSec
          );
          await service.sendSelfDestroyed(
            {
              chat_id,
              text: `Инструктаж окончен. Давайте сыграем: @${botName}`,
            },
            destroyInstructionsTimeoutSec
          );
        }
      } else {
        // todo remove this because access to bot will be restricted
        console.warn(`User ${msg.from?.username} ${uid} is not registered`);
      }
    }

    if (user) {
      const isValid = await CheckBot.validateUser(user);
      console.warn("got Invalid", isValid);
      service.core.sendMessage({
        chat_id,
        text: isValid ? "Проверка пройдена" : "Провалено",
      });
    }
  },
};

export default ValidateMe;
