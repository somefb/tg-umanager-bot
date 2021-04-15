import Repo from "../repo";
import { EventTypeEnum, IBotContext, NewCallbackQuery } from "../types";

export default async function countAllTask(initContext: IBotContext): Promise<void> {
  const ctx = initContext.service.initContext(initContext.chatId, "_cntAll", initContext.initMessage, initContext.user);
  await ctx.callCommand(countAll);
  return;
}

async function countAll(ctx: IBotContext) {
  ctx.setTimeout(12 * 60 * 60000); // 12 hours

  const r1 = await ctx.service.core.getChatMembersCount({ chat_id: ctx.chatId });
  // WARN: excluded Me from count
  let membersCnt = (r1.ok && r1.result) || 0;
  const r2 = await ctx.service.core.getChatAdministrators({ chat_id: ctx.chatId });
  const admins = (r2.ok && r2.result) || [];

  admins.forEach((v) => {
    const isMe = v.user.is_bot && v.user.username === ctx.botUserName;
    if (!isMe) {
      ctx.chat.addOrUpdateMember(v.user, !!v.is_anonymous);
      Repo.updateUser(v.user);
    }
  });
  // todo callback here to check
  let definedCnt = ctx.chat.calcVisibleMembersCount() + 1;

  if (membersCnt > definedCnt) {
    ctx.singleMessageMode = true;
    ctx.removeAllByCancel = true;

    const sendCount = (cnt: number) => {
      const names = Object.keys(ctx.chat.members)
        .map((k) => ctx.chat.members[k])
        .filter((v) => !v.isAnonym)
        .map((v) => (v.lastName ? v.firstName + " " + v.lastName : v.firstName))
        .sort();
      return ctx.sendMessage({
        text: [`Определено ${cnt} из ${membersCnt} участников (анонимные считаются отдельно)`, "Я", ...names].join(
          "\n"
        ),
        parse_mode: "HTML",
        disable_notification: true,
      });
    };

    await sendCount(definedCnt);

    ctx.singleMessageMode = false;

    await ctx.sendMessage({
      text: [
        "Я не имею доступа к списку участников (ограничение телеграмма), однако вижу всех администраторов.",
        "\nЕсли среди участников есть другой бот (не администратор) и его нет в списке выше - удалите и добавьте его, или временно измените ему права...",
        "\nПомогите обнаружить вас...",
      ].join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "Я здесь", callback_data: "im" }]],
      },
      disable_notification: true,
    });
    ctx.singleMessageMode = true;

    let evRef: Promise<NewCallbackQuery>;
    ctx.chat.onChatMembersCountChanged = (inc) => {
      membersCnt += inc;
      const eData: Partial<NewCallbackQuery> = { data: "im" };
      ctx.getListener(evRef)?.resolve(eData as NewCallbackQuery);
      ctx.removeEvent(evRef);
    };

    ctx.onCancelled().then(() => (ctx.chat.onChatMembersCountChanged = undefined));

    while (1) {
      evRef = ctx.onGotEvent(EventTypeEnum.gotCallbackQuery);
      const q = await evRef;
      if (q.data != "im") {
        continue;
      }
      q.id && (await ctx.service.core.answerCallbackQuery({ callback_query_id: q.id, text: "Спасибо" }));
      const newCount = ctx.chat.calcVisibleMembersCount() + 1;

      if (newCount >= membersCnt) {
        break;
      } else if (newCount !== definedCnt) {
        definedCnt = newCount;
        await sendCount(definedCnt);
      }
    }

    await ctx.sendMessage(
      { text: "Все участники определены!", disable_notification: true },
      { removeMinTimeout: 10000 }
    );
  } else if (membersCnt !== definedCnt) {
    console.error("Error in countAll. membersCnt != definedCnt for chat: " + ctx.chatId);
  } else {
    process.env.DEBUG && console.log("Count of members is correct. Nothing to report");
  }
}
