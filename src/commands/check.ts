import ChatItem, { MyChatMember } from "../chatItem";
import dateToPastTime, { dateDiffToTime } from "../helpers/dateToPastTime";
import processNow from "../helpers/processNow";
import Repo from "../repo";
import { CommandRepeatBehavior, IBotContext, MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import { checkWaitResponse } from "../userCheckBot/playValidation";
import UserItem, { IUser } from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";
import countAllTask from "./countAllTask";
import CommandKickInvalid from "./kickInvalid";

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
    getMembers = () => ChatItem.getSortedMembers(ctx.chat.members);
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

    // show status of users
    let hasLocked = false;
    let hasInvalidNotLocked = false;
    getMembers().forEach((m) => {
      const user = Repo.getUser(m.id);
      if (user?.isLocked) {
        hasLocked = true;
      } else if (user?._isValid) {
        hasInvalidNotLocked = true;
      }
      const str = getUserStatus(user, m, m.isAnonym, isFinished);
      arr.push(str);
    });

    // show removed users in group
    if (ctx.chat.isGroup && !specificUsers) {
      const removed = ChatItem.getSortedMembers(ctx.chat.removedMembers);
      if (removed.length) {
        arr.push("\nУдалённые из группы");
        removed.forEach((m) => {
          const user = Repo.getUser(m.id);
          const str = getUserStatus(user, m, m.isAnonym, isFinished);
          arr.push(str);
        });
      }
    }

    // show instructions
    (hasLocked || !isFinished) && arr.push("");
    if (!isFinished) {
      arr.push(
        `▪️ Не начавших проверку, удалю из всех групп через <b>${dateDiffToTime(
          Math.max(dtEnd - Date.now(), 1000)
        )}</b>`
      );
      arr.push("Такие смогут вернуться по прохождению проверки");
      arr.push("▪️ Проваливших проверку, удалю из всех групп немедленно");
    }

    hasLocked && arr.push("\n▪️ Для разблокирования - команда /unlock ('блокированный' не может общаться с ботом)");
    isFinished && arr.push("\nПроверка окончена");

    const text = arr.join("\n");
    if (prevText !== text) {
      prevText = text;

      const msg = await ctx.sendMessage(
        {
          text,
          // notify user in private chat by finish
          disable_notification: !(!ctx.chat.isGroup && isFinished),
          reply_markup:
            !isFinished && ctx.chat.isGroup && hasInvalidNotLocked
              ? {
                  inline_keyboard: [
                    [{ text: "Удалить тех, кто не отвечает", callback_data: CommandKickInvalid.command }],
                  ],
                }
              : undefined,
        },
        {
          keepAfterSession: true,
          removeByUpdate: !ctx.chat.isGroup,
          removeTimeout: ctx.chat.isGroup ? undefined : 5 * 60000,
        }
      );

      if (ctx.chat.isGroup && isFinished) {
        ctx.singleMessageMode = false;
        await ctx.sendMessage(
          {
            text: "Проверка окончена",
            disable_notification: false,
            reply_to_message_id: msg.message_id,
          },
          { keepAfterSession: true }
        );
        ctx.singleMessageMode = true;
      }
    }
  }; // end: report()

  const arr: Promise<unknown>[] = [];
  const marr = getMembers();
  if (!specificUsers) {
    for (const id in ctx.chat.removedMembers) {
      marr.push(ctx.chat.removedMembers[id]);
    }
  }
  marr.forEach((m) => {
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

const CommandCheck: MyBotCommand = {
  command: "check",
  type: MyBotCommandTypes.group,
  isHidden: true,
  description: "проверить участников",
  repeatBehavior: CommandRepeatBehavior.restart,
  callback: async (ctx) => {
    await countAllTask(ctx, true);
    //wait for previous partial report from task
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await reportValidation(ctx, null);
  },
};

export default CommandCheck;
