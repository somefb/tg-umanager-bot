import arrayMapToTableByColumn from "../helpers/arrayMapToTableByColumn";
import Repo from "../repo";
import { EventTypeEnum, IBotContext } from "../types";
import { CheckBot } from "../userCheckBot";
import { declinateWord } from "../userCheckBot/dictionary";
import { expectedInvalidTimes, validationTimeoutMinutes } from "../userCheckBot/playValidation";

const regTimeoutMinutes = 10;
const regTimeout = regTimeoutMinutes * 60000;
const destroyKeyTimeout = 30 * 1000; //30sec
const destroyInstructionsTimeout = 2 * 60000; //2min

export function getInstructionsText(botName: string): string {
  return [
    "Проверка проходит следующим образом (это легко запомнить, сохранять текст запрещено):\n",
    `1) пишите боту ${botName} (не сейчас, позже) и начинаете играть`,
    "2) из предложенной таблицы (списка) слов выбирайте любое❗️",
    "3) из последующей таблицы ассоциаций выбираете согласно вашему ключу (ни в коем случае не выбирайте правильную ассоциацию)❗️",
    "\nК примеру ваш ключ '3 танка'",
    "В таблице ассоциаций отсчитываете 3 слова (3 - цифра вашего ключа) от слова с буквой 'Т' в начале (первая буква вашего ключа)",
    "\nПримечания:",
    "* если нужно выбрать слово на 8-м месте, а всего их 6, то продолжаем счёт с начала таблицы - по кругу",
    "* каждый раз проверку нужно пройти дважды",
    `* на проверку выделено ${validationTimeoutMinutes}мин (с того момента как выберите 1-е слово) и ${expectedInvalidTimes} попытки`,
    "* если проверка провалена (сообщение 'На сегодня всё!' ❗️) - вы заблокированы",
    "* если прошли проверку и решили продолжить играть не по правилам описанным выше - вы заблокированы",
    "* если заблокированы - будете автоматически удалены из чатов, бот вам перестанет отвечать, а пользователи получат инструкции, как разблокировать",
    "\nНиже приведён пример с ключом '3 танка'. Обратите внимание на порядок слов (счёт сверху-вниз, по столбцам)❗️.",
    "Слова пронумерованы только для ознакомления. В последующем нумерации не будет",
  ].join("\n");
}

export function getInstructionsMarkup(): { text: string; callback_data: string }[][] {
  const arr = arrayMapToTableByColumn(
    ["1) вера", "2) Тиран (точка отсчёта = 0)", "3) анис (+1)", "4) маслина (+2)", "5) дерево (ваш ответ)", "6) куст"],
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

function botRegisterInstructions(wasLocked = false) {
  return [
    `${
      wasLocked ? "Пере-регистрация" : "Регистрация"
    } завершена.\nТеперь вам доступен расширенный набор команд. Используйте /help`,
    "\nНекоторые команды бота доступны/видимы в течение 5 минут после проверки",
    "По истечении времени играйте снова, чтобы получить доступ к командам",
    "Не забывайте чистить чат по окончании!",
  ].join(". ");
}

async function registerUser(ctx: IBotContext, ctxReport: IBotContext): Promise<boolean> {
  ctx.singleMessageMode = true;
  ctx.setTimeout(regTimeout);

  const user = ctx.user;
  user.userName = ctx.initMessage.from.username;
  user.firstName = ctx.initMessage.from.first_name as string;
  user.lastName = ctx.initMessage.from.last_name;
  user.termyBotChatId = ctx.chatId;

  const report = (msg: string) => {
    return ctxReport.sendMessage({
      text: `${user.toLink()} ${msg}`,
      parse_mode: "HTML",
    });
  };

  const wasLockedUser = user.isLocked;

  await ctx.sendMessage({
    text: `На инструктаж отведено ~${regTimeoutMinutes}мин. Внимательно читайте всё по несколько раз!`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: `Начнём ${wasLockedUser ? "пере-" : ""}регистрацию`, callback_data: "OK" }]],
    },
  });
  await report("проходит инструктаж...");
  ctx.setTimeout(regTimeout);

  await ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);
  await ctx.sendMessage(
    {
      text: `Ваш ключ:\n\n<b>"${declinateWord(user.validationKey)}"</b>\n\nЗапомните его.`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "ОК", callback_data: "OK" }]],
      },
    },
    { removeTimeout: destroyKeyTimeout }
  );
  await ctx.onGotEvent(EventTypeEnum.gotUpdate);

  console.log(`\nStart registration with new user ${user.id}`);

  const botName = CheckBot.service.botUserName;
  await ctx.sendMessage({
    text: getInstructionsText(botName),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: getInstructionsMarkup() },
  });
  await ctx.onGotEvent(EventTypeEnum.gotUpdate);
  await ctx.sendMessage({
    text: `Инструктаж окончен. Давайте сыграем: @${botName}.\nПримечание: если бот не отвечает - используйте команду /start`,
  });

  await report("прошёл инструктаж");

  await CheckBot.service
    //command /start is expected
    .onGotEvent(EventTypeEnum.gotBotCommand, (v) => v.from.id == user.id)
    .then((v) => {
      user.checkBotChatId = v.chat.id;
      // disable timeout
      ctx.setTimeout(0);
    });
  await report("играет...");

  user.isLocked = false;
  user.validationDate = 0;
  user.validationFile = undefined;
  const isValid = await CheckBot.validateUser(user);
  if (isValid) {
    Repo.addOrUpdateUser(user);
    console.log(`\nRegistration of user ${user.id} ${user.toLink()} is finished`);
  }

  await ctx.sendMessage(
    {
      text: isValid
        ? botRegisterInstructions(wasLockedUser)
        : `Вы не прошли проверку. ${wasLockedUser ? "Пере-регистрация" : "Регистрация"} отклонена}`,
      reply_markup: {
        inline_keyboard: [[{ text: "ОК", callback_data: "OK" }]],
      },
    },
    { removeByUpdate: true, removeTimeout: destroyInstructionsTimeout, keepAfterSession: true }
  );

  return !!isValid;
}

export default registerUser;
