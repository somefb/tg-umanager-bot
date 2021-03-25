import { MyBotCommand } from "../types";
import { MyBotCommandTypes, MyBotCommandTypesDescription } from "./botCommandTypes";

const destroyHelpTimeout = 5 * 60000;

const CommandHelp: MyBotCommand = {
  command: "help",
  type: MyBotCommandTypes.common,
  isHidden: false,
  description: "справка",
  callback: async (ctx) => {
    const lines: string[] = ["Добро пожаловать. Доступны следующие команды\n"];

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
      { removeTimeout: destroyHelpTimeout, removeByUpdate: true }
    );
  },
};

export default CommandHelp;
