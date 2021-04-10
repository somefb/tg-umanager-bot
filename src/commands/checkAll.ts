import ErrorCancelled from "../errorCancelled";
import dateToPastTime from "../helpers/dateToPastTime";
import Repo from "../repo";
import { CommandRepeatBehavior, EventTypeEnum, IBotContext, MyBotCommand, NewCallbackQuery } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";

const CheckAll: MyBotCommand = {
  command: "check_all",
  type: MyBotCommandTypes.group,
  isHidden: true,
  description: "проверить участников",
  repeatBehavior: CommandRepeatBehavior.restart,
  callback: async (ctx) => {
    const ctxTask = ctx.service.initContext(ctx.chatId, "_cntAll", ctx.initMessage, ctx.user);
    ctxTask.callCommand(countAllTask);

    ctx.singleMessageMode = true;
    ctx.setTimeout(0);

    let throttle: NodeJS.Timeout | null = null;
    const report = (forceNow = false, isFinished = false) => {
      if (throttle) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        throttle = setTimeout(
          async () => {
            throttle = null;
            const arr = ["Статус пользователей\n"];
            Object.keys(ctx.chat.members).forEach((key) => {
              const m = ctx.chat.members[key];
              if (m.isBot) {
                return;
              }
              const user = Repo.getUser(m.id);
              let status: string;
              let icon: string;
              if (!user) {
                icon = "❗️";
                status = "не зарегистрирован, ожидание...";
              } else if (user.isLocked) {
                //todo show instructions
                icon = "❌";
                status = `заблокирован ${dateToPastTime(user.validationDate)}`;
              } else if (user.isValid) {
                icon = "✅";
                status = `проверен ${dateToPastTime(user.validationDate)}`;
              } else {
                //todo show CheckBot is blocked
                icon = "⏳";
                status = `ожидание... Было ${dateToPastTime(user.validationDate)}`;
              }

              const lastName = m.lastName || m.firstName;
              const uLink = m.isAnonym
                ? `анон.админ (${m.firstName[0]}..${m.firstName.length > 2 ? lastName[lastName.length - 1] : ""})`
                : UserItem.ToLink(m.id, m.userName, m.firstName, m.lastName);
              arr.push(`${icon} ${uLink} - ${status}`);
            });

            isFinished && arr.push("\nПроверка окончена");
            await ctx.sendMessage({
              text: arr.join("\n"),
              parse_mode: "HTML",
              disable_notification: true,
            });

            resolve();
          },
          forceNow ? 0 : 5 * 60000
        );
      });
    };

    await report(true);

    //todo what if this command will be fired again in a short time?
    const arr: Promise<unknown>[] = [];
    const listeners: Promise<unknown>[] = [];
    Object.keys(ctx.chat.members).forEach((key) => {
      const member = ctx.chat.members[key];
      const user = Repo.getUser(member.id);
      if (user) {
        arr.push(
          CheckBot.validateUser(user).then(() => {
            report();
          })
        );
      } else if (!member.isBot) {
        const ref = Repo.onUserAdded(member.id);
        listeners.push(ref);
        arr.push(ref.then(() => report()));
      }
    });

    ctx.onCancelled = () => listeners.forEach((ref) => Repo.removeEvent(ref));

    await Promise.all(arr);
    await report(true, true);
  },
};

export default CheckAll;

async function countAllTask(ctx: IBotContext) {
  ctx.setTimeout(0);

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
  }
  ctx.chat.onChatMembersCountChanged = undefined;
}
