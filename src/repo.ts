import fs from "fs";
import ChatItem from "./chatItem";
import RepoGoogleDrive from "./googleDrive/repoGoogleDrive";
import onExit from "./onExit";
import UserItem from "./userItem";

interface ISavedRepo {
  version?: number;
  chats: Record<string | number, ChatItem>;
  users: Record<string | number, UserItem>;
}

/** This is basic singleton storage class for saving configuration etc. */
export class RepoClass {
  /** this default filepath that must be replaced  */
  filePath = "testBotSettings.json";
  /**  date as number */
  version?: number;
  private chats: Record<string | number, ChatItem> = {};
  private users: Record<string | number, UserItem> = {};

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
    this.chats = Object.assign(this.chats, v.chats);
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
  async commit(ignoreDebounce = false): Promise<void> {
    return new Promise((resolve) => {
      if (!ignoreDebounce && this.commitTimer) {
        return;
      } else if (ignoreDebounce && this.commitTimer) {
        clearTimeout(this.commitTimer);
      }
      this.commitTimer = setTimeout(
        async () => {
          this.commitTimer = undefined;
          const forSave = this.optionsForSave;
          try {
            console.log(`Repo. Saving bot settings to local ${this.filePath}...`);
            fs.writeFileSync(this.filePath, JSON.stringify(forSave), { encoding: "utf-8" });
          } catch (err) {
            console.error(`Repo. Error. Can't save to local file ${this.filePath}`, err);
          }
          try {
            console.log(`Repo. Saving bot settings to googleDrive...`);
            await this.googleDrive.save(this.filePath, forSave);
          } catch (err) {
            console.error(`Repo. Error. Can't save to googleDrive ${this.filePath}`, err);
          }
          resolve();
        },
        ignoreDebounce ? 0 : 5000
      );
    });
  }

  getСhat(id: number | undefined): ChatItem | undefined {
    return (id && this.chats[id]) || undefined;
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

  addOrUpdateUser(user: UserItem): void {
    this.users[user.id] = user;
    this.commit();
  }

  getUser(id: number | undefined): UserItem | undefined {
    return (id && this.users[id]) || undefined;
  }

  get hasAnyUser(): boolean {
    return !!Object.keys(this.users).length;
  }
}

const Repo = new RepoClass();
export default Repo;

onExit(() => Repo.commit(true));
