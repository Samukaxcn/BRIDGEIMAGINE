const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  Preferences,
  DEFAULT_LABELS,
  validateLabels,
} = require("../preferences.cjs");
const { Library } = require("../library.cjs");

test("nomes e teclas persistem, preservando a associação das fotos mesmo após renomear o rótulo", async (t) => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "bridge-settings-")),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const folder = path.join(root, "photos");
  await fs.mkdir(folder);
  const photo = path.join(folder, "photo.jpg");
  await fs.writeFile(photo, "photo");
  const file = path.join(root, "catalog.json");
  await fs.writeFile(
    file,
    JSON.stringify({ [photo]: { rating: 4, label: "Abertura" } }),
  );
  const lib = new Library(file);
  await lib.init();
  assert.equal((await lib.open(folder)).entries[0].label, "red");
  const prefFile = path.join(root, "preferences.json");
  const pref = new Preferences(prefFile);
  await pref.init();
  const labels = pref.get().labels;
  labels[0].name = "Entrada";
  labels[0].shortcut = "alt+a";
  await pref.save(labels);
  const loaded = new Preferences(prefFile);
  await loaded.init();
  assert.equal(loaded.get().labels[0].name, "Entrada");
  assert.equal(loaded.get().labels[0].shortcut, "Alt+A");
  const entry = (await lib.list(folder)).entries[0];
  await lib.rate([entry.id], { rating: 5 });
  assert.equal((await lib.list(folder)).entries[0].label, "red");
});
test("bloqueia conflitos de teclas, atalhos reservados e nomes vazios ou duplicados", () => {
  const labels = structuredClone(DEFAULT_LABELS);
  labels[0].shortcut = "7";
  assert.throws(() => validateLabels(labels), /repetido/);
  labels[0].shortcut = "Ctrl+B";
  assert.throws(() => validateLabels(labels), /já é usado/);
  labels[0].shortcut = "6";
  labels[0].name = "  ";
  assert.throws(() => validateLabels(labels), /nomes/);
  labels[0].name = "pais";
  assert.throws(() => validateLabels(labels), /nomes diferentes/);
});
