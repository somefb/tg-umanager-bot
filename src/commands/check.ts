import { InlineKeyboardButton } from "typegram";
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

export function getUserStatus(
  user: UserItem | undefined,
  m: IUser,
  isAnonym: boolean,
  isFinished: boolean,
  isStarted: boolean
): string {
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
  } else if (isStarted) {
    icon = "⏳";
    //case when user re-register
    status = `ожидаю... ${user.validationDate ? dateToPastTime(user.validationDate) : ""}`;
  } else {
    icon = "✔";
    status = `посл.раз ${user.validationDate ? dateToPastTime(user.validationDate) : ""}`;
  }

  const uLink = UserItem.ToLink(m.id, m.userName, m.firstName, m.lastName, isAnonym);
  return `${icon} ${uLink} - ${status}`;
}

export async function reportValidation(
  ctx: IBotContext,
  specificUsers: IUser[] | null,
  isStartChecking = true
): Promise<void> {
  ctx.singleMessageMode = true;
  ctx.setTimeout(0);
  const dtEnd = Date.now() + checkWaitResponse;

  let nextTime = 0;
  let nextTask: NodeJS.Timeout | undefined;
  const initUserLink = ctx.userLink;
  let prevText: string;
  let wasInvalidNotLocked = false;

  let getMembers: () => MyChatMember[];
  if (specificUsers) {
    const arr: MyChatMember[] = specificUsers.map<MyChatMember>((u) => ({ ...u, isBot: false, isAnonym: false }));
    getMembers = () => arr;
  } else {
    getMembers = () => ChatItem.getSortedMembers(ctx.chat.members);
  }

  const report = async (isFinished = false) => {
    //wait for 5 sec between each report
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
          `${initUserLink} запросил ${isStartChecking ? "проверку" : "cтатус"} ${
            specificUsers ? "определенных " : ""
          }пользователей❗️\n`,
        ]
      : ["Статус пользователей\n"];

    // show status of users
    let hasLocked = false;
    let hasInvalidNotLocked = false;

    getMembers().forEach((m) => {
      const user = Repo.getUser(m.id);
      if (user?.isLocked) {
        hasLocked = true;
      } else if (!user?._isValid) {
        hasInvalidNotLocked = true;
      }
      const str = getUserStatus(user, m, m.isAnonym, isFinished, isStartChecking);
      arr.push(str);
    });

    // show removed users in group
    if (ctx.chat.isGroup && !specificUsers) {
      const removed = ChatItem.getSortedMembers(ctx.chat.removedMembers);
      if (removed.length) {
        arr.push("\nУдалённые из группы");
        removed.forEach((m) => {
          const user = Repo.getUser(m.id);
          const str = getUserStatus(user, m, m.isAnonym, isFinished, isStartChecking);
          arr.push(str);
        });
      }
    }

    // show instructions
    (hasLocked || !isFinished) && arr.push("");
    if (!isFinished && isStartChecking) {
      arr.push(
        `▪️ Не начавших проверку удалю из всех групп через <b>${dateDiffToTime(Math.max(dtEnd - Date.now(), 1000))}</b>`
      );
      arr.push("Такие смогут вернуться по прохождению проверки");
      arr.push("▪️ Проваливших проверку, удалю из всех групп немедленно");
    }

    hasLocked && arr.push("\n▪️ Для разблокирования - команда /unlock ('блокированный' не может общаться с ботом)");
    isFinished && arr.push("\nПроверка окончена");

    const text = arr.join("\n");
    if (prevText !== text || wasInvalidNotLocked !== hasInvalidNotLocked) {
      prevText = text;
      wasInvalidNotLocked = hasInvalidNotLocked;

      const msg = await ctx.sendMessage(
        {
          text,
          // notify user in private chat by finish
          disable_notification: !(!ctx.chat.isGroup && isFinished),
          reply_markup: {
            inline_keyboard: [
              !isStartChecking
                ? [
                    {
                      text: "Начать проверку",
                      // todo max 64 bytes
                      callback_data: CommandCheckStart.command + " " + specificUsers?.map((v) => v.id).join(",") || "",
                    },
                  ]
                : undefined,
              !isFinished && ctx.chat.isGroup && hasInvalidNotLocked
                ? [{ text: "Удалить тех, кто не отвечает", callback_data: CommandKickInvalid.command }]
                : undefined,
            ].filter((v) => v) as InlineKeyboardButton[][],
          },
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

  if (isStartChecking) {
    // update report every minute
    const timer = setInterval(() => report(), 60000);
    ctx.onCancelled().then(() => clearInterval(timer));

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

    // todo such promises can't be destroyed
    await Promise.all(arr);
    await report(true);
  } else {
    await report();
  }
}

const CommandCheck: MyBotCommand = {
  command: "check",
  type: MyBotCommandTypes.group,
  isHidden: true,
  description: "проверить участников",
  repeatBehavior: CommandRepeatBehavior.restart,
  callback: async (ctx) => {
    await countAllTask(ctx, true);
    await reportValidation(ctx, null, false);
  },
};

export const CommandCheckStart: MyBotCommand = {
  command: "check_start",
  type: MyBotCommandTypes.common,
  isHidden: true,
  isHiddenHelp: true,
  description: "проверить участников (старт)",
  repeatBehavior: CommandRepeatBehavior.restart,
  callback: async (ctx) => {
    await ctx.deleteMessage(ctx.initMessageId);
    // parsing 'go_check userId1,userId2'
    const pointedUsers: IUser[] = ctx.initMessage.text
      .split(" ")[1]
      ?.split(/,/g)
      .map((v) => {
        const id = Number.parseInt(v, 10);
        return id ? Repo.getUser(id) || ctx.chat.members[id] : undefined;
      })
      .filter((v) => v) as IUser[];
    await reportValidation(ctx, pointedUsers?.length ? pointedUsers : null, true);
  },
};

export default CommandCheck;
