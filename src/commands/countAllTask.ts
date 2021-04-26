import Repo from "../repo";
import { EventTypeEnum, IBotContext, NewCallbackQuery } from "../types";

export default async function countAllTask(initContext: IBotContext, partialWait = false): Promise<void> {
  const ctx = initContext.service.initContext(initContext.chatId, "_cntAll", initContext.initMessage, initContext.user);
  await ctx.callCommand((ctx) => countAll(ctx, partialWait));
  return;
}

async function countAll(ctx: IBotContext, partialWait: boolean) {
  ctx.removeAllByCancel = true;
  ctx.setTimeout(12 * 60 * 60000); // 12 hours

  // todo telegram issue? returns 3 is 1 + 3 admins (2 anonym and 1 bot)
  const r1 = await ctx.service.core.getChatMembersCount({ chat_id: ctx.chatId });
  // WARN: excluded Me from count
  let membersCnt = (r1.ok && r1.result) || 0;
  const r2 = await ctx.service.core.getChatAdministrators({ chat_id: ctx.chatId });
  const admins = (r2.ok && r2.result) || [];

  const arrAnonym = new Set<number>();
  admins.forEach((v) => {
    const isMe = v.user.is_bot && v.user.username === ctx.botUserName;
    if (!isMe) {
      const isAnonym = !!v.is_anonymous;
      ctx.chat.addOrUpdateMember(v.user, isAnonym);
      Repo.updateUser(v.user);
      isAnonym && arrAnonym.add(v.user.id);
    }
  });

  Object.keys(ctx.chat.members).forEach((key) => {
    const v = ctx.chat.members[key];
    if (v.isAnonym && !arrAnonym.has(v.id)) {
      v.isAnonym = false;
    }
  });

  const promise = new Promise<void>(async (resolve) => {
    let definedCnt = ctx.chat.calcVisibleMembersCount() + 1;

    if (membersCnt == definedCnt) {
      process.env.DEBUG && console.log("Count of members is correct. Nothing to report");
      return;
    }
    if (definedCnt > membersCnt) {
      process.env.DEBUG && console.log("Warning in countAll. definedCnt > membersCnt for chat: " + ctx.chatId);
      return;
    }

    // membersCnt > definedCnt

    const sendCount = (cnt: number) => {
      const names = Object.keys(ctx.chat.members)
        .map((k) => ctx.chat.members[k])
        .filter((v) => !v.isAnonym)
        .map((v) => (v.lastName ? v.firstName + " " + v.lastName : v.firstName))
        .sort();

      return ctx.sendMessage({
        text: [
          `❗️❗️Определено ${cnt} из ${membersCnt} участников (анонимные считаются отдельно)`,
          "Я",
          ...names,
        ].join("\n"),
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
      const newCount = ctx.chat.calcVisibleMembersCount() + 1; // and me

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
    resolve();
  });

  if (partialWait) {
    return Promise.resolve();
  } else {
    return promise;
  }
}
