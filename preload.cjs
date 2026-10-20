const { contextBridge, ipcRenderer } = require("electron");
const api = {};
for (const name of [
  "fullscreen",
  "bootstrap",
  "open",
  "navigate",
  "folder",
  "back",
  "forward",
  "up",
  "children",
  "refresh",
  "settings",
  "saveSettings",
  "rate",
  "preview",
  "rename",
]) {
  api[name] = (...args) => ipcRenderer.invoke(name, ...args);
}
contextBridge.exposeInMainWorld("bridge", api);
