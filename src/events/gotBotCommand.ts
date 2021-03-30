import appSettings from "../appSettingsGet";
import registerUser from "../commands/registerUser";
import Repo from "../repo";
import TelegramService from "../telegramService";
import { NewTextMessage } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";

export default function gotBotCommand(this: TelegramService, msg: NewTextMessage, chat_id: number): boolean {
  const text = msg.text;
  let end: number | undefined = text.indexOf(" ", 1);
  if (end === -1) {
    end = undefined;
  }
  const textCmd = text.substring(0, end);
  const cmd = this.commands.find((c) => c.command === textCmd);
  if (cmd) {
    const user = Repo.getUser(msg.from.id);
    // todo: bug don't allow private commands in groupChat
    // todo: bug allow group commands in groupChat for any user
    //if (user && (allowCommand || (cmd.allowCommand && cmd.allowCommand()))) {
    if (user?.isValid) {
      this.core.deleteMessageForce({ chat_id, message_id: msg.message_id });

      const ctx = this.getContext(chat_id, msg, user);
      ctx.callCommand(cmd.callback);
    } else {
      process.env.DEBUG && console.log(`Decline command. User ${msg.from.id} is not registered or invalid`);
    }
    return true;
  } else if (textCmd === appSettings.ownerRegisterCmd && !Repo.hasAnyUser) {
    this.core.deleteMessageForce({ chat_id, message_id: msg.message_id });
    const newUser = new UserItem(msg.from.id, CheckBot.generateUserKey());

    const ctx = this.getContext(chat_id, msg, newUser);
    ctx.callCommand(registerUser);

    return true;
  }
  return false;
}
