const assert = require("node:assert/strict");
const path = require("node:path");
/** @type {Pick<typeof import('playwright'), 'chromium'>} */
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
      ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "playwright")
      : "playwright"),
);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.CHROMIUM;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  try {
    for (const lang of ["ru", "en", "de"]) {
      const page = await browser.newPage();
      await page.setContent(
        `<html lang="${lang}"><body><div id="quarto-search"><div class="aa-Autocomplete" aria-label="Search"></div><button title="Search"></button></div><a class="anchorjs-link" aria-label="Anchor"></a><div class="reveal"><div class="speaker-notes"><div class="notes-placeholder">No notes on this slide.</div></div></div></body></html>`,
      );
      await page.evaluate(() => {
        const element = document.querySelector(".reveal");
        if (!(element instanceof HTMLElement)) throw new Error("Нет reveal");
        window.Reveal = {
          isReady: () => true,
          isSpeakerNotes: () => false,
          getRevealElement: () => element,
          configure: () => {},
          on: () => {},
          off: () => {},
          getConfig: () => ({}),
          getCurrentSlide: () => undefined,
          getSlides: () => [],
          getIndices: () => ({ h: 0, v: 0 }),
          slide: () => {},
          availableFragments: () => ({ prev: false, next: false }),
          prev: () => {},
          next: () => {},
          layout: () => {},
          toggleOverview: () => {},
        };
      });
      await page.addScriptTag({ path: path.resolve(__dirname, "../_extensions/course-presentation/presentation.js") });
      assert.equal(
        await page.locator("#quarto-search button").getAttribute("title"),
        lang === "ru" ? "Поиск" : "Search",
      );
      assert.equal(
        await page.locator(".anchorjs-link").getAttribute("aria-label"),
        lang === "ru" ? "Ссылка на раздел" : "Anchor",
      );
      assert.equal(
        await page.locator(".notes-placeholder").textContent(),
        lang === "ru" ? "Заметок к этому слайду нет." : "No notes on this slide.",
      );
      await page.evaluate(() => {
        const link = document.createElement("a");
        link.id = "late-anchor";
        link.className = "anchorjs-link";
        link.setAttribute("aria-label", "Anchor");
        document.body.append(link);
      });
      const label = lang === "ru" ? "Ссылка на раздел" : "Anchor";
      await page.locator(`#late-anchor[aria-label="${label}"]`).waitFor({ state: "attached" });
      await page.close();
    }
    console.log("PASS русские подписи, динамические якоря и отсутствие вмешательства в en/de");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
