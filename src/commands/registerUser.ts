import arrayMapToTableByColumn from "../helpers/arrayMapToTableByColumn";
import Repo from "../repo";
import { EventTypeEnum, IBotContext } from "../types";
import { CheckBot } from "../userCheckBot";
import { declinateWord } from "../userCheckBot/dictionary";
import {
  checkWaitResponseStr,
  expectedInvalidTimes,
  validationTimeoutMinutes,
  validationTimeoutPartyMinutes,
} from "../userCheckBot/playValidation";
import { validationExpiryStr } from "../userItem";

const regTimeoutMinutes = 10;
const regTimeout = regTimeoutMinutes * 60000;
const destroyKeyTimeout = 30 * 1000; //30sec
const destroyInstructionsTimeout = 2 * 60000; //2min

export function getInstructionsText(botName: string): string {
  return [
    "❗️Сохранять текст запрещено❗️",
    "\nВам будет выдан уникальный ключ, состоящий из цифры и слова. Ключ закрепляется за вами на всё время.",
    "\nК примеру ваш ключ '3 танка'.",
    `Пишем боту @${botName} (не сейчас, позже) и начинаем игру (несколько партий):`,
    "1) в первой таблице выбираем абсолютно любое слово",
    "2) во второй таблице, используя ключ, действуем по алгоритму:",
    " ▪️найдите слово на ту же первую букву, что и вашем ключе (T)",
    " ▪️cверху вниз по столбцам отсчитайте от него количество слов, указанное в ключе цифрой (3) и нажмите на слово",
    "\nНиже приведен наглядный пример второго пункта (нумерация только для ознакомления).",
    "* для ключа '5 танков', ответ был бы 'Вера'.", // Следовательно, когда заканчивается таблица, счёт продолжается с левого верхнего слова",
  ].join("\n");
}

export function getInstructionsMarkup(): { text: string; callback_data: string }[][] {
  const arr = arrayMapToTableByColumn(
    ["Вера", "Тиран (точка отсчёта)", "Анис (1)", "Маслина (2)", "Дерево (3; ваш ответ)", "Куст"],
    3,
    2,
    (v) => ({
      text: v,
      callback_data: v,
    })
  );

  arr.push([{ text: "Нажми меня, если всё понятно", callback_data: "go" }]);
  return arr;
}

export function getFinishInstructions(wasLocked = false): string {
  return [
    `${wasLocked ? "Пере-регистрация" : "Регистрация"} завершена.`,
    "\nТеперь вам доступны мои команды. Используйте /help для получения всего списка команд (часть скрыта из быстрого доступа)",
    `▪️ команды в личном чате доступны в течение ${validationExpiryStr} после проверки`,
    "▪️ если я 'проглатываю' команды - играйте снова (команда /start игрового бота), чтобы получить доступ",
    "▪️ если игровой бот не отвечает и 'проглатывает' команду /start - вероятно вы заблокированы. Ожидайте, когда с вами свяжуться коллеги (скоро реализуем команду /sos , чтобы вы могли связаться с ними без прямого контакта)",
    "Не забывайте чистить чат по окончании❗️",
    "\nПримечания:",
    "▪️ каждый раз проверку (через игру) нужно пройти несколько раз (несколько партий для исключения случайности)",
    `▪️ на проверку выделено ${validationTimeoutMinutes}мин (с того момента как выберите 1-е слово; по ${validationTimeoutPartyMinutes}мин на каждую партию) и ${expectedInvalidTimes} попытки`,
    `▪️ вы можете не начинать проверку немедленно, если вам неудобно. Бот ждёт ${checkWaitResponseStr}, после чего я автоматически удаляю вас из чатов. При прохождении проверки - верну назад`,
    "▪️ если проверка провалена (получите сообщение 'На сегодня всё!' ❗️) - вы заблокированы",
    "▪️ если прошли проверку и решили продолжить играть не по правилам упомянутым ранее - вы заблокированы",
    "▪️ если заблокированы - будете автоматически удалены из чатов, бот вам перестанет отвечать, а связанные с вами и проверенные мной пользователи (через регистрацию или чат) получат инструкции по разблокированию вас",
    "▪️ для смены ключа и уникального файла можете провалить проверку и попросить коллег разблокировать вас",
    // todo "▪️ если вы не успели пройти, т.к. было плохое интернет соединение ",
  ].join("\n");
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

  // wait for start
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
  console.log(`\nStart registration with new user ${user.id}`);

  // send 1st instructions
  const botName = CheckBot.service.botUserName;
  await ctx.sendMessage({
    text: getInstructionsText(botName),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: getInstructionsMarkup() },
  });
  await ctx.onGotEvent(EventTypeEnum.gotUpdate);

  // send key
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

  await ctx.sendMessage({
    text: `Инструктаж окончен. Давайте сыграем: @${botName}.\n* если бот не отвечает - используйте команду /start`,
  });
  await report("прошёл инструктаж");

  // play
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
        ? getFinishInstructions(wasLockedUser)
        : `Вы не прошли проверку. ${wasLockedUser ? "Пере-регистрация" : "Регистрация"} отклонена`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "ОК", callback_data: "OK" }]],
      },
    },
    { removeByUpdate: true, removeTimeout: destroyInstructionsTimeout, keepAfterSession: true }
  );

  return !!isValid;
}

export default registerUser;
