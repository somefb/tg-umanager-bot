import MyBotCommands from ".";

describe("botCommands (CheckBot)", () => {
  // validate commands according to tg-spec: https://core.telegram.org/bots/api#botcommand
  MyBotCommands.forEach((v) => {
    describe(v.command, () => {
      test("command length (1..32)", () => {
        expect(v.command.length >= 1 && v.command.length <= 32).toBeTruthy();
      });
      test("command symbols (a-z0-9_)", () => {
        expect(/^[a-z0-9_]+$/.test(v.command)).toBeTruthy();
      });
      test("description length (3..256)", () => {
        expect(v.isHidden || (v.description.length >= 3 && v.description.length <= 256)).toBeTruthy();
      });
    });
  });
});
