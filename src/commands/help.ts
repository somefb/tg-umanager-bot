import { MyBotCommand } from "../types";
import { MyBotCommandTypes, MyBotCommandTypesDescription } from "./botCommandTypes";

const CommandHelp: MyBotCommand = {
  command: "help",
  type: MyBotCommandTypes.common,
  isHidden: true,
  description: "справка",
  callback: async (msg, service) => {
    const lines: string[] = ["Добро пожаловать. Доступны следующие команды\n"];

    Object.keys(MyBotCommandTypes).forEach((key) => {
      const cType = MyBotCommandTypes[key];
      lines.push(`<b>${MyBotCommandTypesDescription[key]}</b>`);
      service.cfg.commands.forEach((c) => {
        if (cType === c.type) {
          lines.push(`${c.command} - ${c.description}`);
        }
      });
      lines.push("");
    });

    await service.core.sendMessage({
      chat_id: msg.chat.id,
      disable_notification: true,
      text: lines.join("\n"),
      parse_mode: "HTML",
      //reply_markup: ""
    });
  },
};

export default CommandHelp;
