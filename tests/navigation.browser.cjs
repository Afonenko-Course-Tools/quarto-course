#!/usr/bin/env node
/* Acceptance tests for independent navigation and opt-in BSU styling.
 * Requires Quarto + Playwright + Chromium; no external page or account is used.
 * QUARTO and PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH can select local executables.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '', 'playwright')); }
const root = path.resolve(__dirname, '..');
const project = fs.mkdtempSync(path.join(os.tmpdir(), 'course-navigation-'));
const quarto = process.env.QUARTO || 'quarto';
const source = `---
title: Курс
---

# Модель

## Вопрос {#question}

Как представлена ссылка?

::: {.fragment}
Переменная хранит ссылку.
:::

## Изменение состояния {#aliasing}

Объект хранит состояние.

::: {.fragment}
Две ссылки на один объект.
:::

# Эксперимент {#experiment}

## Сравните {#compare}

::: {.columns}
::: {.column width="30%"}
Ссылка
:::
::: {.column width="70%"}
Состояние
:::
:::

# Обобщение {#summary}

## Главная мысль {#takeaway}

Одна структура и разные стили.
`;
const config = `project:
  type: default
format:
  html:
    theme: cosmo
  revealjs:
    theme: default
    width: 1280
    height: 720
    transition: none
    navigation-mode: linear
    hash: true
    menu: false
    pdf-separate-fragments: false
    revealjs-plugins: [course-navigation]
    course-nav:
      language: ru
      title: Навигация курса
lang: ru
`;
const brand = `brand: _extensions/bsu-theme/_brand.yml
format:
  html:
    theme: [brand, _extensions/bsu-theme/styles/common.scss, _extensions/bsu-theme/styles/book.scss]
  revealjs:
    theme: [brand, _extensions/bsu-theme/styles/common.scss, _extensions/bsu-theme/styles/slides.scss]
`;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const base = '/neutral/slides_files/libs/revealjs';
function fixture(noSidebar = false, empty = false) {
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Fixture</title><link rel="stylesheet" href="${base}/dist/reveal.css"><link rel="stylesheet" href="/_navigation/navigation.css"><div class="reveal"><div class="slides">${empty ? '' : `<section id="title-slide"><h1>Курс</h1></section><section data-visibility="hidden"><h2>Скрытый</h2></section><section><section class="level1"><h1>Типы</h1></section><section><h2>Значения</h2><p class="fragment">Один</p><p class="fragment">Два</p></section></section><section class="level1"><h1>Память</h1></section><section><h2>Объекты</h2><details id="untouched"><summary>Native disclosure</summary>Navigation must not open me</details><aside class="notes">NEVER_SEARCH_THIS</aside></section>`}</div></div><script src="${base}/dist/reveal.js"></script><script src="/_navigation/model.js"></script><script src="/_navigation/ui.js"></script><script src="/_navigation/plugin.js"></script><script>Reveal.initialize({hash:true,width:1200,height:675,transition:'none',scrollActivationWidth:0,courseNav:{sidebar:${!noSidebar}},plugins:[CourseNavigation]});</script></html>`;
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/_fixture') { res.setHeader('Content-Type', mime['.html']); res.end(fixture(url.searchParams.has('no-sidebar'), url.searchParams.has('empty'))); return; }
  const isNav = url.pathname.startsWith('/_navigation/');
  const publicRoot = isNav ? path.join(root, '_extensions/course-navigation/navigation') : project;
  const relative = isNav ? url.pathname.slice('/_navigation/'.length) : url.pathname.slice(1);
  const file = path.resolve(publicRoot, decodeURIComponent(relative));
  if (!file.startsWith(publicRoot + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => { if (err) res.writeHead(404).end(); else { res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(data); } });
});
const counter = (page, value) => page.waitForFunction(expected => document.querySelector('.course-nav-counter')?.textContent === expected, value);
const current = (page, id) => page.waitForFunction(expected => Reveal.getCurrentSlide()?.id === expected, id);
const toolbar = (page, action) => page.locator(`.course-nav-controls [data-action="${action}"]`);
async function geometry(page, expectedLeft) {
  const g = await page.evaluate(() => {
    const r = document.querySelector('.reveal').getBoundingClientRect(), f = document.querySelector('.course-nav-footer').getBoundingClientRect();
    return { left:r.left, bottom:r.bottom, footerTop:f.top, overflow:document.documentElement.scrollWidth > innerWidth,
      tooSmall:[...document.querySelectorAll('.course-nav-controls button')].filter(n=>getComputedStyle(n).display !== 'none').some(n=>{const b=n.getBoundingClientRect();return b.width<44||b.height<44;}) };
  });
  assert.equal(g.left, expectedLeft); assert.ok(g.bottom <= g.footerTop + 1); assert.equal(g.overflow, false); assert.equal(g.tooSmall, false);
}
async function identity(page) {
  return page.evaluate(() => Reveal.getSlides().map(slide=>({id:slide.id,fragments:slide.querySelectorAll('.fragment').length})));
}
(async () => {
  let browser;
  try {
    for (const name of ['course-navigation', 'bsu-theme']) fs.cpSync(path.join(root, '_extensions', name), path.join(project, '_extensions', name), {recursive:true});
    fs.writeFileSync(path.join(project, 'slides.qmd'), source);
    fs.writeFileSync(path.join(project, 'book.qmd'), '# Книга\n\n## Тема {#sec-topic}\n\nМатериал книги и [ссылка](#sec-topic).\n');
    fs.writeFileSync(path.join(project, '_quarto.yml'), config);
    fs.writeFileSync(path.join(project, '_quarto-bsu.yml'), brand);
    for (const [output, args] of [['neutral', []], ['branded', ['--profile','bsu']]]) {
      execFileSync(quarto, ['render','slides.qmd','--to','revealjs','--output-dir',output,'--fail-if-warnings',...args], {cwd:project,stdio:'pipe'});
      execFileSync(quarto, ['render','book.qmd','--to','html','--output-dir',output,'--fail-if-warnings',...args], {cwd:project,stdio:'pipe'});
    }
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await playwright.chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
    const errors=[];
    const page=await browser.newPage({viewport:{width:1280,height:720}}); page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${origin}/neutral/book.html`);
    assert.equal(await page.locator('.course-nav-shell').count(),0);
    assert.equal(await page.locator('#sec-topic').count(),1);
    await page.goto(`${origin}/branded/book.html`);
    assert.equal(await page.locator('.course-nav-shell').count(),0);
    assert.equal(await page.locator('#sec-topic').count(),1);
    assert.equal(await page.locator('#quarto-content').evaluate(n=>getComputedStyle(n).borderTopColor),'rgb(10, 52, 112)');
    await page.goto(`${origin}/neutral/slides.html`); await counter(page,'Слайд 1 / 8');
    const neutralIdentity=await identity(page);
    assert.equal(await page.locator('.course-nav-shell').evaluate(n=>getComputedStyle(n).color),'rgb(36, 41, 47)');
    await page.goto(`${origin}/branded/slides.html`); await counter(page,'Слайд 1 / 8');
    assert.deepEqual(await identity(page),neutralIdentity,'Theme must not alter slide IDs or fragment counts');
    assert.equal(await page.locator('.course-nav-shell').evaluate(n=>getComputedStyle(n).color),'rgb(10, 52, 112)');
    await page.locator('.course-nav-sidebar .course-nav-topic').filter({hasText:'Обобщение'}).click(); await current(page,'summary');
    await toolbar(page,'prevSection').click(); await current(page,'experiment');
    await toolbar(page,'nextSection').click(); await current(page,'summary');
    await toolbar(page,'back').click(); await current(page,'experiment');
    await toolbar(page,'forward').click(); await current(page,'summary');
    await toolbar(page,'overview').click();
    assert.equal(await page.locator('.course-nav-overview-jump').count(),8);
    assert.ok((await page.locator('.course-nav-overview-grid').boundingBox()).y<150);
    assert.equal(await page.locator('[id="aliasing"]').count(),1);
    await page.locator('.course-nav-overview-jump[data-slide="2"]').click(); await current(page,'question');
    await toolbar(page,'next').click(); await current(page,'question');
    assert.equal(await page.evaluate(()=>Reveal.getCurrentSlide().querySelectorAll('.fragment.visible').length),1);
    await page.keyboard.press('Escape'); await page.waitForFunction(()=>document.querySelector('.course-nav-overview')?.open);
    await page.keyboard.press('Escape'); await page.waitForFunction(()=>!document.querySelector('.course-nav-overview')?.open);
    assert.equal(await toolbar(page,'next').evaluate(n=>n===document.activeElement),true,'Closing a keyboard-opened dialog restores its invoking focus');
    await toolbar(page,'search').click(); await page.locator('.course-nav-search-input').fill('Объект хранит');
    await page.locator('.course-nav-result').click(); await current(page,'aliasing');
    await geometry(page,210);
    await page.emulateMedia({media:'print'}); assert.equal(await page.locator('.course-nav-shell').isVisible(),false); await page.emulateMedia({media:'screen'});
    const [printPage]=await Promise.all([page.context().waitForEvent('page'),toolbar(page,'print').click()]);
    await printPage.waitForFunction(()=>window.Reveal?.isReady() && document.querySelectorAll('.pdf-page').length===8);
    assert.equal(await printPage.locator('.course-nav-shell').count(),0);
    await current(page,'aliasing'); await printPage.close();
    const mobile=await browser.newPage({viewport:{width:390,height:844}}); mobile.on('pageerror',e=>errors.push(e.message));
    await mobile.goto(`${origin}/branded/slides.html`); await counter(mobile,'Слайд 1 / 8');
    await toolbar(mobile,'topics').click();
    await mobile.locator('.course-nav-dialog[open] [data-action="nextSection"]').click();
    assert.equal(await mobile.locator('.course-nav-dialog[open]').count(),0,'Mobile section action left destination obscured');
    await toolbar(mobile,'topics').click();
    await mobile.locator('.course-nav-dialog[open] [data-action="back"]').click();
    await counter(mobile,'Слайд 1 / 8');
    assert.equal(await mobile.locator('.course-nav-dialog[open]').count(),0,'Mobile history action left destination obscured');
    await toolbar(mobile,'topics').click(); await mobile.locator('.course-nav-dialog[open] .course-nav-topic').filter({hasText:'Эксперимент'}).click(); await current(mobile,'experiment');
    await geometry(mobile,0); await toolbar(mobile,'overview').click();
    const grid=await mobile.locator('.course-nav-overview-grid').boundingBox(); assert.ok(grid.x>=0 && grid.x+grid.width<=390);
    await mobile.locator('.course-nav-overview-jump[data-slide="7"]').click(); await current(mobile,'takeaway');
    await mobile.setViewportSize({width:320,height:700}); await geometry(mobile,0);
    await page.goto(`${origin}/_fixture`); await counter(page,'Слайд 1 / 5');
    await page.locator('.course-nav-sidebar .course-nav-topic').filter({hasText:'Типы'}).click(); await counter(page,'Слайд 2 / 5');
    await toolbar(page,'next').click(); await counter(page,'Слайд 3 / 5');
    await toolbar(page,'next').click(); await counter(page,'Слайд 3 / 5');
    await toolbar(page,'search').click(); await page.locator('.course-nav-search-input').fill('NEVER_SEARCH_THIS');
    assert.equal(await page.locator('.course-nav-result-count').textContent(),'Ничего не найдено'); await page.keyboard.press('Escape');
    await page.goto(`${origin}/_fixture?no-sidebar`); await counter(page,'Слайд 1 / 5'); await geometry(page,0);
    await page.goto(`${origin}/_fixture?empty`); await counter(page,'Слайд 0 / 0');
    await page.goto(`${origin}/_fixture?print-pdf`); await page.waitForFunction(()=>Reveal.isReady());
    assert.equal(await page.locator('.course-nav-shell').count(),0);
    assert.equal(await page.locator('#untouched').getAttribute('open'),null,'Navigation must not own answer/disclosure printing');
    assert.deepEqual(errors,[]);
    console.log('PASS cosmo/BSU HTML and native Reveal render, identity parity, sections/history, fragments, overview/search, 1280/390/320px, print, hidden/vertical slides, notes, empty deck, sidebar off');
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve=>server.close(resolve));
    fs.rmSync(project,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
