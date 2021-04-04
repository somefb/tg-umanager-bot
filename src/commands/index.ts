import CommandClear from "./clear";
import CommandClearDisableUntilHere from "./clearDisableUntilHere";
import CheckAll from "./checkAll";
import CommandHelp from "./help";
import ShareBot from "./shareBot";
import TestValidateMe from "./testValidateMe";

const MyBotCommands = [CommandHelp, CommandClear, CommandClearDisableUntilHere, ShareBot, CheckAll];
if (process.env.DEBUG || process.env.NODE_ENV === "test") {
  MyBotCommands.push(TestValidateMe);
}

export default MyBotCommands;
