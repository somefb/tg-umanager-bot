import { MyChatMember } from "../chatItem";
import dateToPastTime from "../helpers/dateToPastTime";
import processNow from "../helpers/processNow";
import Repo from "../repo";
import { CommandRepeatBehavior, IBotContext, MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem, { IUser } from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";
import countAllTask from "./countAllTask";

const cache = new Map<number, number>();

export function getUserStatus(user: UserItem | undefined, m: IUser, isAnonym: boolean, isFinished: boolean): string {
  let status: string;
  let icon: string;
  if (!user) {
    icon = "❗️";
    status = "не зарегистрирован";
  } else if (user.isLocked) {
    icon = "❌";
    status = `заблокирован ${dateToPastTime(user.validationDate)}`;
  } else if (user._isValid) {
    icon = "✅";
    status = `проверен ${dateToPastTime(user.validationDate)}`;
  } else if (isFinished) {
    icon = "❗️";
    status = `не отвечает/заблокирован бот ${dateToPastTime(user.validationDate)}`;
  } else {
    //todo show CheckBot is blocked immediately
    icon = "⏳";
    status = `ожидаю... ${dateToPastTime(user.validationDate)}`;
  }

  const uLink = UserItem.ToLink(m.id, m.userName, m.firstName, m.lastName, isAnonym);
  return `${icon} ${uLink} - ${status}`;
}

export async function reportValidation(ctx: IBotContext, specificUsers: IUser[] | null): Promise<void> {
  ctx.singleMessageMode = true;
  ctx.setTimeout(0);

  let nextTime = 0;
  let nextTask: NodeJS.Timeout | undefined;
  const initUserLink = ctx.userLink;
  let prevText: string;
  let hasLocked = false;

  let getMembers: () => MyChatMember[];
  if (specificUsers) {
    const arr: MyChatMember[] = specificUsers.map<MyChatMember>((u) => ({ ...u, isBot: false, isAnonym: false }));
    getMembers = () => arr;
  } else {
    getMembers = () =>
      Object.keys(ctx.chat.members)
        .map((key) => ctx.chat.members[key])
        .filter((m) => !m.isBot);
  }

  const report = async (isFinished = false) => {
    //wait for 5 sec between each report
    // todo throttle requires testing
    const now = processNow();
    if (nextTime && now < nextTime) {
      if (!nextTask) {
        const ms = nextTime - now;
        return new Promise((resolve) => {
          nextTask = setTimeout(() => {
            nextTask = undefined;
            report(isFinished).then(resolve);
          }, ms);
        });
      } else if (isFinished) {
        clearTimeout(nextTask);
      } else {
        return;
      }
    }
    nextTime = now + 5000;

    const arr: string[] = ctx.chat.isGroup
      ? [
          `${initUserLink} запросил cтатус ${specificUsers ? "определенных " : ""}пользовател${
            specificUsers?.length === 1 ? "ей" : "я"
          }❗️\n`,
        ]
      : [];

    getMembers().forEach((m) => {
      const user = Repo.getUser(m.id);
      if (user?.isLocked) {
        hasLocked = true;
      }
      const str = getUserStatus(user, m, m.isAnonym, isFinished);
      arr.push(str);
    });

    hasLocked &&
      arr.push("\nДля разблокирования - команда /unlock (блокированный пользователь не может общаться с ботом)");

    isFinished && arr.push("\nПроверка окончена");

    const text = arr.join("\n");
    if (prevText !== text) {
      prevText = text;
      await ctx.sendMessage(
        {
          text,
          parse_mode: "HTML",
          disable_notification: true,
        },
        {
          keepAfterSession: true,
          removeByUpdate: !ctx.chat.isGroup,
          removeTimeout: ctx.chat.isGroup ? undefined : 5 * 60000,
        }
      );
    }
  }; // end: report()

  const arr: Promise<unknown>[] = [];
  getMembers().forEach((m) => {
    const user = Repo.getUser(m.id);
    if (user) {
      // reset validation state because isValid related to expiryDate
      user._isValid = user.isValid;
      if (!user._isValid) {
        arr.push(CheckBot.validateUser(user).then(() => report()));
      }
    }
  });

  await report();

  // update report every minute
  const timer = setInterval(() => report(), 60000);
  ctx.onCancelled().then(() => clearInterval(timer));

  // todo such promises can't be destroyed
  await Promise.all(arr);
  await report(true);
}

const Check: MyBotCommand = {
  command: "check",
  type: MyBotCommandTypes.group,
  isHidden: true,
  description: "проверить участников",
  repeatBehavior: CommandRepeatBehavior.none,
  callback: async (ctx) => {
    const now = processNow();
    const expiry = cache.get(ctx.chatId);
    if (expiry && now < expiry) {
      console.warn("Command check declined by rule: cache 1min");
      await ctx.sendMessage(
        { text: "Команда /check была вызвана меньше минуты назад", disable_notification: true },
        { keepAfterSession: true, removeTimeout: 5000 }
      );
      return;
    } else {
      cache.set(ctx.chatId, now + 60000);
    }

    countAllTask(ctx);
    //wait for previous partial report from task
    // todo we need to wait getChatAdministrators
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await reportValidation(ctx, null);
  },
};

export default Check;
