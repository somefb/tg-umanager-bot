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

  static getSortedMembers(
    members: Record<number, MyChatMember>,
    filter?: (v: MyChatMember) => boolean
  ): MyChatMember[] {
    const arr: MyChatMember[] = [];
    if (filter) {
      for (const key in members) {
        filter(members[key]) && arr.push(members[key]);
      }
    } else {
      for (const key in members) {
        arr.push(members[key]);
      }
    }

    return arr.sort((a, b) => {
      if (a.isAnonym && b.isAnonym) {
        return a.firstName.localeCompare(b.firstName);
      } else if (a.isAnonym) {
        return -1;
      } else if (b.isAnonym) {
        return 1;
      }
      return a.firstName.localeCompare(b.firstName);
    });
  }

  id: number;
  /** Index from which we need to start deleting messages */
  lastDeleteIndex = 1;
  isGroup = false;
  members: Record<number, MyChatMember> = {};
  removedMembers: Record<number, MyChatMember> = {};

  constructor(id: number) {
    this.id = id;
  }

  addOrUpdateMember(user: User, isAnonym: boolean | null | undefined): void {
    // todo find and update member in each chat
    if (!this.isGroup) {
      return;
    }

    const was: MyChatMember | undefined = this.members[user.id];
    if (!ChatItem.isAnonymGroupBot(user)) {
      const willAnonym = isAnonym != null ? isAnonym : !!was?.isAnonym;
      const member = ChatItem.userToMember(user, willAnonym);
      this.members[user.id] = member;
      if (!was) {
        delete this.removedMembers[user.id];
        Repo.addOrUpdateChat(this);
      }
    }
  }

  removeMember(userId: number, soft: boolean): void {
    if (soft && this.members[userId] && !this.members[userId].isBot) {
      this.removedMembers[userId] = this.members[userId];
    }
    delete this.members[userId];
    !soft && delete this.removedMembers[userId];
    this.onChatMembersCountChanged?.call(this, -1);
  }

  calcVisibleMembersCount(): number {
    let cnt = 0;
    for (const key in this.members) {
      if (!this.members[key].isAnonym) {
        ++cnt;
      }
    }
    return cnt;
  }

  /** Fires only when we need to update count of chat members (when member added/removed in the group-chat) */
  onChatMembersCountChanged?: (increment: number) => void;
}
