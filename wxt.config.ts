import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "NexForce with Zoya",
    description: "Zoya, a friendly AI agent that works in your browser, with your approval.",
    permissions: ["sidePanel", "storage", "unlimitedStorage", "tabs", "tabGroups", "scripting", "debugger"],
    host_permissions: ["<all_urls>"],
    action: { default_title: "Open Zoya" },
  },
  // Keep the development browser's data (settings, key) between restarts.
  webExt: {
    chromiumArgs: ["--user-data-dir=./.wxt/chrome-data"],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});