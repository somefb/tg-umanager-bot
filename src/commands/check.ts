import dateToPastTime from "../helpers/dateToPastTime";
import processNow from "../helpers/processNow";
import Repo from "../repo";
import { CommandRepeatBehavior, MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";
import countAllTask from "./countAllTask";

const Check: MyBotCommand = {
  command: "check",
  type: MyBotCommandTypes.group,
  isHidden: true,
  description: "проверить участников",
  repeatBehavior: CommandRepeatBehavior.restart,
  callback: async (ctx) => {
    countAllTask(ctx);
    //wait for previous partial report from task
    // todo we need to wait getChatAdministrators
    await new Promise((resolve) => setTimeout(resolve, 1000));

    ctx.singleMessageMode = true;
    ctx.setTimeout(0);

    let nextTime = 0;
    let nextTask: NodeJS.Timeout | undefined;
    const initUserLink = ctx.userLink;
    let prevText: string;
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
        }
        return;
      }
      nextTime = now + 5000;

      const arr = [`${initUserLink} запросил cтатус пользователей❗️\n`];
      Object.keys(ctx.chat.members).forEach((key) => {
        const m = ctx.chat.members[key];
        if (m.isBot) {
          return;
        }
        const user = Repo.getUser(m.id);
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
        } else {
          //todo show CheckBot is blocked
          //todo wrong if user doesn't respond in 10-12 hours
          icon = "⏳";
          status = `ожидаю... ${dateToPastTime(user.validationDate)}`;
        }

        const uLink = UserItem.ToLink(m.id, m.userName, m.firstName, m.lastName, m.isAnonym);
        arr.push(`${icon} ${uLink} - ${status}`);
      });

      isFinished && arr.push("\nПроверка окончена");
      const text = arr.join("\n");
      if (prevText !== text) {
        prevText = text;
        await ctx.sendMessage({
          text,
          parse_mode: "HTML",
          disable_notification: true,
        });
      }
    };

    const arr: Promise<unknown>[] = [];
    Object.keys(ctx.chat.members).forEach((key) => {
      const member = ctx.chat.members[key];
      const user = Repo.getUser(member.id);
      if (user) {
        // reset validation state because isValid relared to expiryDate
        user._isValid = user.isValid;
        arr.push(CheckBot.validateUser(user).then(() => report()));
      }
    });

    await report();

    // update report every minute
    const timer = setInterval(() => report(), 60000);
    ctx.onCancelled().then(() => clearInterval(timer));

    await Promise.all(arr);
    await report(true);
  },
};

export default Check;
