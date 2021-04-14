import CommandClear from "./clear";
import CommandClearDisableUntilHere from "./clearDisableUntilHere";
import Check from "./check";
import CommandHelp from "./help";
import ShareBot from "./shareBot";
import TestValidateMe from "./testCmd";

const MyBotCommands = [CommandHelp, CommandClear, CommandClearDisableUntilHere, ShareBot, Check];
if (process.env.DEV || process.env.NODE_ENV === "test") {
  MyBotCommands.push(TestValidateMe);
}

export default MyBotCommands;
