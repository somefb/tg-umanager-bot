import Repo from "../repo";
import { CommandRepeatBehavior, ITelegramService, MyBotCommand } from "../types";
import UserItem from "../userItem";
import { generateUserKey } from "./dictionary";
import playValidation from "./playValidation";
import CommandSchedule, { setNextValidationDate } from "./schedule";
import CommandSwitchMode from "./switchMode";
import validateUserTask from "./validateUserTask";

export const CheckBot = {
  service: {} as ITelegramService,

  validateUser(user: UserItem): Promise<boolean | null> {
    return validateUserTask(this.service, user);
  },
  generateUserKey,
};

function checkSchedulerTask() {
  setInterval(() => {
    const now = Date.now();
    for (const key in Repo.users) {
      const user = Repo.users[key];
      if (now >= user.validationNextDate) {
        if (user.validationNextDate === 0) {
          setNextValidationDate(user);
        }
        //allow user skip scheduled time if was validation 30 minutes before
        const skipChecking = user.validationDate + 30 * 60000 >= user.validationNextDate && user._isValid;

        console.log(
          `checkSchedulerTask. Checking user ${user.toLink()} in ${now} (scheduled ${
            user.validationScheduledTime
          }). SkipChecking: ${skipChecking}`
        );

        if (!skipChecking) {
          //global.DEBUG &&
          CheckBot.validateUser(user);
          setNextValidationDate(user);
        }
      }
    }
  }, 60000);
}

const CheckBotCommands: MyBotCommand[] = [
  {
    command: "start",
    description: "начать заново",
    isHidden: false,
    repeatBehavior: CommandRepeatBehavior.skip,
    allowCommand: (user) => !user?.isLocked,
    onServiceInit: (service) => {
      CheckBot.service = service;
      checkSchedulerTask();
    },
    callback: async (ctx) => {
      await playValidation(ctx);
    },
  } as MyBotCommand,
  {
    command: "go",
    description: "начать",
    isHidden: true,
    repeatBehavior: CommandRepeatBehavior.skip,
    allowCommand: (user) => !user?.isLocked,
    callback: async (ctx) => {
      await playValidation(ctx, true);
    },
  } as MyBotCommand,
  CommandSchedule,
  CommandSwitchMode,
];
export default CheckBotCommands;
