const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Library } = require("../library.cjs");
const { Navigation, breadcrumbs, parentOf } = require("../navigation.cjs");

async function setup(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "bridge-navigation-")),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const a = path.join(root, "A"),
    b = path.join(root, "B");
  await fs.mkdir(a);
  await fs.mkdir(b);
  await fs.writeFile(path.join(a, "photo.jpg"), "photo");
  await fs.writeFile(path.join(a, "Thumbs.db"), "index");
  const library = new Library(path.join(root, "catalog.json"));
  await library.init();
  const nav = new Navigation(library, [], {
    driveProvider: async () => [{ name: "Disco de teste", path: root }],
  });
  return { root, a, b, library, nav };
}
test("navega acima da pasta inicial, volta, avança e descarta o futuro ao mudar de caminho", async (t) => {
  const { root, a, b, nav } = await setup(t);
  await nav.navigate(a);
  assert.equal((await nav.up()).folder, root);
  assert.equal((await nav.back()).folder, a);
  assert.equal((await nav.forward()).folder, root);
  await nav.back();
  const data = await nav.navigate(b);
  assert.equal(data.canForward, false);
  assert.equal((await nav.back()).folder, a);
});
test("pasta inexistente mantém o conteúdo e o histórico atuais", async (t) => {
  const { root, a, library, nav } = await setup(t);
  const before = await nav.navigate(a);
  await assert.rejects(() => nav.navigate(path.join(root, "inexistente")));
  assert.equal(nav.target, a);
  assert.equal(library.current, a);
  assert.equal(library.root, a);
  assert.equal(library.get(before.entries[0].id).name, "photo.jpg");
  assert.equal(nav.history.length, 1);
});
test("Este Computador e expansão de árvore não alteram os arquivos da pasta aberta", async (t) => {
  const { root, a, nav, library } = await setup(t);
  const computer = await nav.navigate("computer");
  assert.equal(computer.drives[0].path, root);
  await nav.navigate(a);
  assert.equal((await nav.children(root)).length, 2);
  assert.equal(library.current, a);
  assert.deepEqual(
    (await nav.refresh()).entries.map((e) => e.name),
    ["photo.jpg"],
  );
  assert.equal((await nav.back()).computer, true);
});
test("caminhos Windows preservam raízes de unidades e compartilhamentos UNC", () => {
  assert.equal(parentOf("C:\\Fotos\\Evento", path.win32), "C:\\Fotos");
  assert.equal(parentOf("C:\\", path.win32), "computer");
  const share = "\\\\Servidor\\ftp2026\\";
  assert.equal(parentOf(share, path.win32), "computer");
  const crumbs = breadcrumbs(
    share + "AGENCIA RETRATO\\Album amostra",
    path.win32,
  );
  assert.deepEqual(
    crumbs.map((c) => c.path),
    [
      share,
      share + "AGENCIA RETRATO",
      share + "AGENCIA RETRATO\\Album amostra",
    ],
  );
});
