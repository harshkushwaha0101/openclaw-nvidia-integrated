import { defineSingleProviderPluginEntry } from "openclaw/plugin-sdk/provider-entry";
import { buildNvidiaProvider } from "./provider-catalog.js";

const PROVIDER_ID = "nvidia";

export default defineSingleProviderPluginEntry({
  id: PROVIDER_ID,
  name: "NVIDIA Provider",
  description: "Bundled NVIDIA provider plugin for NVIDIA NIM API",
  provider: {
    label: "NVIDIA",
    docsPath: "/providers/nvidia",
    envVars: ["NVIDIA_API_KEY", "NVIDIA_NIM_BASE_URL"],
    auth: [],
    catalog: {
      buildProvider: buildNvidiaProvider,
    },
  },
});
