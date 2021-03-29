import { Message } from "typegram";
import TelegramService from "../telegramService";
import { CheckBot } from "../userCheckBot";

/** Bot added to group chat */
export default function onMeAdded(this: TelegramService, msg: Message.NewChatMembersMessage, chat_id: number): void {
  if (this === CheckBot.service) {
    this.core.leaveChat({ chat_id });
    return;
  }

  if (this) {
    throw new Error("Not implemented yet");
  }
}
