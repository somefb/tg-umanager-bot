const queue: Array<() => Promise<unknown> | unknown> = [];
export default function onExit(asyncCallback: () => Promise<unknown> | unknown): void {
  queue.push(asyncCallback);
}

let isClosing = false;
process.on("uncaughtException", (err) => {
  //todo restart app?
  console.error("Error in the app. Closing...\n", err);
  if (!isClosing) {
    isClosing = true;
    process.emit("beforeExit", 1);
  }
  //process.exit(1); //mandatory (as per the Node.js docs)
});

process.on("unhandledRejection", (err) => {
  console.error("Error in the app\n", err);
});

process.on("SIGINT", () => {
  process.emit("beforeExit", 0);
});

process.on("SIGTERM", () => {
  process.emit("beforeExit", 0);
});

process.on("beforeExit", async (code) => {
  console.log(`\nExit detected. Starting exit-tasks...`);
  for (let i = 0; i < queue.length; ++i) {
    try {
      await queue[i]();
    } catch (err) {
      console.error("Error by exit\n", err);
    }
  }
  console.log(`\nExit done`);
  process.exit(code); // if you don't close yourself this will run forever
});
