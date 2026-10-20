const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);
const COMPUTER = "computer";
function breadcrumbs(folder, paths = path) {
  const root = paths.parse(folder).root;
  const parts = folder.slice(root.length).split(paths.sep).filter(Boolean);
  let current = root;
  return [
    { name: root, path: root },
    ...parts.map((name) => {
      current = paths.join(current, name);
      return { name, path: current };
    }),
  ];
}
function parentOf(folder, paths = path) {
  const parent = paths.dirname(folder);
  return parent === folder ? COMPUTER : parent;
}
class Navigation {
  constructor(library, places = [], options = {}) {
    this.library = library;
    this.places = places;
    this.history = [];
    this.index = -1;
    this.target = COMPUTER;
    this.driveProvider = options.driveProvider;
  }
  async drives() {
    if (this.driveProvider) return this.driveProvider();
    if (this.driveCache && Date.now() - this.driveCache.time < 30000)
      return this.driveCache.items;
    if (process.platform !== "win32") return [{ name: "Disco (/)", path: "/" }];
    try {
      const { stdout } = await run(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "[System.IO.DriveInfo]::GetDrives() | Select-Object Name,DriveType | ConvertTo-Json -Compress",
        ],
        { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 },
      );
      const result = JSON.parse(stdout.replace(/^\uFEFF/, ""));
      const items = [result]
        .flat()
        .filter(Boolean)
        .map((d) => ({
          path: d.Name,
          name: `${Number(d.DriveType) === 4 ? "Unidade de rede" : "Unidade"} (${d.Name.replace(/\\$/, "")})`,
        }));
      this.driveCache = { time: Date.now(), items };
      return items;
    } catch {
      return [
        {
          name: "Unidade do sistema",
          path: path.parse(process.env.SystemRoot || "C:\\Windows").root,
        },
      ];
    }
  }
  address(input) {
    if (
      typeof input !== "string" ||
      input.length > 32767 ||
      input.includes("\0")
    )
      throw Error("Endereço inválido.");
    let value = input.trim();
    if (value === COMPUTER || value.toLocaleLowerCase("pt-BR") === "este computador") return COMPUTER;
    if (process.platform === "win32" && /^[a-z]:$/i.test(value)) value += "\\";
    if (process.platform === "win32")
      value = value.replace(
        /%([^%]+)%/g,
        (all, key) => process.env[key] || all,
      );
    if (value === "~" || value.startsWith("~" + path.sep))
      value = path.join(require("node:os").homedir(), value.slice(1));
    if (!path.isAbsolute(value))
      throw Error(
        "Digite o caminho completo da pasta ou um compartilhamento de rede.",
      );
    return path.normalize(value);
  }
  async locations(folder) {
    const drives = await this.drives();
    if (folder && process.platform === "win32" && folder.startsWith("\\\\")) {
      const root = path.parse(folder).root;
      if (!drives.some((d) => d.path.toLowerCase() === root.toLowerCase()))
        drives.push({ name: root, path: root });
    }
    return { places: this.places, drives };
  }
  async navigate(input, historyIndex = null) {
    const target = this.address(input);
    let data;
    // Read first: an unavailable share must not destroy the current folder or history.
    if (target === COMPUTER) {
      const locations = await this.locations();
      data = {
        folder: COMPUTER,
        computer: true,
        parent: null,
        entries: [],
        breadcrumbs: [],
        ...locations,
      };
    } else {
      const previousRoot = this.library.root;
      try {
        data = await this.library.open(target);
      } catch (e) {
        this.library.root = previousRoot;
        throw e;
      }
      data = {
        ...data,
        parent: parentOf(data.folder),
        breadcrumbs: breadcrumbs(data.folder),
        ...(await this.locations(data.folder)),
      };
    }
    this.target = data.folder;
    if (historyIndex !== null) this.index = historyIndex;
    else if (this.history[this.index] !== this.target) {
      this.history = this.history.slice(0, this.index + 1);
      this.history.push(this.target);
      if (this.history.length > 100) this.history.shift();
      this.index = this.history.length - 1;
    }
    return {
      ...data,
      canBack: this.index > 0,
      canForward: this.index < this.history.length - 1,
    };
  }
  back() {
    return this.index > 0
      ? this.navigate(this.history[this.index - 1], this.index - 1)
      : this.refresh();
  }
  forward() {
    return this.index < this.history.length - 1
      ? this.navigate(this.history[this.index + 1], this.index + 1)
      : this.refresh();
  }
  up() {
    return this.navigate(
      this.target === COMPUTER ? COMPUTER : parentOf(this.target),
    );
  }
  refresh() {
    return this.navigate(this.target, this.index < 0 ? null : this.index);
  }
  async children(input) {
    const dir = this.address(input);
    if (dir === COMPUTER) return this.drives();
    const result = await fs.readdir(dir, { withFileTypes: true });
    return result
      .filter(
        (d) =>
          d.isDirectory() &&
          !["System Volume Information", "$RECYCLE.BIN"].includes(d.name),
      )
      .map((d) => ({ name: d.name, path: path.join(dir, d.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  }
}
module.exports = { Navigation, COMPUTER, breadcrumbs, parentOf };
