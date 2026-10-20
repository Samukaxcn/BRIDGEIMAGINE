// Linux requer DISPLAY/Xvfb. No Windows: npm run test:gui.
const { _electron: electron } = require("playwright-core");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "bridge-gui-")),
  );
  const photos = path.join(root, "photos"),
    other = path.join(root, "Outra pasta");
  await fs.mkdir(photos);
  await fs.mkdir(other);
  await fs.mkdir(path.join(photos, "Subpasta"));
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  for (let i = 1; i <= 3; i++)
    await fs.writeFile(path.join(photos, `image${i}.png`), png);
  await fs.writeFile(path.join(photos, "Thumbs.db"), "system index");
  await fs.writeFile(path.join(other, "other.png"), png);
  let app;
  const errors = [];
  let page;
  try {
    app = await electron.launch({
      executablePath: require("electron"),
      args: [
        ...(process.platform === "linux"
          ? ["--no-sandbox", "--disable-gpu"]
          : []),
        path.resolve("."),
        "--user-data-dir=" + path.join(root, "profile"),
        "--library",
        photos,
      ],
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ":91" },
    });
    page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    const tile = (name) =>
      page
        .locator(".tile")
        .filter({
          has: page.locator(".name", {
            hasText: new RegExp("^" + name.replace(".", "\\.") + "$"),
          }),
        });
    async function caption(value) {
      await page.waitForFunction(
        (text) => document.getElementById("caption").textContent.includes(text),
        value,
      );
    }
    async function folder(value) {
      await page.waitForFunction(
        (text) => document.getElementById("address").value === text,
        value,
      );
    }
    await tile("image3.png").waitFor();
    assert.equal(await tile("Thumbs.db").count(), 0);
    await tile("image2.png").click();
    // Regression: one selected photo still reviews all three, starting on the selected one.
    await page.keyboard.press("Control+b");
    await caption("2 / 3");
    await page.waitForFunction(
      () => document.querySelector("#carousel img.center").naturalWidth > 0,
    );
    assert.equal(
      await app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win.isFullScreen()) return true;
        return new Promise((resolve) => {
          const timer = setTimeout(() => resolve(win.isFullScreen()), 5000);
          win.once("enter-full-screen", () => {
            clearTimeout(timer);
            resolve(true);
          });
        });
      }),
      true,
    );
    await page.keyboard.press("ArrowRight");
    await caption("3 / 3");
    await page.keyboard.press("ArrowLeft");
    await caption("2 / 3");
    await page.locator("#nextPhoto").click();
    await caption("3 / 3");
    await page.locator("#previousPhoto").click();
    await caption("2 / 3");
    await page.keyboard.press("ArrowDown");
    await caption("2 / 2");
    assert.equal(
      (await fs.readdir(photos)).filter((p) => p.endsWith(".png")).length,
      3,
    );
    await page.keyboard.press("ArrowUp");
    await caption("2 / 3");
    await page.keyboard.press("6");
    await caption("Abertura");
    await page.keyboard.press("Control+5");
    await caption("★★★★★");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".tile.selected").count(), 2);
    // Multi-selection remains a deliberately restricted review set.
    await page.keyboard.press("Control+b");
    await caption("/ 2");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await caption("Nenhuma foto");
    await page.keyboard.press("ArrowUp");
    await caption("/ 1");
    await page.keyboard.press("ArrowUp");
    await caption("/ 2");
    await page.keyboard.press("Escape");
    // A select retaining focus must not swallow the review arrows.
    await page.locator("#label").focus();
    await page.keyboard.press("Control+b");
    await caption("2 / 2");
    await page.keyboard.press("ArrowRight");
    await caption("1 / 2");
    await page.keyboard.press("ArrowRight");
    await caption("2 / 2");
    await page.keyboard.press("Escape");
    // Configure the same color under a different name and combination.
    await page.locator("#preferences").click();
    const red = page.locator('.settingsRow[data-id="red"]');
    await red.locator(".labelNameInput").fill("Entrada");
    await red.locator(".shortcutInput").click();
    await page.keyboard.press("Alt+a");
    await page.locator("#saveSettings").click();
    await page.waitForFunction(
      () => !document.getElementById("settingsDialog").open,
    );
    await tile("image1.png").click();
    await page.keyboard.press("Alt+a");
    await page.waitForFunction(
      () =>
        document.querySelector(".tile.selected .label")?.textContent ===
        "Entrada",
    );
    await page.reload();
    await tile("image3.png").waitFor();
    await page.locator("#preferences").click();
    assert.equal(await red.locator(".labelNameInput").inputValue(), "Entrada");
    assert.equal(await red.locator(".shortcutInput").inputValue(), "Alt+A");
    await page.locator("#cancelSettings").click();
    await tile("image2.png").click();
    assert.equal(
      await tile("image2.png").locator(".label").textContent(),
      "Entrada",
    );
    await page.keyboard.press("Space");
    await caption("2 / 3");
    await page.keyboard.press("ArrowRight");
    await caption("3 / 3");
    await page.keyboard.press("Escape");
    // Explorer: actual double-click, parent beyond the initial root, history, and typed addresses.
    await tile("Subpasta").dblclick();
    await folder(path.join(photos, "Subpasta"));
    await page.locator("#up").click();
    await folder(photos);
    await page.locator("#up").click();
    await folder(root);
    await page.locator("#back").click();
    await folder(photos);
    await page.locator("#forward").click();
    await folder(root);
    await page.keyboard.press("Control+l");
    await page.keyboard.type(other);
    await page.keyboard.press("Enter");
    await folder(other);
    await tile("other.png").waitFor();
    await page.locator("#back").click();
    await folder(root);
    await page.locator("#forward").click();
    await folder(other);
    await page.locator("#computer").click();
    await folder("Este Computador");
    assert.ok((await page.locator("#tree .treeRow").count()) > 0);
    await page.keyboard.press("Control+l");
    await page.keyboard.type(photos);
    await page.keyboard.press("Enter");
    await folder(photos);
    // File operations and persistent configurable shortcuts after navigating.
    await tile("image1.png").click();
    await page.keyboard.press("5");
    await page.waitForFunction(
      () =>
        document.querySelector(".tile.selected .label")?.textContent === "Pais",
    );
    await tile("image2.png").click();
    await tile("image3.png").click({ modifiers: ["Control"] });
    await page.locator("#rename").click();
    await page.locator("#start").fill("39");
    await page.locator("#preview").click();
    await page.waitForFunction(() =>
      document.getElementById("plan").textContent.includes("039.png"),
    );
    await page.locator("#apply").click();
    await page.waitForFunction(() => !document.getElementById("batch").open);
    assert.deepEqual(
      (await fs.readdir(photos)).filter((p) => p.endsWith(".png")).sort(),
      ["039.png", "040.png", "image1.png"],
    );
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.resolve("screenshot.png") });
    console.log(
      "GUI OK: seleção única/múltipla, setas/botões, foco, remoção/restauração sem exclusão, rótulos e atalhos persistentes, navegação Explorer, tela cheia e renomeação.",
    );
  } catch (error) {
    if (page) {
      console.error(
        "Caption:",
        await page
          .locator("#caption")
          .textContent()
          .catch(() => "unavailable"),
      );
      console.error(
        "UI error:",
        await page
          .locator("#error")
          .textContent()
          .catch(() => "unavailable"),
      );
      await page
        .screenshot({ path: path.resolve("gui-failure.png") })
        .catch(() => {});
    }
    throw error;
  } finally {
    if (app) await app.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
