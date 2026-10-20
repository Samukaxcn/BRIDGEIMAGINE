const fs = require("node:fs/promises");
const path = require("node:path");
const { normalize } = require("./ui/shortcuts.js");
const DEFAULT_LABELS = [
  { id: "red", name: "Abertura", color: "#ff7777", shortcut: "6" },
  { id: "yellow", name: "Colação", color: "#efcf65", shortcut: "7" },
  { id: "green", name: "Diploma", color: "#7fca77", shortcut: "8" },
  { id: "blue", name: "Juramento", color: "#72b7f5", shortcut: "9" },
  { id: "pink", name: "Pais", color: "#d190e3", shortcut: "5" },
];
function validateLabels(labels) {
  if (!Array.isArray(labels) || labels.length !== DEFAULT_LABELS.length)
    throw Error("Configure os cinco rótulos.");
  const names = new Set(),
    keys = new Set();
  return DEFAULT_LABELS.map((base, index) => {
    const value = labels[index];
    if (!value || value.id !== base.id || typeof value.name !== "string")
      throw Error("Rótulo inválido.");
    const name = value.name.trim();
    if (!name || name.length > 60 || /[\x00-\x1f]/.test(name))
      throw Error("Use nomes de 1 a 60 caracteres.");
    const nameKey = name.toLocaleLowerCase("pt-BR");
    if (names.has(nameKey))
      throw Error("Os rótulos precisam ter nomes diferentes.");
    names.add(nameKey);
    const shortcut = normalize(value.shortcut);
    if (shortcut && keys.has(shortcut))
      throw Error(`O atalho ${shortcut} está repetido.`);
    if (shortcut) keys.add(shortcut);
    return { id: base.id, name, color: base.color, shortcut };
  });
}
class Preferences {
  constructor(file) {
    this.file = file;
    this.labels = structuredClone(DEFAULT_LABELS);
  }
  async init() {
    try {
      this.labels = validateLabels(
        JSON.parse(await fs.readFile(this.file, "utf8")).labels,
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  get() {
    return {
      labels: structuredClone(this.labels),
      defaults: structuredClone(DEFAULT_LABELS),
    };
  }
  async save(labels) {
    const valid = validateLabels(labels);
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(
      this.file + ".tmp",
      JSON.stringify({ labels: valid }, null, 2),
    );
    await fs.rename(this.file + ".tmp", this.file);
    this.labels = valid;
    return this.get();
  }
}
module.exports = { Preferences, DEFAULT_LABELS, validateLabels };
