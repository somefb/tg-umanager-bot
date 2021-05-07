import { MyBotCommandTypes } from "../commands/botCommandTypes";
import { setNextDate } from "../helpers/setNextDate";
import { CommandRepeatBehavior, EventTypeEnum, MyBotCommand } from "../types";
import UserItem from "../userItem";
import validateUserTask from "./validateUserTask";

function twoDigits(v: number): string {
  return v < 10 ? "0" + v : v.toString();
}

function timeToString(v: number): string {
  const h = Math.floor(v / 60);
  const m = Math.floor(v - h * 60);
  return twoDigits(h) + ":" + twoDigits(m);
}

export function setNextValidationDate(user: UserItem): void {
  user.validationNextDate = setNextDate(user.validationScheduledTime);
}

const CommandSchedule: MyBotCommand = {
  command: "schedule",
  type: MyBotCommandTypes.personal,
  isHidden: false,
  description: "запланировать время игры",
  repeatBehavior: CommandRepeatBehavior.restart,
  allowCommand: (user) => !!user,
  callback: async (ctx) => {
    if (!ctx.user.isValid) {
      ctx.setTimeout(0);
      await validateUserTask(ctx.service, ctx.user);
      if (!ctx.user.isValid) {
        return;
      }
    }

    ctx.setTimeout();
    ctx.removeAllByCancel = true;
    ctx.singleMessageMode = true;

    await ctx.sendAndWait({
      text: [
        `Игра запланирована в ${timeToString(ctx.user.validationScheduledTime)}. Желаете поменять?`,
        "\n▪️ Eсли играли в 20:20, а запланировано на 20:50, то партию на 20:50 мы пропустим из-за ненадобности (допускается 30мин интервал)",
        "▪️ Игра может начаться с отклонением от заданного времени (из-за плохого интернета, к примеру)",
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Да", callback_data: "ok" },
            { text: "Нет", callback_data: ctx.getCallbackCancel() },
          ],
        ],
      },
    });

    await ctx.sendMessage({
      text: "Введите новое время, к примеру:\n<b>21 00</b>",
      reply_markup: {
        inline_keyboard: [[{ text: "Отмена", callback_data: ctx.getCallbackCancel() }]],
      },
    });

    while (1) {
      const msg = await ctx.onGotEvent(EventTypeEnum.gotNewMessage);
      const regArr = /([0-9]{1,2})[: \-_]([0-9]{1,2})/.exec(msg.text);
      await ctx.deleteMessage(msg.message_id);
      let errText: string;
      if (regArr) {
        const h = Number.parseInt(regArr[1], 10);
        const m = Number.parseInt(regArr[2], 10);
        if (Number.isNaN(h) || Number.isNaN(m)) {
          errText = "Неверно. Попробуйте снова";
        } else if (h > 23 || m > 59) {
          errText = "Неверно. Максимум 23:59";
        } else {
          ctx.user.validationScheduledTime = h * 60 + m;
          setNextValidationDate(ctx.user);
          break; // end and finish
        }
      } else {
        errText = "Неверно. Попробуйте снова";
      }

      ctx.singleMessageMode = false;
      await ctx.sendMessage({ text: errText }, { removeTimeout: 5000 });
      ctx.singleMessageMode = true;
    }

    await ctx.sendMessage(
      { text: `Игра запланирована в ${timeToString(ctx.user.validationScheduledTime)}` },
      { removeTimeout: 10000, keepAfterSession: true }
    );
  },
};

export default CommandSchedule;
