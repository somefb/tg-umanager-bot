import arrayMapToTableByColumn from "../helpers/arrayMapToTableByColumn";
import Repo from "../repo";
import { MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";

const destroyKeyTimeoutSec = 15;
const destroyInstructionsTimeoutSec = 120;

function getInstructionsText(botName: string) {
  return [
    "Проверка проходит следующим образом:\n",
    `1) пишите боту @${botName} и начинаете играть`,
    "2) из предложенного списка слов выбирайте любое",
    "3) из последующего списка ассоциаций важно выбрать слово согласно вашему ключу",
    "\nК примеру ваш ключ '2 танка'",
    "В списке ассоциаций вы находите любое слово, которое начинается с буквы 'Т' (первая буква вашего ключа) и отсчитываете 2 слова (2 - цифра вашего ключа)",
    "\nПримечания:",
    "* если при счёте нужно выбрать слово на 8-м месте, а всего их 6, - то ответ = слово на 2-м месте (счёт продолжается с начала списка - по кругу)",
    "* каждый раз проверку нужно пройти дважды",
    "* на проверку выделена 1 минута (с того момента как выберите 1-е слово) и 3 попытки",
    "* если проверка провалена - вы это узнаете по тому, что бот перестанет отвечать (типа поломался). Также узнают те, кто прошёл проверку и имеет с вами связь (через бота или чат)",
    "*** бот не может удалить персональный чат (ограничение телеграмма). Потому удаляйте такой чат с ботом каждый раз самостоятельно",
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

  arr.push([{ text: "Всё понятно", callback_data: "go" }]);
  return arr;
}

const registerUser: MyBotCommand["callback"] = async (msg, service) => {
  const chat_id = msg.chat.id;
  await service.core.deleteMessageForce({ chat_id, message_id: msg.message_id });

  const uid = msg.from?.id;
  if (!msg.from || !uid) {
    console.warn("Impossbile to register. User id is not defined");
    return;
  }
  const key = CheckBot.generateUserKey();
  const user = new UserItem(uid, key);
  user.nickName = msg.from.username as string;
  user.firstName = msg.from.first_name as string;
  user.lastName = msg.from.last_name as string;
  user.termyBotChatId = chat_id;

  await service.sendSelfDestroyed(
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

  console.log(`Start registration with new user ${user.id}`);

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
  await service.notify(
    {
      chat_id,
      text: `Инструктаж окончен. Давайте сыграем: @${botName}.\nПримечание: если бот не отвечает - используйте команду @${botName}/start`,
    },
    destroyInstructionsTimeoutSec
  );

  const isValid = await CheckBot.validateUser(user);
  if (isValid) {
    // todo uncomment after tests
    false && Repo.users.push(user);
  }
  await service.sendSelfDestroyed(
    {
      chat_id,
      text: isValid ? `Регистрация завершена` : `Вы не прошли проверку. Регистрация отклонена. Повторите заново.`,
    },
    destroyKeyTimeoutSec
  );
};

export default registerUser;
