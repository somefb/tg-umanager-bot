if (!global.isWebpackBuild) {
  global.DEBUG = process.argv.includes("--debug");
  global.DEV = process.argv.includes("--dev");
  global.VERBOSE = process.argv.includes("--verbose");
}

import http from "http";
import path from "path";
import MyBotCommands from "./commands";
import TelegramService from "./telegramService";
import { BotConfig, TelegramListenOptions } from "./types";
import Repo from "./repo";
import CheckBotCommands from "./userCheckBot";
import cfg from "./appSettingsGet";
import onExit from "./onExit";
import "./global.ext";

console.clear();

async function runApp() {
  try {
    console.log("Starting app. Gathering info...");

    // port is defined in .platform\nginx\conf.d\https.conf
    process.env.PORT_HTTPS = process.env.PORT_HTTPS || "9447";

    // https part
    let domainURL: string | undefined;
    let certKeyPath: string | undefined;
    let certPath: string | undefined;
    const isViaHttps = process.argv.includes("--https");
    if (isViaHttps) {
      certKeyPath = path.join(__dirname, "../ssl/cert.key");
      certPath = path.join(__dirname, "../ssl/cert.pem");

      domainURL = process.env.DomainURL;
      if (!domainURL) {
        domainURL = await new Promise<string | undefined>((resolve) => {
          // more details here: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html
          http
            // hostname (not IP) is required since certificate has part of hostName: 'CN' option
            .get("http://169.254.169.254/latest/meta-data/public-hostname", (res) => {
              // .get("http://169.254.169.254/latest/meta-data/public-ipv4", (res) => {
              let txt = "https://";
              res.on("data", (chunk) => {
                txt += chunk;
              });
              res.on("end", () => {
                resolve(txt);
              });
            })
            .on("error", (err) => {
              console.error("Impossible to define domainURL\n", err);
              resolve(undefined);
            });
        });
      }
    }
    console.log("Defined domainURL: " + domainURL);

    //http server for checking status via browser
    console.log("Running ordinary web server...");
    const srv = http.createServer(function (_req, res) {
      res.writeHead(200, "OK", { "Content-Type": "text/plain" });
      res.write("Healthy");
      res.end();
    });
    srv.listen(process.env.PORT || 3000).on("error", (err) => {
      console.error("Impossible to run http server\n", err.message);
    });
    onExit(() => srv.close());

    // the main logic of telegram bot here
    console.log("Starting telegram bot logic...");

    await Repo.init(cfg.botSettingsPath);

    const bots: BotConfig[] = [
      {
        name: "mainBot",
        token: cfg.botToken,
        commands: MyBotCommands,
      },
      {
        name: "checkBot",
        token: cfg.botCheckToken,
        commands: CheckBotCommands,
      },
    ];

    // await tg.get<BotCommand[]>("getMyCommands").then((v) => console.warn(v));
    const options: TelegramListenOptions = {
      interval: 1000,
      ownDomainURL: domainURL,
      keyPath: certKeyPath,
      certPath,
    };

    for (let i = 0; i < bots.length; ++i) {
      const tg = new TelegramService(bots[i]);
      await tg.listen(options);
    }
  } catch (err) {
    console.error("Error in the main module\n" + err);
    console.trace(err);
  }
}

runApp();
