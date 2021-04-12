import cfg from "./appSettings.json";
import cfgPrivate from "./appSettings.private.json";

/* expected appSettings.private.json
{
  "all": {
    "ownerRegisterCmd": ""
  },
  "prod": {
    "botToken": "...",
    "botCheckToken": "...",
    "botSettingsPath": "yourBot.prod.cfg"
  },
  "dev": {
    "botToken": "...",
    "botCheckToken": "...",
    "botSettingsPath": "yourBot.dev.cfg"
  }
}
*/

const appSettings = Object.assign(cfg, cfgPrivate.all, process.env.DEV ? cfgPrivate.dev : cfgPrivate.prod);

export default appSettings;
