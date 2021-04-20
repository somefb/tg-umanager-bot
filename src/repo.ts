import fs from "fs";
import { User } from "typegram";
import ChatItem from "./chatItem";
import RepoGoogleDrive from "./googleDrive/repoGoogleDrive";
import onExit from "./onExit";
import UserItem from "./userItem";

interface ISavedRepo {
  version?: number;
  chats: Record<string | number, ChatItem>;
  users: Record<number, UserItem>;
}

/** This is basic singleton storage class for saving configuration etc. */
export class RepoClass {
  /** this default filepath that must be replaced  */
  filePath = "testBotSettings.json";
  /**  date as number */
  version?: number;
  chats: Record<string | number, ChatItem> = {};
  users: Record<number, UserItem> = {};

  googleDrive = new RepoGoogleDrive();
  // watch-fix: https://github.com/Microsoft/TypeScript/issues/3841#issuecomment-337560146
  ["constructor"]: typeof RepoClass;

  private get optionsForSave() {
    return {
      version: Date.now(),
      chats: this.chats,
      users: this.users,
    } as ISavedRepo;
  }

  private set optionsForSave(v: ISavedRepo | null) {
    if (!v) {
      return;
    }
    Object.keys(v.chats).forEach(
      (k) => (this.chats[k] = Object.assign(new ChatItem(v.chats[k].id), v.chats[k], this.chats[k]))
    );
    Object.keys(v.users).forEach(
      (k) =>
        (this.users[k] = Object.assign(
          new UserItem(v.users[k].id, v.users[k].validationKey),
          v.users[k],
          this.users[k]
        ))
    );
  }

  async init(filePath: string): Promise<void> {
    this.filePath = filePath;
    console.log(`Repo. Reading bot settings from '${filePath}'...`);
    const opt1 = await this.googleDrive.get<ISavedRepo>(filePath);
    const opt2 = fs.existsSync(filePath)
      ? (JSON.parse(fs.readFileSync(filePath, { encoding: "utf-8" })) as ISavedRepo)
      : null;
    if (!opt1 && !opt2) {
      console.warn(`Repo. ${filePath} is not defined. Started with empty-default config`);
      return;
    } else {
      this.optionsForSave = (opt1?.version || 0) >= (opt2?.version || 0) ? opt1 || opt2 : opt2 || opt1;
    }
  }

  commitTimer: NodeJS.Timeout | undefined;
  commit(ignoreDebounce = false): Promise<void> {
    return new Promise((resolve) => {
      if (!ignoreDebounce && this.commitTimer) {
        return;
      } else if (ignoreDebounce && this.commitTimer) {
        clearTimeout(this.commitTimer);
      }
      this.commitTimer = setTimeout(
        async () => {
          this.commitTimer = undefined;
          if (!this.hasAnyUser) {
            // WARN it happens when app is cancelled by ts-errors during the compilation
            console.error("Repo. No users for saving. Decline commit");
            debugger;
          } else {
            const forSave = this.optionsForSave;
            try {
              console.log(`Repo. Saving bot settings to local ${this.filePath}...`);
              fs.writeFileSync(
                this.filePath,
                JSON.stringify(forSave, (_key, value) => (value == null ? undefined : value)),
                { encoding: "utf-8" }
              );
            } catch (err) {
              console.error(`Repo. Error. Can't save to local file ${this.filePath}`, err);
            }
            try {
              console.log(`Repo. Saving bot settings to googleDrive...`);
              await this.googleDrive.save(this.filePath, forSave);
            } catch (err) {
              console.error(`Repo. Error. Can't save to googleDrive ${this.filePath}`, err);
            }
          }
          resolve();
        },
        ignoreDebounce ? 0 : 10000
      );
    });
  }

  getСhat(id: number | undefined): ChatItem | undefined {
    return (id && this.chats[id]) || undefined;
  }

  addOrUpdateChat(chat: ChatItem): void {
    this.chats[chat.id] = chat;
    this.commit();
  }

  getOrPushChat(id: number): ChatItem {
    let chat = this.chats[id];
    if (!chat) {
      chat = new ChatItem(id);
      this.chats[id] = chat;
      this.commit();
    }
    return chat;
  }

  removeChat(id: number): void {
    delete this.chats[id];
    this.commit();
  }

  addOrUpdateUser(user: UserItem): void {
    const isNew = !this.users[user.id];
    this.users[user.id] = user;
    if (isNew) {
      this.eventListeners.forEach((v, ref) => {
        if (v.userId === user.id) {
          v.resolve(user);
          this.removeEvent(ref);
        }
      });
    }
    this.commit();
  }

  updateUser(from: User): void {
    if (from.is_bot) {
      return;
    }

    const user = this.users[from.id];
    if (!user) {
      return;
    }
    let updated = false;
    if (user.firstName != from.first_name) {
      user.firstName = from.first_name;
      updated = true;
    }
    if (user.lastName != from.last_name) {
      user.lastName = from.last_name;
      updated = true;
    }
    if (user.userName != from.username) {
      user.userName = from.username;
      updated = true;
    }

    updated && this.commit();
  }

  getUser(id: number | undefined): UserItem | undefined {
    return (id && this.users[id]) || undefined;
  }

  get hasAnyUser(): boolean {
    return !!Object.keys(this.users).length;
  }

  eventListeners = new Map<Promise<unknown>, IEventListener>();
  onUserAdded(userId: number): Promise<UserItem> {
    let e: IEventListener | undefined;
    const ref = new Promise<UserItem>((resolve, reject) => {
      e = { userId, resolve, reject };
    });
    // undefined required for avoiding TS-bug
    e && this.eventListeners.set(ref, e);
    return ref;
  }
  removeEvent(ref: Promise<unknown>): void {
    this.eventListeners.delete(ref);
  }
}

const Repo = new RepoClass();
export default Repo;

onExit(() => Repo.commit(true));

interface IEventListener {
  userId: number;
  resolve: (value: UserItem) => void;
  reject: () => void;
}
