import Repo from "../repo";
import { CommandRepeatBehavior, EventTypeEnum, MyBotCommand } from "../types";
import UserItem, { IUser } from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";
import { reportValidation } from "./check";

const CommandCheckUser: MyBotCommand = {
  command: "check_user",
  type: MyBotCommandTypes.common,
  isHidden: true,
  description: "проверить пользователя",
  repeatBehavior: CommandRepeatBehavior.none,
  callback: async (ctx) => {
    ctx.removeAllByCancel = true;
    ctx.singleMessageMode = true;
    ctx.disableNotification = true;
    ctx.singleUserMode = true;

    let targetMember: IUser | undefined;
    let ulink = "";
    while (!targetMember) {
      targetMember = await ctx.askForUser("Кого проверяем?");
      ulink = UserItem.ToLinkUser(targetMember);

      if (!Repo.getUser(targetMember.id)) {
        targetMember = undefined;
        ctx.singleMessageMode = false;
        await ctx.sendMessage({ text: `${ulink} не зарегистрирован` }, { removeTimeout: 5000 });
        ctx.singleMessageMode = true;
      }
    }

    const msg = await ctx.sendMessage({
      text: `Проверить ${ulink}?`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Да", callback_data: "cuOk" },
            { text: "Отмена", callback_data: ctx.getCallbackCancel() },
          ],
        ],
      },
    });

    while (1) {
      const q = await ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);
      if (q.message?.message_id !== msg.message_id) {
        continue;
      }
    }

    await reportValidation(ctx, [targetMember]);

    // if (q.data === "cuOk") {
    //   ctx.setTimeout(0);
    //   const user = targetUser;
    //   let prevText = "";

    //   const report = async (isFinish: boolean) => {
    //     const text = getUserStatus(user, user, false, true);
    //     if (isFinish || prevText !== text) {
    //       prevText = text;
    //       const msg = await ctx.sendMessage(
    //         {
    //           text,
    //           parse_mode: "HTML",
    //           reply_markup: ctx.chat.isGroup
    //             ? { inline_keyboard: [[{ text: "Удалить из группы", callback_data: "cuK" }]] }
    //             : undefined,
    //         },
    //         isFinish ? { removeTimeout: ctx.chat.isGroup ? undefined : 3000 } : { keepAfterSession: true }
    //       );
    //       return msg.message_id;
    //     }
    //   };

    //   const msgId = await report(false);
    //   const timer = setInterval(() => report(false), 30000);

    //   ctx.onCancelled().then(() => {
    //     clearInterval(timer);
    //     report(true);
    //   });

    //   if (ctx.chat.isGroup) {
    //     (async () => {
    //       while (1) {
    //         const q = await ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);
    //         if (q.message?.message_id === msgId) {
    //           break;
    //         }
    //       }
    //       const ctxKick = ctx.service.initContext(ctx.chatId, "/" + CommandKick.command, ctx.initMessage, ctx.user);
    //       await kickUser(ctxKick, targetUser);
    //     })();
    //   }

    //   await CheckBot.validateUser(user);
    // }
  },
};

export default CommandCheckUser;
