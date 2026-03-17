import { PluginManager, Hook } from "@server/utils/PluginManager";
import config from "../plugin.json";
import router from "./api/tldr";

const enabled = !!process.env.OPENROUTER_API_KEY;

if (enabled) {
  PluginManager.add({
    ...config,
    type: Hook.API,
    value: router,
  });
}
