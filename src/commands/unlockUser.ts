import { Message } from "typegram";
import BotContext from "../botContext";
import ErrorCancelled from "../errorCancelled";
import { CommandRepeatBehavior, EventTypeEnum, FileInfo, IBotContext, MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";
import registerUser from "./registerUser";
import { getInstructionsText } from "./shareBot";

const notifyTimeout = 60 * 1000; //60 sec

const UnlockUser: MyBotCommand = {
  command: "unlock",
  type: MyBotCommandTypes.personal,
  isHidden: true,
  description: "разблокировать пользователя",
  repeatBehavior: CommandRepeatBehavior.skip,
  callback: async (ctx) => {
    ctx.removeAllByCancel = true;
    ctx.singleMessageMode = true;

    let targetUser: UserItem | undefined;

    while (!targetUser) {
      ctx.setTimeout();
      targetUser = (await ctx.askForUser("Кого разблокируем?")) as UserItem;
      if (!targetUser.isLocked) {
        ctx.singleMessageMode = false;
        await ctx.sendMessage(
          { text: `${UserItem.ToLinkUser(targetUser)} не блокирован`, parse_mode: "HTML" },
          { removeTimeout: 5000, removeByUpdate: true }
        );
        targetUser = undefined;
        ctx.singleMessageMode = true;
      }
    }

    await ctx.sendMessage({
      text: getInstructionsText(true, targetUser),
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: ctx.getCallbackCancel() }]] },
    });

    // send previous voice file
    ctx.singleMessageMode = false;
    let hasVoice = !!targetUser.validationVoiceFile;
    if (targetUser.validationVoiceFile) {
      try {
        const v = await ctx.service.core.sendVoice({
          chat_id: ctx.chatId,
          voice: targetUser.validationVoiceFile?.file_id,
        });
        hasVoice = true;
        ctx.onCancelled().then(() => ctx.deleteMessage((v.ok && v.result.message_id) || 0));
      } catch (error) {
        hasVoice = false;
        console.error(error);
      }
    }
    if (!hasVoice) {
      await ctx.sendMessage({
        text:
          "Первичный голосовой файл отсутствует. Вы можете идентифицировать пользователя, только если сами знаете его голос!",
      });
    }
    ctx.singleMessageMode = true;

    // wait for new voiceFile
    let newValidationVoiceFile;
    while (!newValidationVoiceFile) {
      ctx.setTimeout();
      const r = await ctx.onGotEvent(EventTypeEnum.gotFile);
      ctx.setTimeout();
      await ctx.deleteMessage(r.message_id);

      if ((r as Message.VoiceMessage).voice) {
        newValidationVoiceFile = r.file;
        break;
      }

      await ctx.sendMessage({
        text: "Я ожидаю только голосовое сообщение...",
        reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: ctx.getCallbackCancel() }]] },
      });
    } //while

    ctx.singleMessageMode = true;
    await ctx.sendMessage(
      {
        text: `В течение ${BotContext.defSessionTimeoutStr} ${targetUser.toLink()} может написать боту @${
          ctx.botUserName
        } /start и пройти пере-регистрацию.\nТакже вы можете продолжить посылать команды боту (я мультизадачный)"`,
        parse_mode: "HTML",
      },
      { keepAfterSession: true }
    );

    //WARN: it's important not to wait for task
    unlockTask(ctx, targetUser, newValidationVoiceFile);
  },
};

async function unlockTask(ctx: IBotContext, targetUser: UserItem, validationVoiceFile: FileInfo) {
  let success = false;
  setTimeout(() => {
    ctx.name = "_unlockReport";
  });

  try {
    // wait for new user connection to this bot
    while (1) {
      try {
        await ctx.service.core.sendMessage({
          chat_id: targetUser.termyBotChatId,
          text: "Используйте команду /start",
        });
        await ctx.sendMessage({ text: "Ожидаю ответа пользователя..." });
      } catch {}
      const msgRegUser = await ctx.service.onGotEvent(
        EventTypeEnum.gotBotCommand,
        (_v, chatId) => targetUser.termyBotChatId === chatId,
        BotContext.defSessionTimeout
      );

      targetUser.validationKey = CheckBot.generateUserKey();
      targetUser.validationVoiceFile = validationVoiceFile;
      const ctxUser = ctx.service.initContext(targetUser.termyBotChatId, "_unlock", msgRegUser, targetUser);
      success = !!(await ctxUser.callCommand((c) => registerUser(c, ctx)));
      //todo if success => return to chats
      break;
    }
  } catch (err) {
    if (!(err as ErrorCancelled).isCancelled) {
      console.error(err);
    }
  }

  // send report to previous chat
  await ctx.sendMessage(
    {
      text: success
        ? `${targetUser.toLink()} снова в строю`
        : `${targetUser.toLink()} не прошёл пере-регистрацию. Чтобы разблокировать пользователя повторите команду снова`,
      parse_mode: "HTML",
    },
    { removeTimeout: notifyTimeout, removeByUpdate: true, keepAfterSession: true }
  );
  ctx.cancel("end");
}

export default UnlockUser;
