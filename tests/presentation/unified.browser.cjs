/* One native HTML: notes API, disclosure/search targets and print state. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const {spawnSync} = require('node:child_process');
/** @type {Pick<typeof import('playwright'), 'chromium'>} */
const {chromium} = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright') : 'playwright');
const repo = path.resolve(__dirname, '../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'course-unified-'));
(async () => {
  /** @type {import('playwright').Browser | undefined} */ let browser;
  /** @type {import('node:http').Server | undefined} */ let server;
  try {
    fs.mkdirSync(path.join(temporary, '_extensions'));
    for (const name of ['course-presentation', 'course-navigation']) {
      fs.cpSync(path.join(repo, '_extensions', name), path.join(temporary, '_extensions', name), {recursive: true});
    }
    fs.copyFileSync(path.join(__dirname, 'unified.qmd'), path.join(temporary, 'slides.qmd'));
    const result = spawnSync(process.env.QUARTO || 'quarto', ['render', 'slides.qmd', '--fail-if-warnings'], {cwd: temporary, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stdout + result.stderr);
    server = http.createServer((request, response) => {
      const file = path.join(temporary, decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname));
      if (!file.startsWith(temporary + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
      const types = new Map([['.html', 'text/html'], ['.js', 'text/javascript'], ['.css', 'text/css']]);
      response.setHeader('Content-Type', types.get(path.extname(file)) || 'application/octet-stream');
      fs.createReadStream(file).pipe(response);
    });
    const serving = server;
    await new Promise(resolve => serving.listen(0, '127.0.0.1', () => resolve(undefined)));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const url = `http://127.0.0.1:${address.port}/slides.html`;
    browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}),
      args: ['--no-sandbox', '--disable-dev-shm-usage']});
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    /** @type {string[]} */
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    /** @param {string} suffix */
    const open = async suffix => { await page.goto('about:blank'); await page.goto(url + suffix, {waitUntil: 'networkidle'}); await page.waitForFunction(() => window.Reveal?.isReady()); };
    await open('#/sec-first');
    assert.equal(await page.locator('body').getAttribute('data-course-mode'), 'study', 'Ordinary opening must use study');
    assert.equal(await page.locator('.speaker-notes').getByText('COMMON_NOTE_MARKER', {exact: false}).isVisible(), true, 'Native common notes are visible');
    assert.equal(await page.locator('#sol-first').isVisible(), false, 'Answer initially collapsed');
    const speakerPromise = page.waitForEvent('popup');
    await page.keyboard.press('s');
    const speaker = await speakerPromise;
    await speaker.waitForFunction(() => document.querySelector('.speaker-controls-notes .value')?.textContent?.includes('COMMON_NOTE_MARKER'));
    await speaker.close();
    await page.locator('#sol-first').evaluate(node => { (() => { const details = node.closest('details'); if (!details) throw new Error('Нет details'); return details; })().open = true; });
    await page.getByRole('button', {name: 'Режим аудитории', exact: true}).click();
    assert.equal(await page.locator('body').getAttribute('data-course-mode'), 'lecture');
    assert.equal(await page.locator('.speaker-notes').isVisible(), false);
    assert.equal(await page.locator('#sol-first').isVisible(), true, 'Mode preserves open answer');
    assert.equal(await page.locator('.course-nav-footer').isVisible(), false, 'В аудитории нижняя панель скрыта');
    assert.equal(await page.locator('.course-nav-sidebar').isVisible(), true, 'Разделы доступны в аудитории');
    assert.equal(await page.locator('.course-mode-toggle').getAttribute('aria-keyshortcuts'), 'Alt+Shift+A');
    for (const width of [390, 320]) {
      await page.setViewportSize({width, height: 760});
      const topics = await page.locator('.course-nav-sidebar').boundingBox();
      const slides = await page.locator('body > .reveal').boundingBox();
      assert.ok(topics && slides && slides.y >= topics.y + topics.height - 1, 'На узком экране слайды расположены под разделами');
      assert.ok(await page.locator('.course-nav-sidebar [aria-current="step"]').isVisible());
    }
    await page.evaluate(() => document.body.classList.add('course-navigation-no-sidebar'));
    assert.equal(await page.locator('.course-nav-sidebar').isVisible(), false, 'sidebar:false сохраняется в мобильной аудитории');
    await page.evaluate(() => document.body.classList.remove('course-navigation-no-sidebar'));
    await page.setViewportSize({width:1280, height:900});
    await page.keyboard.press('Alt+Shift+KeyA');
    assert.equal(await page.locator('body').getAttribute('data-course-mode'), 'study', 'Сочетание возвращает режим изучения');
    await page.evaluate(() => {
      const input = document.createElement('textarea'); document.body.append(input); input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyA', key:'Ф', altKey:true, shiftKey:true, bubbles:true}));
      input.remove();
    });
    assert.equal(await page.locator('body').getAttribute('data-course-mode'), 'study', 'Ввод в форме не переключает режим');
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyA', key:'Ф', altKey:true, shiftKey:true, bubbles:true})));
    assert.equal(await page.locator('body').getAttribute('data-course-mode'), 'lecture', 'Физическая клавиша работает при русской раскладке');
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(() => window.Reveal?.isReady());
    assert.equal(await page.locator('body').getAttribute('data-course-mode'), 'study', 'Mode does not persist');
    await open('?course-mode=lecture#/sec-second');
    assert.equal(await page.locator('body').getAttribute('data-course-mode'), 'lecture', 'Explicit link mode');
    await page.getByRole('button', {name:'Самостоятельное изучение', exact:true}).click();
    /** @param {string} text */
    const search = async text => {
      await page.getByRole('button', {name:'Поиск по слайдам',exact:true}).first().click();
      await page.locator('.course-nav-search-input').fill(text);
      await page.locator('.course-nav-result').first().click();
    };
    await search('NESTED_HINT_MARKER');
    assert.equal(await page.locator('#sol-first').isVisible(), true, 'Search opens answer parents');
    assert.equal(await page.getByText('NESTED_HINT_MARKER', {exact:true}).isVisible(), true, 'Search opens nested hint');
    assert.equal(await page.locator('#sol-second').evaluate(node => (() => { const details = node.closest('details'); if (!details) throw new Error('Нет details'); return details; })().open), false, 'Unrelated answer remains closed');
    await search('NOTE_TARGET_MARKER');
    assert.equal(await page.locator('.speaker-notes').getByText('NOTE_TARGET_MARKER', {exact:true}).isVisible(), true, 'Search exposes target note');
    assert.equal(await page.locator('body').getAttribute('data-course-mode'), 'study', 'Search preserves mode');
    const ids = await page.evaluate(() => [...document.querySelectorAll('[id]')].map(n => n.id));
    assert.equal(new Set(ids).size, ids.length, 'Native notes display must preserve unique authored IDs');
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    assert.equal(await page.locator('details:not([open])').count(), 0);
    assert.equal(await page.locator('.speaker-notes').isVisible(), false, 'Print excludes notes');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    assert.equal(await page.locator('#sol-second').evaluate(node => (() => { const details = node.closest('details'); if (!details) throw new Error('Нет details'); return details; })().open), false, 'Print restores collapsed answer');
    assert.equal(await page.locator('#sol-first').evaluate(node => (() => { const details = node.closest('details'); if (!details) throw new Error('Нет details'); return details; })().open), true, 'Print restores opened answer');
    await open('?course-mode=lecture#/note-target');
    assert.equal(await page.locator('.speaker-notes').getByText('NOTE_TARGET_MARKER', {exact:true}).isVisible(), true, 'Direct hash exposes target note');
    await page.getByRole('button', {name:'Самостоятельное изучение', exact:true}).click();
    await page.getByRole('button',{name:'Обзор всех слайдов',exact:true}).first().click();
    assert.equal(await page.locator('.course-nav-overview-card').count(), 4);
    await page.keyboard.press('Escape');
    await open('?print-pdf');
    await page.waitForSelector('.pdf-page');
    assert.equal(await page.locator('.speaker-notes-pdf').count(), 0);
    await page.emulateMedia({media:'print'});
    const pdf = path.join(temporary,'slides.pdf'); await page.pdf({path:pdf,printBackground:true});
    const text = spawnSync('pdftotext',[pdf,'-'],{encoding:'utf8'});
    assert.equal(text.status,0,text.stderr);
    for (const marker of ['FIRST_SOLUTION_MARKER','SECOND_SOLUTION_MARKER','NESTED_HINT_MARKER']) assert.ok(text.stdout.includes(marker), marker);
    assert.ok(!text.stdout.includes('COMMON_NOTE_MARKER'), 'PDF notes leaked');
    assert.deepEqual(errors,[]);
    console.log('PASS unified native notes, session mode, target search/hash, print state and PDF');
  } finally {
    await browser?.close();
    const serving = server;
    if (serving) await new Promise(resolve => serving.close(() => resolve(undefined)));
    if (process.env.COURSE_PRESENTATION_KEEP) console.log('Fixture:',temporary);
    else fs.rmSync(temporary,{recursive:true,force:true});
  }
})().catch(error => { console.error(error); process.exitCode=1; });
