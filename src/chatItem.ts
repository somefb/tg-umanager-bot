import { User } from "typegram";
import Repo from "./repo";
import { IUser } from "./userItem";

//todo move merge chatMember with UserItem
export interface MyChatMember extends IUser {
  isBot: boolean;
  isAnonym: boolean;
}

export default class ChatItem {
  static isAnonymGroupBot(user: User | undefined): boolean {
    return (user && user.is_bot && user.username === "GroupAnonymousBot") || false;
  }

  static userToMember(user: User, isAnonym: boolean | null | undefined): MyChatMember {
    return {
      id: user.id,
      isBot: user.is_bot,
      isAnonym: !!isAnonym,
      firstName: user.first_name,
      lastName: user.last_name,
      userName: user.username,
    };
  }

  id: number;
  /** Index from which we need to start deleting messages */
  lastDeleteIndex = 1;
  isGroup = false;
  members: Record<string | number, MyChatMember> = {};

  constructor(id: number) {
    this.id = id;
  }

  addOrUpdateMember(user: User, isAnonym: boolean | null | undefined): void {
    if (!this.isGroup) {
      return;
    }

    const was: MyChatMember | undefined = this.members[user.id];
    if (!ChatItem.isAnonymGroupBot(user)) {
      const willAnonym = isAnonym != null ? isAnonym : !!was?.isAnonym;
      const member = ChatItem.userToMember(user, willAnonym);
      this.members[user.id] = member;
      if (!was) {
        Repo.addOrUpdateChat(this);
      }
    }
  }

  removeMember(userId: number): void {
    // todo soft-delete
    delete this.members[userId];
    this.onChatMembersCountChanged?.call(this, -1);
  }

  calcVisibleMembersCount(): number {
    return Object.keys(this.members).reduce(
      (cnt, key) => (cnt as number) + (this.members[key].isAnonym ? 0 : 1),
      0
    ) as number;
  }

  /** Fires only when we need to update count of chat members (when member added/remove in the group-chat) */
  onChatMembersCountChanged?: (increment: number) => void;

  getMemberByName(searchText: string): MyChatMember | null {
    const ids = Object.keys(this.members);
    for (let i = 0; i < ids.length; ++i) {
      const id = ids[i];
      const m = this.members[id];
      if (m.userName === searchText || `${m.firstName}${m.lastName ? " " + m.lastName : ""}` === searchText) {
        return m;
      }
    }
    return null;
  }
}
