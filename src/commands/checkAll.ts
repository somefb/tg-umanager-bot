import ErrorCancelled from "../errorCancelled";
import { CommandRepeatBehavior, EventTypeEnum, MyBotCommand, NewCallbackQuery } from "../types";
import { MyBotCommandTypes } from "./botCommandTypes";

const CheckAll: MyBotCommand = {
  command: "check_all",
  type: MyBotCommandTypes.group,
  isHidden: true,
  description: "проверить участников",
  repeatBehavior: CommandRepeatBehavior.restart,
  callback: async (ctx) => {
    // todo:bug new any command will destroy it but should only this command
    ctx.setTimeout(0);

    const r1 = await ctx.service.core.getChatMembersCount({ chat_id: ctx.chatId });
    // WARN: excluded Me from count
    let membersCnt = (r1.ok && r1.result) || 0;
    const r2 = await ctx.service.core.getChatAdministrators({ chat_id: ctx.chatId });
    const admins = (r2.ok && r2.result) || [];

    admins.forEach((v) => {
      const isMe = v.user.is_bot && v.user.username === ctx.botUserName;
      !isMe && ctx.chat.addOrUpdateMember(v.user, !!v.is_anonymous);
    });

    let definedCnt = ctx.chat.calcVisibleMembersCount() + 1;

    if (membersCnt > definedCnt) {
      ctx.singleMessageMode = true;
      const sendCount = (cnt: number) => {
        const names = Object.keys(ctx.chat.members)
          .map((k) => ctx.chat.members[k])
          .filter((v) => !v.isAnonym)
          .map((v) => (v.lastName ? v.firstName + " " + v.lastName : v.firstName))
          .sort();
        return ctx.sendMessage({
          text: [`Определено ${cnt} из ${membersCnt} участников\n`, "Я", ...names].join("\n"),
          parse_mode: "HTML",
        });
      };
      await sendCount(definedCnt);
      ctx.singleMessageMode = false;
      const m = await ctx.sendMessage({
        text: [
          "Я не имею доступа к списку участников (ограничение телеграмма), однако вижу всех администраторов.",
          "\nЕсли среди участников есть другой бот (не администратор) и его нет в списке выше - удалите и добавьте его, или временно измените ему права...",
          "\nПомогите обнаружить вас...",
        ].join("\n"),
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Я здесь", callback_data: "im" }]],
        },
      });
      ctx.singleMessageMode = true;

      // (async () => {
      let evRef: Promise<NewCallbackQuery>;
      ctx.chat.onChatMembersCountChanged = (inc) => {
        membersCnt += inc;
        const eData: Partial<NewCallbackQuery> = { data: "im" };
        ctx.removeEvent(evRef);
        ctx.getListener(evRef)?.resolve(eData as NewCallbackQuery);
      };

      ctx.setTimeout(12 * 60 * 60000); // 12 hours
      try {
        while (1) {
          evRef = ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);
          const q = await evRef;
          if (q.data != "im") {
            continue;
          }
          q.id && (await ctx.service.core.answerCallbackQuery({ callback_query_id: q.id, text: "Спасибо" }));
          const newCount = ctx.chat.calcVisibleMembersCount() + 1;

          if (newCount >= membersCnt) {
            ctx.deleteMessage(m.message_id);
            break;
          } else if (newCount !== definedCnt) {
            definedCnt = newCount;
            await sendCount(definedCnt);
          }
        }
      } catch (err) {
        if (!(err as ErrorCancelled).isCancelled) {
          console.error(err);
        }
      }
      // })();
    }
    ctx.chat.onChatMembersCountChanged = undefined;

    await ctx.sendMessage({ text: "А теперь приступим к регистрации..." });

    // else if (allCnt < definedAllCnt) {
    //   console.warn("Chat: some members are removed without mine detection");
    // }
  },
};

export default CheckAll;
