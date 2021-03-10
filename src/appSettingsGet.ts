import cfg from "./appSettings.json";
import cfgPrivate from "./appSettings.private.json";

const appSettings = Object.assign(cfg, cfgPrivate);

export default appSettings;
