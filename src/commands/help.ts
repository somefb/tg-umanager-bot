import { CommandRepeatBehavior, MyBotCommand } from "../types";
import { validationExpiry } from "../userItem";
import { MyBotCommandTypes, MyBotCommandTypesDescription } from "./botCommandTypes";

const CommandHelp: MyBotCommand = {
  command: "help",
  type: MyBotCommandTypes.common,
  isHidden: false,
  description: "справка",
  repeatBehavior: CommandRepeatBehavior.none,
  callback: async (ctx) => {
    const lines: string[] = [];
    if (!ctx.chat.isGroup) {
      const leftMs = Date.now() - ctx.user.validationDate;
      const leftMinutes = Math.floor(leftMs / 60000);
      const leftSec = Math.floor((leftMs - leftMinutes * 60000) / 1000);
      lines.push(
        `Добро пожаловать. В течение ${leftMinutes}мин ${leftSec}сек доступны следующие команды \n(по истечении времени пройдите проверку снова)\n`
      );
    } else {
      lines.push("Доступны следующие команды\n");
    }

    Object.keys(MyBotCommandTypes).forEach((key) => {
      const cType = MyBotCommandTypes[key];
      lines.push(`<b>${MyBotCommandTypesDescription[key]}</b>`);
      ctx.service.cfg.commands.forEach((c) => {
        if (cType === c.type) {
          lines.push(`${c.command} - ${c.description}`);
        }
      });
      lines.push("");
    });

    await ctx.sendMessage(
      {
        disable_notification: true,
        text: lines.join("\n"),
        parse_mode: "HTML",
        //reply_markup: ""
      },
      { removeTimeout: validationExpiry, removeByUpdate: true, keepAfterSession: true }
    );
  },
};

export default CommandHelp;
