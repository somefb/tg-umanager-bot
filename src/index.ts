import { fork } from "child_process";
import { ChildProcess } from "node:child_process";
import path from "path";
import { setNextDate } from "./helpers/setNextDate";

let pr: ChildProcess | null = null;

// handle closing app
const signals: Array<NodeJS.Signals> = ["SIGINT", "SIGTERM"];
signals.forEach((s) => {
  process.on(s, () => {
    if (pr) {
      // wait for children gracefully exit
      pr.on("exit", () => {
        process.exit();
      });
    } else {
      process.exit();
    }

    // redundant case when exit wasn't succesful
    setTimeout(() => {
      pr?.kill();
      process.exit();
    }, 10000);
  });
});

const isTsNode = process.argv.some((arg) => arg.includes("ts-node"));

function start() {
  console.log("Running the process");

  pr = fork(path.resolve(__dirname + "/index.main"), process.argv, {
    cwd: process.cwd(),
    env: process.env,
    detached: false,
    stdio: "inherit", //"pipe"
    execArgv: isTsNode ? ["-r", "ts-node/register"] : undefined, // required for local-start
  })
    .on("error", (err) => {
      console.error("Got error in child-process:\n", err);
    })
    .on("close", () => setTimeout(start, 1000));
  // pr.stdout?.pipe(process.stdout);
  // pr.stderr?.pipe(process.stderr);
  // pr.stdin?.pipe(process.stdin);
}

start();

const reloadTime = 4 * 60; // reload in 04:00
let reloadTimestamp = setNextDate(reloadTime);
setInterval(() => {
  const now = Date.now();

  if (now >= reloadTimestamp) {
    reloadTimestamp = setNextDate(reloadTime);
    console.log("Closing the process");
    pr?.kill();
    pr = null;
  }
}, 10000);
