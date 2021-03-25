import arrayMapToTableByColumn from "../helpers/arrayMapToTableByColumn";
import Repo from "../repo";
import { EventTypeEnum, MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import { expectedInvalidTimes, validationTimeout, validationTimeoutMinutes } from "../userCheckBot/playValidation";

const regTimeoutMinutes = 10;
const regTimeout = regTimeoutMinutes * 60000;
const destroyKeyTimeout = 15 * 1000;
const destroyInstructionsTimeoutSec = 120 * 1000;

function getInstructionsText(botName: string) {
  return [
    "Проверка проходит следующим образом (это легко запомнить, сохранять текст запрещено):\n",
    `1) пишите боту @${botName} и начинаете играть`,
    "2) из предложенного списка слов выбирайте любое",
    "3) из последующего списка ассоциаций важно выбрать слово согласно вашему ключу",
    "\nК примеру ваш ключ '2 танка'",
    "В списке ассоциаций вы находите любое слово, которое начинается с буквы 'Т' (первая буква вашего ключа) и отсчитываете 2 слова (2 - цифра вашего ключа)",
    "\nПримечания:",
    "* если при счёте нужно выбрать слово на 8-м месте, а всего их 6, - то ответ = слово на 2-м месте (счёт продолжается с начала списка - по кругу)",
    "* каждый раз проверку нужно пройти дважды",
    `* на проверку выделено ${validationTimeoutMinutes}мин (с того момента как выберите 1-е слово) и ${expectedInvalidTimes} попытки`,
    "* если проверка провалена - вы это узнаете по тому, что бот перестанет отвечать (типа поломался). Также узнают те, кто прошёл проверку и имеет с вами связь (через бота или чат)",
    "* если вы прошли проверку и решили продолжить играть не по правилам описанным выше - будете заблокированы автоматически",
    "* если вы заблокированы - нет возможности разблокировать (скоро реализуем)",
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

async function registerUser(ctx: Parameters<MyBotCommand["callback"]>["0"]): Promise<boolean> {
  ctx.removeAnyByUpdate = true;
  ctx.setTimeout(regTimeout);

  const user = ctx.user;
  user.nickName = ctx.initMessage.from.username as string;
  user.firstName = ctx.initMessage.from.first_name as string;
  user.lastName = ctx.initMessage.from.last_name as string;
  user.termyBotChatId = ctx.chatId;

  await ctx.sendMessage(
    {
      text: `На регистрацию отведено ${regTimeout}мин. На некоторые инструкции время ещё меньше. Время уже пошло...`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "Начнём регистрацию", callback_data: "OK" }]],
      },
    },
    { removeTimeout: destroyKeyTimeout }
  );

  await ctx.sendMessage(
    {
      text: `Ваш ключ:\n\n<b>"${user.validationKey.num} ${user.validationKey.word}"</b>\n\nЗапомните его.`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "ОК", callback_data: "OK" }]],
      },
    },
    { removeTimeout: destroyKeyTimeout }
  );
  await ctx.onGotEvent(EventTypeEnum.gotUpdate);

  console.log(`\n Start registration with new user ${user.id}`);

  const botName = await CheckBot.getMyUserName();
  await ctx.sendMessage(
    {
      text: getInstructionsText(botName),
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: getInstructionsMarkup() },
    },
    { removeTimeout: destroyInstructionsTimeoutSec }
  );
  await ctx.onGotEvent(EventTypeEnum.gotUpdate);
  await ctx.sendMessage({
    text: `Инструктаж окончен. Давайте сыграем: @${botName}.\nПримечание: если бот не отвечает - используйте команду /start`,
  });

  CheckBot.service
    .onGotEvent(EventTypeEnum.gotNewMessage, (v) => v.from.id == ctx.user.id)
    .then(() => {
      // disable timeout
      ctx.setTimeout(0);
    });
  const isValid = await CheckBot.validateUser(user);
  if (isValid) {
    Repo.addOrUpdateUser(user);
    console.log(`\nRegistration of user ${user.id} ${user.toLinkName()} is finished`);
  }

  await ctx.sendMessage(
    {
      text: isValid ? botRegisterInstructions : `Вы не прошли проверку. Регистрация отклонена`,
      reply_markup: {
        inline_keyboard: [[{ text: "ОК", callback_data: "OK" }]],
      },
    },
    { removeMinTimeout: 3000 }
  );

  return !!isValid;
}

export default registerUser;
