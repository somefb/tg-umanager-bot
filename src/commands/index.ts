import CommandClear from "./clear";
import CommandClearDisableHere from "./clearDisableHere";
import CommandCheck, { CommandCheckStart } from "./check";
import CommandHelp from "./help";
import ShareBot from "./shareBot";
import TestValidateMe from "./testCmd";
import CommandKick from "./kick";
import countAllTask from "./countAllTask";
import { CommandRepeatBehavior } from "../types";
import { MyBotCommandTypes } from "./botCommandTypes";
import UnlockUser from "./unlockUser";
import CommandCheckUser from "./checkUser";
import CommandInvite from "./invite";
import CommandKickInvalid from "./kickInvalid";

const MyBotCommands = [
  CommandHelp,
  CommandClear,
  CommandClearDisableHere,
  ShareBot,
  CommandCheck,
  CommandCheckStart,
  CommandCheckUser,
  CommandKick,
  CommandKickInvalid,
  UnlockUser,
  CommandInvite,
];

if (global.DEV || process.env.NODE_ENV === "test") {
  MyBotCommands.push(TestValidateMe);
  MyBotCommands.push({
    command: "count_all",
    callback: countAllTask,
    description: "count_all",
    isHidden: false,
    repeatBehavior: CommandRepeatBehavior.restart,
    allowCommand: () => true,
    type: MyBotCommandTypes.group,
  });
}

export default MyBotCommands;
