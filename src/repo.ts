import fs from "fs";
import ChatItem from "./chatItem";
import RepoGoogleDrive from "./googleDrive/repoGoogleDrive";

/** This is basic singleton storage class for saving configuration etc. */
export class RepoClass {
  /** this default filepath that must be replaced  */
  filePath = "testBotSettings.json";
  /**  date as number */
  version?: number;
  chats: ChatItem[] = [];
  googleDrive = new RepoGoogleDrive();
  // watch-fix: https://github.com/Microsoft/TypeScript/issues/3841#issuecomment-337560146
  ["constructor"]: typeof RepoClass;

  private get optionsForSave() {
    return {
      version: Date.now(),
      chats: this.chats,
    } as RepoClass;
  }

  private set optionsForSave(v: RepoClass | null) {
    if (!v) {
      return;
    }
    this.chats = v.chats.map((c) => Object.assign(new ChatItem(c.id), c));
  }

  async init(filePath: string): Promise<void> {
    this.filePath = filePath;
    console.log(`Repo. Reading bot settings from '${filePath}'...`);
    const opt1 = await this.googleDrive.get<RepoClass>(filePath);
    const opt2 = fs.existsSync(filePath)
      ? (JSON.parse(fs.readFileSync(filePath, { encoding: "utf-8" })) as RepoClass)
      : null;
    if (!opt1 && !opt2) {
      console.warn(`Repo. ${filePath} is not defined. Started with empty-default config`);
      return;
    } else {
      this.optionsForSave = ((opt1?.version || 0) >= (opt2?.version || 0) ? opt1 || opt2 : opt2 || opt1) as RepoClass;
    }
  }

  async commit(): Promise<void> {
    // todo save bot settings every 1hour ???
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
  }

  getOrPushChat(id: number): ChatItem {
    let chat = this.chats.find((c) => c.id === id);
    if (!chat) {
      chat = new ChatItem(id);
      this.chats.push(chat);
    }
    return chat;
  }
}

const Repo = new RepoClass();
export default Repo;

process.on("beforeExit", () => {
  console.log("Exit detected: Repo saving storage...");
  Repo.commit();
});
