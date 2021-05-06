import fs from "fs";
import { OAuth2Client } from "google-auth-library";
//todo optimize import to drive only
import { drive_v3, google } from "googleapis";
import path from "path";
import readline from "readline";
import { IRepository } from "../types";
import myGoogleCredentials from "./googleCredentials.json";

//example here https://developers.google.com/drive/api/v3/quickstart/nodejs

const SCOPES = ["https://www.googleapis.com/auth/drive.appdata"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
const TOKEN_PATH = path.join(__dirname, "googleToken.json");
const CACHE_PATH = path.join(__dirname, "googleCache.json");

//this is googleDrive basic class
export default class RepoGoogleDrive implements IRepository {
  cache = new Map<string, string | null>();

  constructor() {
    if (fs.existsSync(CACHE_PATH)) {
      try {
        const v = JSON.parse(fs.readFileSync(CACHE_PATH, { encoding: "utf-8" }));
        for (const key in v) {
          this.cache.set(key as string, v[key]);
        }
      } catch (err) {
        console.error(`GoogleDrive. Error. Can't parse cache-file ${CACHE_PATH} /n`, err);
      }
    }
  }

  saveCache(): void {
    const obj: Record<string, string | null> = {};
    this.cache.forEach((v, key) => {
      obj[key] = v;
    });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(obj), { encoding: "utf-8" });
  }

  async get<T>(pathName: string): Promise<T | null> {
    const fname = path.basename(pathName);
    let fileId = this.cache.get(fname);
    if (fileId === undefined) {
      fileId = await this.getFileIdByName(fname);
      if (!fileId) {
        this.cache.set(fname, null);
        return null;
      }
      this.cache.set(fname, fileId);
    }
    if (!fileId) {
      return null;
    }
    const f = await this.getFile(fileId as string);
    return (f as unknown) as T;
  }

  async save<T>(pathName: string, item: T): Promise<void> {
    const fname = path.basename(pathName);
    let fileId = this.cache.get(fname);
    if (fileId === undefined) {
      fileId = await this.getFileIdByName(fname);
      this.cache.set(fname, fileId as string | null);
    }
    if (!fileId) {
      fileId = await this.createFile(fname, item);
      this.cache.set(fname, fileId);
      this.saveCache();
    } else {
      await this.updateFile(fileId, item);
    }
  }

  private _client?: OAuth2Client;
  async getClient(): Promise<OAuth2Client> {
    if (this._client) {
      return Promise.resolve(this._client);
    }

    const { client_secret, client_id, redirect_uris } = myGoogleCredentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    let token: (OAuth2Client["credentials"] & { scopes?: string[] }) | null = null;

    if (fs.existsSync(TOKEN_PATH)) {
      token = JSON.parse(fs.readFileSync(TOKEN_PATH, { encoding: "utf-8" }));
      const scopes = token?.scopes;
      if (!scopes || scopes.some((v) => !SCOPES.includes(v)) || SCOPES.some((v) => !scopes.includes(v))) {
        console.log("GoogleDrive. Scopes are changed. Request for new token...");
        token = null;
      }
    }

    if (!token) {
      token = await this.requestAccessToken(oAuth2Client, SCOPES);
      // Store the token to disk for later program executions
      token.scopes = SCOPES;
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log("GoogleDrive. Token stored to", TOKEN_PATH);
      });
    }

    oAuth2Client.setCredentials(token);
    this._client = oAuth2Client;
    return oAuth2Client;
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   */
  requestAccessToken(oAuth2Client: OAuth2Client, scope: string[]): Promise<OAuth2Client["credentials"]> {
    return new Promise((resolve, reject) => {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope,
      });
      console.log("GoogleDrive. Authorize this app by visiting this url:\n", authUrl);
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question("GoogleDrive. Enter the code from that page here: ", (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
          if (err || !token) {
            console.error("GoogleDrive. Error retrieving access token\n", err);
            reject(err);
          } else {
            resolve(token);
          }
        });
      });
    });
  }

  private _drive?: drive_v3.Drive;
  getDrive(): Promise<drive_v3.Drive> {
    if (this._drive) {
      return Promise.resolve(this._drive);
    }
    return this.getClient().then((auth) => {
      this._drive = google.drive({ version: "v3", auth });
      return this._drive;
    });
  }

  /** Creates file and returns id */
  async createFile(fileName: string, content: unknown): Promise<string> {
    // example here: https://developers.google.com/drive/api/v3/appdata
    const drive = await this.getDrive();
    return drive.files
      .create({
        fields: "id",
        media: {
          mimeType: "application/json",
          body: JSON.stringify(content),
        },
        requestBody: {
          name: fileName,
          parents: ["appDataFolder"],
        },
      })
      .then((res) => res.data.id as string);
  }

  async updateFile(fileId: string, content: unknown): Promise<void> {
    const drive = await this.getDrive();
    await drive.files.update({
      fileId,
      media: {
        mimeType: "application/json",
        body: JSON.stringify(content, (_key, value) => (value == null ? undefined : value)),
      },
    });
  }

  async getFile<T>(fileId: string): Promise<T> {
    const drive = await this.getDrive();
    return drive.files.get({ fileId, alt: "media" }).then((v) => v.data as T);
  }

  async getFileIdByName(fileName: string, nextPageToken?: string): Promise<string | undefined> {
    const drive = await this.getDrive();
    return drive.files
      .list({
        spaces: "appDataFolder",
        fields: "nextPageToken, files(id, name)",
        pageSize: 100,
        pageToken: nextPageToken,
      })
      .then((v) => {
        const files = v.data?.files;
        if (files?.length) {
          const f = files.find((v) => v.name === fileName);
          if (f) {
            return f.id as string;
          }
        }

        if (v.data.nextPageToken) {
          return this.getFileIdByName(fileName, nextPageToken);
        }
        return undefined;
      })
      .catch((err) => {
        console.error("GoogleDrive error\n", err);
        return undefined;
      });
  }

  async getFilesList(): Promise<{ name: string; id: string }[] | undefined> {
    const drive = await this.getDrive();
    return drive.files
      .list({
        spaces: "appDataFolder",
        fields: "nextPageToken, files(id, name)",
        pageSize: 100,
        //pageToken: nextPageToken,
      })
      .then((v) => {
        const r = v.data?.files?.map((v) => ({
          name: v.name as string,
          id: v.id as string,
        }));
        return r;
      });
  }

  async deteleFile(fileId: string): Promise<void> {
    const drive = await this.getDrive();
    await drive.files.delete({ fileId });
  }
}
