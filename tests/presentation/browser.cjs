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
function render(format, output, extra = [], input = 'fixture.qmd') {
  const result = spawnSync(quarto, ['render', input, '--to', format, '--output', output, '--fail-if-warnings', ...extra], {cwd: temporary, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
(async () => {
  let browser, server;
  try {
    fs.mkdirSync(path.join(temporary, '_extensions'));
    fs.cpSync(path.join(repo, '_extensions/course-presentation'), path.join(temporary, '_extensions/course-presentation'), {recursive: true});
    fs.copyFileSync(path.join(__dirname, 'fixture.qmd'), path.join(temporary, 'fixture.qmd'));
    fs.copyFileSync(path.join(__dirname, 'course-plan.qmd'), path.join(temporary, 'course-plan.qmd'));
    fs.appendFileSync(path.join(temporary, 'fixture.qmd'), '\n## Длинный ответ\n\n::: {#exr-long}\nУпражнение с развёрнутым решением.\n:::\n\n::: {#sol-long for="exr-long"}\n' + Array.from({length: 32}, (_, index) => `Абзац ${index + 1}: подробное объяснение в развёрнутом решении для проверки переноса страниц.\n\n`).join('') + 'LONG_ANSWER_END_MARKER\n:::\n');
    render('html', 'study.html');
    render('revealjs', 'lecture.html');
    render('revealjs', 'study-slides.html');
    render('html', 'course-plan.html', [], 'course-plan.qmd');
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
    const errors = [];
    const planPage = await browser.newPage({viewport: {width: 390, height: 844}});
    planPage.on('pageerror', (error) => errors.push(error.message));
    await planPage.goto(`${base}/course-plan.html`, {waitUntil: 'networkidle'});
    const region = planPage.getByRole('region', {name: 'План вводных занятий'});
    assert.equal(await region.getAttribute('tabindex'), '0');
    for (const id of ['plan-overview', 'plan-first', 'plan-last', 'ordinary-plan', 'plan-destination']) {
      assert.equal(await planPage.locator(`[id="${id}"]`).count(), 1, `Повторный или потерянный идентификатор ${id}`);
    }
    assert.equal(await region.locator('table').count(), 1, 'План перестал быть обычной Markdown-таблицей');
    assert.equal(await region.locator('a[href="#plan-destination"]').count(), 2, 'Ссылки таблицы потеряны');
    const narrow = await region.evaluate((element) => ({
      width: element.clientWidth, content: element.scrollWidth,
      documentWidth: document.documentElement.scrollWidth, viewport: innerWidth,
    }));
    assert.ok(narrow.content > narrow.width, 'Широкая таблица не проверяет прокрутку на узком экране');
    assert.ok(narrow.documentWidth <= narrow.viewport + 1, 'Широкая таблица создаёт горизонтальную прокрутку документа');
    await region.focus();
    await planPage.keyboard.press('ArrowRight');
    await planPage.waitForFunction(() => document.getElementById('plan-overview').scrollLeft > 0);
    await planPage.keyboard.press('Tab');
    assert.equal(await planPage.evaluate(() => document.activeElement.id), 'plan-first', 'Первая ссылка таблицы недоступна с клавиатуры');
    await planPage.keyboard.press('Tab');
    assert.equal(await planPage.evaluate(() => document.activeElement.id), 'plan-last', 'Последняя ссылка таблицы недоступна с клавиатуры');
    await planPage.keyboard.press('Enter');
    await planPage.waitForFunction(() => location.hash === '#plan-destination');
    assert.equal(await planPage.locator('#plan-destination').isVisible(), true, 'Ссылка таблицы не открыла цель');
    // Изолируем контрольную таблицу от изменения ширины соседнего плана:
    // снятие оформления не должно превращать этот контроль в тест переполнения.
    await region.evaluate((element) => { element.hidden = true; });
    const ordinary = planPage.locator('#ordinary-plan table');
    const ordinaryLayout = (table) => ({
      width: table.getBoundingClientRect().width, height: table.getBoundingClientRect().height,
      tableStyle: ['minWidth', 'tableLayout', 'borderCollapse'].map((key) => getComputedStyle(table)[key]),
      cellStyles: Array.from(table.querySelectorAll('th, td'), (cell) =>
        ['padding', 'fontWeight', 'backgroundColor', 'border'].map((key) => getComputedStyle(cell)[key])),
    });
    const styledOrdinary = await ordinary.evaluate(ordinaryLayout);
    await planPage.locator('link[data-course-runtime-asset="presentation.css"]').evaluate((link) => { link.disabled = true; });
    assert.deepEqual(await ordinary.evaluate(ordinaryLayout), styledOrdinary, 'Оформление плана изменяет обычную таблицу без класса');
    await planPage.locator('link[data-course-runtime-asset="presentation.css"]').evaluate((link) => { link.disabled = false; });
    await planPage.locator('#plan-overview').evaluate((element) => { element.hidden = false; });
    await planPage.setViewportSize({width: 800, height: 1100});
    await planPage.emulateMedia({media: 'print'});
    const printed = await region.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const table = element.querySelector('table');
      return {
        width: element.clientWidth, content: element.scrollWidth, overflow: getComputedStyle(element).overflowX,
        tableWidth: table.getBoundingClientRect().width,
        cellsFit: Array.from(table.querySelectorAll('th, td')).every((cell) => {
          const cellBox = cell.getBoundingClientRect();
          return cellBox.left >= box.left - 1 && cellBox.right <= box.right + 1;
        }),
      };
    });
    assert.ok(printed.content <= printed.width + 1 && printed.tableWidth <= printed.width + 1 && printed.cellsFit, 'При печати ширина таблицы обрезает колонки');
    assert.equal(printed.overflow, 'visible', 'При печати область таблицы сохраняет обрезание или прокрутку');
    const planPdf = path.join(temporary, 'course-plan.pdf');
    await planPage.pdf({path: planPdf, format: 'A4', printBackground: true});
    const planText = spawnSync('pdftotext', [planPdf, '-'], {encoding: 'utf8'});
    assert.equal(planText.status, 0, planText.stderr);
    for (const marker of ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA', 'OMEGA']) {
      assert.ok(planText.stdout.includes(marker), `В PDF таблицы потеряна колонка ${marker}`);
    }
    await planPage.close();
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    page.on('pageerror', (error) => errors.push(error.message));
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
    assert.equal(await page.locator('#sol-predict').evaluate(node => node.closest('details').open), false);
    await page.locator('#sol-predict').evaluate(node => { node.closest('details').open = true; });
    await page.getByRole('button', {name: 'Режим аудитории', exact: true}).click();
    assert.equal(await page.locator('#sol-predict').evaluate(node => node.closest('details').open), true, 'Switching mode closed the answer');
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
    console.log('Представление в браузере: прокрутка и печать обычной таблицы плана, клавиатура, локальные ссылки, состояние ответа при переключении режима, все вкладки и ответы в PDF, восстановление после печати — успешно.');
  } finally {
    await browser?.close(); await new Promise((resolve) => server ? server.close(resolve) : resolve());
    if (process.env.COURSE_PRESENTATION_KEEP) console.log('Сохранён проверочный проект:', temporary);
    else fs.rmSync(temporary, {recursive: true, force: true});
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
