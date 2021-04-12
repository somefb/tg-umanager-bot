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

function getInstructionsText(botName: string) {
  return [
    "Проверка проходит следующим образом (это легко запомнить, сохранять текст запрещено):\n",
    `1) пишите боту @${botName} и начинаете играть`,
    "2) из списка слов выбирайте любое",
    "3) из списка ассоциаций важно выбрать слово согласно ключу",
    "\nК примеру ваш ключ '2 танка'",
    "В списке ассоциаций находите слово начинающееся с буквы 'Т' (первая буква вашего ключа) и отсчитываете 2 слова (2 - цифра вашего ключа)",
    "\nПримечания:",
    "* если нужно выбрать слово на 8-м месте, а всего их 6, то продолжаем счёт с начала списка - по кругу",
    "* каждый раз проверку нужно пройти дважды",
    `* на проверку выделено ${validationTimeoutMinutes}мин (с того момента как выберите 1-е слово) и ${expectedInvalidTimes} попытки`,
    "* если проверка провалена (сообщение 'На сегодня всё!') - бот перестанет отвечать, пока вас не разблокируют",
    "* если вы прошли проверку и решили продолжить играть не по правилам описанным выше - будете заблокированы автоматически",
    "* если вы заблокированы - нет возможности разблокировать (скоро реализуем)",
    "\nНиже приведён пример с ключом '2 танка'. Обратите внимание на порядок слов (нумерация сверху-вниз)!",
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

const botRegisterInstructions = [
  "Регистрация завершена.\nТеперь вам доступен расширенный набор команд. Используйте /help",
  "\nНекоторые команды бота доступны/видимы в течение 5 минут после проверки",
  "По истечении времени играйте снова, чтобы получить доступ к командам",
  "Бот не может удалить персональный чат (ограничение телеграмма). Потому удаляйте такой чат с ботом каждый раз самостоятельно",
].join(". ");

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

  await report("проходит инструктаж...");

  await ctx.sendMessage({
    text: `На инструктаж отведено ~${regTimeoutMinutes}мин. Внимательно читайте всё по несколько раз!\nВремя уже пошло...`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "Начнём регистрацию", callback_data: "OK" }]],
    },
  });

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

  const isValid = await CheckBot.validateUser(user);
  if (isValid) {
    Repo.addOrUpdateUser(user);
    console.log(`\nRegistration of user ${user.id} ${user.toLink()} is finished`);
  }

  await ctx.sendMessage(
    {
      text: isValid ? botRegisterInstructions : `Вы не прошли проверку. Регистрация отклонена`,
      reply_markup: {
        inline_keyboard: [[{ text: "ОК", callback_data: "OK" }]],
      },
    },
    { removeByUpdate: true, removeTimeout: destroyInstructionsTimeout, keepAfterSession: true }
  );

  return !!isValid;
}

export default registerUser;
