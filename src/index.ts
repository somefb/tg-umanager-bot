import { fork } from "child_process";
import { ChildProcess } from "node:child_process";
import path from "path";

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

function start() {
  pr = fork(path.resolve(__dirname + "/start.here"), process.argv, {
    cwd: process.cwd(),
    env: process.env,
    detached: false,
    stdio: "inherit", //"pipe"
    // todo check for prod:build
    execArgv: ["-r", "ts-node/register"],
  })
    .on("error", (err) => {
      console.log("Got error in spawn-proccess:\n", err);
    })
    .on("close", () => {
      console.log("Closing proccess");
      setTimeout(() => start(), 2000);
    });

  // pr.stdout?.pipe(process.stdout);
  // pr.stderr?.pipe(process.stderr);
  // pr.stdin?.pipe(process.stdin);

  console.log("Proccess is started");
}

start();

setInterval(() => {
  console.log("Closing the server");
  pr?.kill();
  pr = null;
}, 100000); //todo implement checking time
