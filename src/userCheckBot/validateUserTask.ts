import CheckBotCommands from ".";
import { ITelegramService } from "../types";
import UserItem from "../userItem";

export default async function validateUserTask(service: ITelegramService, user: UserItem): Promise<boolean | null> {
  try {
    if (user.isLocked) {
      console.warn(`User ${user.id} is locked. Validation is declined`);
      return false;
    }

    // possible when others calls validateUser();
    const c = service.getContexts(user.checkBotChatId);
    if (c) {
      for (const ctx of c.values()) {
        // if command === 'start' or 'go'
        if (ctx.name === CheckBotCommands[0].command || ctx.name === CheckBotCommands[1].command) {
          await ctx.onCancelled();
          return user.isValid;
        }
      }
    }

    const cmd = CheckBotCommands[0];
    const ctx = service.initContext(user.checkBotChatId, cmd.command, null, user);
    await ctx.callCommand(cmd.callback);
    return user.isValid;
  } catch (err) {
    console.error(err);
    return null;
  }
}
