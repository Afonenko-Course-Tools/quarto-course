/* Браузерная приёмочная проверка с Playwright и Chromium.
 * Тема, навигация, сетевые службы и система оценивания не нужны. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const {spawnSync} = require('node:child_process');
const {chromium} = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright') : 'playwright');
const repo = path.resolve(__dirname, '../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'course-presentation-browser-'));
const quarto = process.env.QUARTO || 'quarto';
function render(format, output, extra = []) {
  const result = spawnSync(quarto, ['render', 'fixture.qmd', '--to', format, '--output', output, '--fail-if-warnings', ...extra], {cwd: temporary, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
(async () => {
  let browser, server;
  try {
    fs.mkdirSync(path.join(temporary, '_extensions'));
    fs.cpSync(path.join(repo, '_extensions/course-presentation'), path.join(temporary, '_extensions/course-presentation'), {recursive: true});
    fs.copyFileSync(path.join(__dirname, 'fixture.qmd'), path.join(temporary, 'fixture.qmd'));
    fs.appendFileSync(path.join(temporary, 'fixture.qmd'), '\n## Длинный ответ\n\n::: {#exr-long}\nУпражнение с развёрнутым решением.\n:::\n\n::: {#sol-long for="exr-long"}\n' + Array.from({length: 32}, (_, index) => `Абзац ${index + 1}: подробное объяснение в развёрнутом решении для проверки переноса страниц.\n\n`).join('') + 'LONG_ANSWER_END_MARKER\n:::\n');
    render('html', 'study.html');
    render('revealjs', 'lecture.html');
    fs.writeFileSync(path.join(temporary, 'study.yml'), 'course-presentation:\n  mode: study\n');
    render('revealjs', 'study-slides.html', ['--metadata-file', 'study.yml']);
    server = http.createServer((request, response) => {
      const target = path.join(temporary, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
      if (!target.startsWith(temporary + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404); response.end(); return; }
      const types = {'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2'};
      response.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
      fs.createReadStream(target).pipe(response);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']});
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/study.html`, {waitUntil: 'networkidle'});
    await page.evaluate(() => { const link = document.querySelector('a.quarto-xref[href="#sol-predict"]'); const spacer = document.createElement('div'); spacer.style.height = '2500px'; document.querySelector('main').prepend(link, spacer); });
    assert.equal(await page.locator('#sol-predict').isVisible(), false, 'Решение в режиме study должно быть изначально свёрнуто');
    await page.locator('a.quarto-xref[href="#sol-predict"]').click();
    await page.locator('#sol-predict').waitFor({state: 'visible'});
    await page.waitForFunction(() => { const box = document.getElementById('sol-predict').getBoundingClientRect(); return box.top >= 0 && box.top < innerHeight; });
    assert.equal(await page.locator('[data-course-role="reading"] .course-meta-time').count(), 0, 'Материалы унаследовали метаданные деятельности');
    await page.goto(`${base}/lecture.html`, {waitUntil: 'networkidle'});
    await page.waitForFunction(() => window.Reveal?.isReady());
    await page.evaluate(() => { const position = Reveal.getIndices(document.getElementById('sec-predict')); Reveal.slide(position.h, position.v, -1); });
    const start = await page.evaluate(() => Reveal.getIndices().h);
    assert.equal(await page.locator('.course-answer-solution').filter({has: page.locator('#sol-predict')}).evaluate((element) => element.classList.contains('visible')), false);
    await page.keyboard.press('ArrowRight'); // вложенная подсказка
    await page.keyboard.press('ArrowRight'); // ответ
    assert.equal(await page.evaluate(() => Reveal.getIndices().h), start, 'Переход вперёд сменил слайд до раскрытия ответа');
    assert.equal(await page.locator('.course-answer-solution').filter({has: page.locator('#sol-predict')}).evaluate((element) => element.classList.contains('visible')), true, 'Переход вперёд не раскрыл ответ');
    await page.goto(`${base}/study-slides.html`, {waitUntil: 'networkidle'});
    await page.waitForFunction(() => window.Reveal?.isReady());
    await page.evaluate(() => { const position = Reveal.getIndices(document.getElementById('sec-predict')); Reveal.slide(position.h, position.v); });
    const detail = page.locator('.course-answer-solution details').filter({has: page.locator('#sol-predict')});
    assert.equal(await detail.getAttribute('open'), null);
    await page.locator('a.quarto-xref[href="#/sol-predict"]').click();
    await page.waitForFunction(() => document.getElementById('sol-predict').closest('details').open);
    await detail.evaluate((element) => { element.open = false; });
    await detail.locator('summary').focus(); await page.keyboard.press('Enter');
    assert.notEqual(await detail.getAttribute('open'), null, 'Штатное раскрытие с клавиатуры не сработало');
    await page.goto(`${base}/study-slides.html?print-pdf`, {waitUntil: 'networkidle'});
    await page.waitForSelector('.pdf-page', {timeout: 15000});
    assert.equal(await page.locator('details:not([open])').count(), 0, 'При печати PDF ответ остался свёрнутым');
    await page.emulateMedia({media: 'print'});
    for (const marker of ['SOLUTION_MARKER', 'NATIVE_COLLAPSE_MARKER', 'SECOND_TAB_MARKER']) {
      assert.equal(await page.getByText(marker, {exact: false}).first().isVisible(), true, `В PDF скрыт ${marker}`);
    }
    const pdf = path.join(temporary, 'slides.pdf'); await page.pdf({path: pdf, printBackground: true});
    const extracted = spawnSync('pdftotext', [pdf, '-'], {encoding: 'utf8'});
    assert.equal(extracted.status, 0, extracted.stderr);
    for (const marker of ['SOLUTION_MARKER', 'NATIVE_COLLAPSE_MARKER', 'SECOND_TAB_MARKER', 'LONG_ANSWER_END_MARKER']) assert.ok(extracted.stdout.includes(marker), `В итоговом PDF отсутствует ${marker}`);
    await page.emulateMedia({media: 'screen'});
    await page.goto(`${base}/study.html`, {waitUntil: 'networkidle'});
    await page.evaluate(() => { const details = document.createElement('details'); details.innerHTML = '<summary>Другой сворачиваемый блок</summary><p>Содержимое штатного блока</p>'; document.body.append(details); window.dispatchEvent(new Event('beforeprint')); });
    assert.equal(await page.locator('details:not([open])').count(), 0);
    assert.equal(await page.locator('.callout .collapse:not(.show)').count(), 0);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    assert.equal(await page.locator('details:not([open])').count(), 1, 'После печати состояние свёрнутого блока не восстановлено');
    assert.equal(await page.locator('#sol-predict').isVisible(), false);
    assert.deepEqual(errors, [], 'Ошибки выполнения в браузере');
    console.log('Представление в браузере: раскрытие фрагментов вперёд, клавиатура, локальные ссылки, все вкладки и ответы в PDF, восстановление после печати — успешно.');
  } finally {
    await browser?.close(); await new Promise((resolve) => server ? server.close(resolve) : resolve());
    if (process.env.COURSE_PRESENTATION_KEEP) console.log('Сохранён проверочный проект:', temporary);
    else fs.rmSync(temporary, {recursive: true, force: true});
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
