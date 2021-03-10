import cfg from "../appSettingsGet";
import Repo from "../repo";
import { MyBotCommand } from "../types";
import { CheckBot } from "../userCheckBot";
import UserItem from "../userItem";
import { MyBotCommandTypes } from "./botCommandTypes";

// todo this is test command - remove after tests
const ValidateMe: MyBotCommand = {
  command: "validate_me",
  type: MyBotCommandTypes.personal,
  description: "проверь меня",
  callback: async (msg, service) => {
    const chat_id = msg.chat.id;
    //todo try catch ?
    //todo remove all commands automatically
    await service.core.deleteMessageForce({ chat_id, message_id: msg.message_id });

    const uid = msg.from?.id;
    let user = Repo.getUser(uid);
    if (!user) {
      if (!Repo.users?.length && uid === cfg.ownerUserId) {
        const key = CheckBot.generateUserKey();
        const r = await service.core.sendMessage({
          chat_id,
          text: `Ваш ключ:\n\n"${key.num} ${key.word}"\n\nЗапомните его.`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "ОК", callback_data: "OK" }]],
          },
        });
        if (r.ok) {
          let cancellation: () => void | undefined;
          const rt = setTimeout(() => {
            service.core.deleteMessageForce({ chat_id, message_id: r.result.message_id });
            cancellation && cancellation();
          }, 15000); // wait for 15 sec and delete message

          try {
            await service.onGotUpdate(chat_id, (e) => (cancellation = e));
          } catch (err) {
            if (!err.isCancelled) {
              console.error(err);
              return;
            }
          }
          // todo check this behavior
          clearTimeout(rt);
          user = new UserItem(cfg.ownerUserId, key);
          console.warn("registered user");
          await service.core.deleteMessage({ chat_id, message_id: r.ok && r.result.message_id });
        }
      } else {
        await service.core.sendMessage({
          chat_id,
          // todo change message
          text: "Вы не зарегестрированы в системе",
        });
        return;
      }
    }

    if (user) {
      const isValid = await CheckBot.validateUser(user);
      service.core.sendMessage({
        chat_id,
        text: isValid ? "Проверка пройдена" : "Провалено",
      });
    }
  },
};

export default ValidateMe;
