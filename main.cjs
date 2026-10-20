const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  net,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Library } = require("./library.cjs");
const { Navigation } = require("./navigation.cjs");
const { Preferences } = require("./preferences.cjs");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "photo",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
app.whenReady().then(async () => {
  const lib = new Library(path.join(app.getPath("userData"), "catalog.json"));
  const preferences = new Preferences(
    path.join(app.getPath("userData"), "preferences.json"),
  );
  await lib.init();
  await preferences.init();
  const places = [
    ["home", "Pasta pessoal"],
    ["desktop", "Área de Trabalho"],
    ["documents", "Documentos"],
    ["pictures", "Imagens"],
    ["downloads", "Downloads"],
  ].map(([key, name]) => ({ name, path: app.getPath(key) }));
  const navigation = new Navigation(lib, places);
  let preview = null;
  let queue = Promise.resolve();
  protocol.handle("photo", async (request) => {
    try {
      const e = lib.get(new URL(request.url).hostname);
      const stat = await fs.lstat(e.path);
      if (stat.isSymbolicLink() || !e.photo)
        return new Response("Indisponível", { status: 404 });
      return net.fetch(pathToFileURL(e.path).href);
    } catch {
      return new Response("Indisponível", { status: 404 });
    }
  });
  const win = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 950,
    minHeight: 640,
    backgroundColor: "#202124",
    title: "BRIDGEIMAGINE",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  const on = (name, fn, serialized = true) =>
    ipcMain.handle(name, async (event, ...args) => {
      if (
        event.sender !== win.webContents ||
        event.senderFrame !== win.webContents.mainFrame
      )
        throw Error("Origem inválida.");
      if (!serialized) return fn(...args);
      const task = queue.then(() => fn(...args));
      queue = task.catch(() => {});
      return task;
    });
  const navigate = async (address) => {
    const next = await navigation.navigate(address);
    preview = null;
    return next;
  };
  on("fullscreen", (value) => win.setFullScreen(Boolean(value)), false);
  on("bootstrap", async () => {
    const i = process.argv.indexOf("--library");
    return {
      settings: preferences.get(),
      platform: process.platform,
      library: await navigate(
        i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : "computer",
      ),
    };
  });
  on("open", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });
    return result.canceled ? null : navigate(result.filePaths[0]);
  });
  on("navigate", navigate);
  on("folder", (id) => navigate(lib.get(id).path));
  on("back", () => navigation.back());
  on("forward", () => navigation.forward());
  on("up", () => navigation.up());
  on("children", (address) => navigation.children(address));
  on("refresh", () => {
    navigation.driveCache = null;
    return navigation.refresh();
  });
  on("settings", () => preferences.get());
  on("saveSettings", (labels) => preferences.save(labels));
  on("rate", async (ids, patch) => {
    if (navigation.target === "computer")
      throw Error("Abra uma pasta para classificar arquivos.");
    await lib.rate(ids, patch);
    return navigation.refresh();
  });
  on("preview", (ids, start, padding, prefix) => {
    if (navigation.target === "computer")
      throw Error("Abra uma pasta primeiro.");
    preview = {
      folder: lib.current,
      rows: lib.preview(ids, start, padding, prefix),
    };
    return preview.rows;
  });
  on("rename", async () => {
    if (
      !preview ||
      navigation.target !== preview.folder ||
      preview.folder !== lib.current
    )
      throw Error("Gere uma prévia nesta pasta primeiro.");
    const rows = preview.rows;
    preview = null;
    await lib.rename(rows);
    return navigation.refresh();
  });
  await win.loadFile("ui/index.html");
});
app.on("window-all-closed", () => app.quit());
