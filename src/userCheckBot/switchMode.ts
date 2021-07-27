import { CommandRepeatBehavior, MyBotCommand } from "../types";
import validateUserTask from "./validateUserTask";

const CommandSwitchMode: MyBotCommand = {
  command: "switch_mode",
  description: "выбрать тип игры",
  isHidden: false,
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
        `Текущий режим игры: '${ctx.user.isGameModeEnglish ? "учим английский" : "ассоциации"}'`,
        "Выберите новый режим, если желаете!",
      ].join(".\n"),
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `Выбрать режим: '${!ctx.user.isGameModeEnglish ? "учим английский" : "ассоциации"}'`,
              callback_data: "ok",
            },
          ],
          [{ text: "Отмена", callback_data: ctx.getCallbackCancel() }],
        ],
      },
    });

    // toggle behavior
    if (ctx.user.isGameModeEnglish) {
      delete ctx.user.isGameModeEnglish;
    } else {
      ctx.user.isGameModeEnglish = true;
    }

    await ctx.sendMessage(
      { text: "Выбран новый режим! Хорошей игры" },
      { keepAfterSession: true, removeTimeout: 5000 }
    );
  },
};

export default CommandSwitchMode;
