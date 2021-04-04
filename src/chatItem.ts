import { Update, User } from "typegram";
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

    const was = this.members[user.id];
    if (!was && !ChatItem.isAnonymGroupBot(user)) {
      const member: MyChatMember = {
        id: user.id,
        isBot: user.is_bot,
        isAnonym: !!isAnonym,
        firstName: user.first_name,
        lastName: user.last_name,
        userName: user.username,
      };
      this.members[user.id] = member;
      Repo.addOrUpdateChat(this);
    }
  }

  removeMember(userId: number): void {
    // todo soft-delete
    delete this.members[userId];
    this?.onChatMembersCountChanged?.call(this, -1);
  }

  calcVisibleMembersCount(): number {
    return Object.keys(this.members).reduce(
      (cnt, key) => (cnt as number) + (this.members[key].isAnonym ? 0 : 1),
      0
    ) as number;
  }

  /** Fires only when we need to get count of chat members */
  onChatMembersCountChanged?: (increment: number) => void;
}
