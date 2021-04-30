import { Update, User, CallbackQuery, Message, Chat } from "typegram";
import objectRecursiveSearch from "../helpers/objectRecursiveSearch";
import Repo from "../repo";
import TelegramService from "../telegramService";
import { EventTypeReturnType, EventTypeEnum, NewTextMessage } from "../types";
import gotBotCommand from "./gotBotCommand";
import onMeAdded from "./onMeAdded";

export default function gotUpdate(this: TelegramService, upd: Update): void {
  //process.env.VERBOSE &&
  console.log("got update", "\n" + JSON.stringify(upd) + "\n");
  try {
    let defFn: null | (() => boolean) = null;
    let chatId: number | undefined;
    let updFrom: User | undefined;
    let isHandled = false;

    const updateMember = (chatId: number, from: User | undefined, isAnonym: boolean | null | undefined) => {
      updFrom = from;
      if (from && from.username !== this.botUserName) {
        Repo.getСhat(chatId)?.addOrUpdateMember(from, isAnonym);
        Repo.updateUser(from);
      }
    };

    const removeMember = (chatId: number, user: User) => {
      const chat = Repo.getСhat(chatId);
      if (chat) {
        // update only if it wasn't removed before
        !chat.removedMembers[user.id] && updateMember(chatId, user, false);
        chat.removeMember(user.id, true);
      }
    };

    const r = ((): { value: EventTypeReturnType[EventTypeEnum]; type: EventTypeEnum } => {
      if ((upd as Update.CallbackQueryUpdate).callback_query) {
        const q = (upd as Update.CallbackQueryUpdate).callback_query as CallbackQuery.DataCallbackQuery;
        chatId = q.message?.chat.id;
        if (chatId && q.message) {
          updateMember(chatId, q.from, null);
          if (q.data?.startsWith("/")) {
            defFn = () => {
              if (!isHandled) {
                const msg = Object.assign({}, q.message, {
                  text: q.data,
                  from: q.from,
                  chat: q.message?.chat as Chat.PrivateChat,
                } as Partial<NewTextMessage>) as NewTextMessage;
                return !isHandled && gotBotCommand.call(this, msg, q.message?.chat.id || 0);
              }
              return false;
            };
          }
        }
        return {
          type: EventTypeEnum.gotCallbackQuery,
          value: q as EventTypeReturnType[EventTypeEnum.gotCallbackQuery],
        };
      }
      if ((upd as Update.MessageUpdate).message) {
        const m = (upd as Update.MessageUpdate).message;
        chatId = m.chat.id;
        updateMember(chatId, m.from, null);

        if ((m as Message.TextMessage).text?.startsWith("/")) {
          if (chatId) {
            const cid = chatId;
            defFn = () => gotBotCommand.call(this, m as NewTextMessage, cid);
          }
          return {
            type: EventTypeEnum.gotBotCommand,
            value: m as EventTypeReturnType[EventTypeEnum.gotBotCommand],
          };
        } else if ((m as Message.DocumentMessage).document) {
          const file = (m as Message.DocumentMessage).document;
          (m as EventTypeReturnType[EventTypeEnum.gotFile]).file = file;
          return {
            type: EventTypeEnum.gotFile,
            value: m as EventTypeReturnType[EventTypeEnum.gotFile],
          };
        } else if ((m as Message.AudioMessage).audio) {
          const file = (m as Message.AudioMessage).audio;
          (m as EventTypeReturnType[EventTypeEnum.gotFile]).file = file;
          return {
            type: EventTypeEnum.gotFile,
            value: m as EventTypeReturnType[EventTypeEnum.gotFile],
          };
        } else if ((m as Message.VoiceMessage).voice) {
          const file = (m as Message.VoiceMessage).voice;
          (m as EventTypeReturnType[EventTypeEnum.gotFile]).file = file;
          return {
            type: EventTypeEnum.gotFile,
            value: m as EventTypeReturnType[EventTypeEnum.gotFile],
          };
        } else if ((m as Message.VideoMessage).video) {
          const file = (m as Message.VideoMessage).video;
          (m as EventTypeReturnType[EventTypeEnum.gotFile]).file = file;
          return {
            type: EventTypeEnum.gotFile,
            value: m as EventTypeReturnType[EventTypeEnum.gotFile],
          };
        } else if ((m as Message.PhotoMessage).photo) {
          //WARN: we skip the other photos
          const file = (m as Message.PhotoMessage).photo[0];
          (m as EventTypeReturnType[EventTypeEnum.gotFile]).file = file;
          return {
            type: EventTypeEnum.gotFile,
            value: m as EventTypeReturnType[EventTypeEnum.gotFile],
          };
        } else if ((m as Message.AnimationMessage).animation) {
          const file = (m as Message.AnimationMessage).animation;
          (m as EventTypeReturnType[EventTypeEnum.gotFile]).file = file;
          return {
            type: EventTypeEnum.gotFile,
            value: m as EventTypeReturnType[EventTypeEnum.gotFile],
          };
        } else if ((m as Message.TextMessage).text) {
          return {
            type: EventTypeEnum.gotNewMessage,
            value: m as EventTypeReturnType[EventTypeEnum.gotNewMessage],
          };
        } else if ((m as Message.NewChatMembersMessage).new_chat_members) {
          const members = (m as Message.NewChatMembersMessage).new_chat_members;
          const cid = chatId;
          members.forEach((v) => updateMember(cid, v, false));

          const chat = Repo.getСhat(chatId);
          chat?.onChatMembersCountChanged?.call(chat, members.length);

          return {
            type: EventTypeEnum.addedChatMembers,
            value: m as EventTypeReturnType[EventTypeEnum.addedChatMembers],
          };
        } else if ((m as Message.LeftChatMemberMessage).left_chat_member) {
          const member = (m as Message.LeftChatMemberMessage).left_chat_member;
          // member left the chat
          removeMember(chatId, member);
          defFn = () => true;
        }
      } else if ((upd as Update.EditedMessageUpdate).edited_message) {
        const m = (upd as Update.EditedMessageUpdate).edited_message;
        if ((m as Message.TextMessage).text) {
          chatId = m.chat.id;
          updateMember(chatId, m.from, null);
          return {
            type: EventTypeEnum.gotEditedMessage,
            value: m as EventTypeReturnType[EventTypeEnum.gotEditedMessage],
          };
        }
      } else if ((upd as Update.ChatMemberUpdate).chat_member || (upd as Update.MyChatMemberUpdate).my_chat_member) {
        // todo we can detect blocked/unblocked for private chat here
        const m = (upd as Update.MyChatMemberUpdate).my_chat_member || (upd as Update.ChatMemberUpdate).chat_member;
        chatId = m.chat.id;
        const mbot = m.new_chat_member;
        if (mbot.user.id === this.botUserId && mbot.status === "member") {
          const cid = chatId;
          defFn = () => {
            onMeAdded.call(this, m as EventTypeReturnType[EventTypeEnum.memberUpated], cid);
            return true;
          };
        } else {
          const isLeft = m.new_chat_member.status === "kicked" || m.new_chat_member.status === "left";
          if (isLeft) {
            //member removed from chat
            if (mbot.user.id === this.botUserId) {
              // onMeRemoved => dispose all contexts for this chat
              this.contexts[chatId]?.forEach((c) => c.cancel("bot removed from chat"));
              Repo.removeChat(chatId);
              defFn = () => true;
            } else {
              removeMember(chatId, m.new_chat_member.user);
            }
          } else {
            //member added to chat
            updateMember(chatId, mbot.user, m.new_chat_member.is_anonymous);
            Repo.getСhat(chatId)?.onChatMembersCountChanged?.call(this, 1);
          }
        }
        return {
          type: EventTypeEnum.memberUpated,
          value: m as EventTypeReturnType[EventTypeEnum.memberUpated],
        };
      }

      !chatId &&
        objectRecursiveSearch(upd, (key, obj) => {
          if (key === "chat") {
            chatId = obj[key].id;
            return true;
          }
          return false;
        });

      return {
        type: EventTypeEnum.gotUpdate,
        value: upd as EventTypeReturnType[EventTypeEnum.gotUpdate],
      };
    })();

    this.eventListeners.forEach((e) => {
      if (e.type === r.type || e.type === EventTypeEnum.gotUpdate) {
        const val = e.type === EventTypeEnum.gotUpdate ? upd : r.value;
        if (e.predicate(val, chatId)) {
          this.removeEvent(e.ref);
          e.resolve(val);
          isHandled = true;
        }
      }
    });

    const ctx = r && chatId && this.getContexts(chatId);
    ctx && ctx.forEach((c) => (isHandled = c.fireEvent(r.type, r.value, upd, updFrom) || isHandled));
    isHandled = (defFn && defFn()) || isHandled;

    if (!isHandled) {
      process.env.DEBUG && console.log(`TelegramService '${this.cfg.name}'. Got unhandled update\n`, upd);
    }
  } catch (err) {
    console.error(`TelegramService '${this.cfg.name}'. Error in gotUpdate\n`, err);
  }
}
