import { MyChatMember } from "../chatItem";
import dateToPastTime, { dateDiffToTime } from "../helpers/dateToPastTime";
import processNow from "../helpers/processNow";
import Repo from "../repo";
import { CommandRepeatBehavior, IBotContext, MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import { checkWaitResponse } from "../userCheckBot/playValidation";
import UserItem, { IUser } from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";
import countAllTask from "./countAllTask";

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
  } else if (user.isCheckBotChatBlocked) {
    icon = "❗️";
    // todo wait unblock ???
    status = `бот заблокирован. ${dateToPastTime(user.validationDate)}`;
  } else if (isFinished) {
    icon = "❗️";
    status = `не отвечает. ${dateToPastTime(user.validationDate)}`;
  } else {
    icon = "⏳";
    //case when user re-register
    status = `ожидаю... ${user.validationDate ? dateToPastTime(user.validationDate) : ""}`;
  }

  const uLink = UserItem.ToLink(m.id, m.userName, m.firstName, m.lastName, isAnonym);
  return `${icon} ${uLink} - ${status}`;
}

export async function reportValidation(ctx: IBotContext, specificUsers: IUser[] | null): Promise<void> {
  ctx.singleMessageMode = true;
  ctx.setTimeout(0);
  const dtEnd = Date.now() + checkWaitResponse;

  let nextTime = 0;
  let nextTask: NodeJS.Timeout | undefined;
  const initUserLink = ctx.userLink;
  let prevText: string;

  let getMembers: () => MyChatMember[];
  if (specificUsers) {
    const arr: MyChatMember[] = specificUsers.map<MyChatMember>((u) => ({ ...u, isBot: false, isAnonym: false }));
    getMembers = () => arr;
  } else {
    getMembers = () =>
      Object.keys(ctx.chat.members)
        .map((key) => ctx.chat.members[key])
        .filter((m) => !m.isBot)
        .sort((a, b) => {
          if (a.isAnonym && b.isAnonym) {
            return a.firstName.localeCompare(b.firstName);
          } else if (a.isAnonym) {
            return -1;
          } else if (b.isAnonym) {
            return 1;
          }
          return a.firstName.localeCompare(b.firstName);
        });
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
      ? [`${initUserLink} запросил cтатус ${specificUsers ? "определенных " : ""}пользователей❗️\n`]
      : [];

    let hasLocked = false;
    getMembers().forEach((m) => {
      const user = Repo.getUser(m.id);
      if (user?.isLocked) {
        hasLocked = true;
      }
      const str = getUserStatus(user, m, m.isAnonym, isFinished);
      arr.push(str);
    });

    arr.push(
      `\nЧерез ${dateDiffToTime(Math.max(dtEnd - Date.now(), 1000))} удалю из группы тех, кто не начал на проверку!`
    );
    arr.push("Провалившие проверку, будут удаляться немедленно");
    // todo button kickAllNow
    // todo implement return back

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
  repeatBehavior: CommandRepeatBehavior.restart,
  callback: async (ctx) => {
    await countAllTask(ctx, true);
    //wait for previous partial report from task
    // todo we need to wait getChatAdministrators
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await reportValidation(ctx, null);
  },
};

export default Check;
