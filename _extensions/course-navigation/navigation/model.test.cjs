'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { groupEntries, VisitHistory, collect } = require('./model.js');

test('титульный слайд, границы разделов и координаты вложенных слайдов независимы', () => {
  const result = groupEntries([
    { title: 'Курс', isTitle: true, section: 'Начало', h: 0, v: 0 },
    { title: 'Первый', h: 1, v: 0 },
    { title: 'Типы', section: 'Типы', sectionStart: true, h: 2, v: 0 },
    { title: 'Примитивные', h: 2, v: 1 },
    { title: 'Ссылки', h: 2, v: 2 },
    { title: 'Память', section: 'Память', sectionStart: true, h: 3, v: 0 }
  ], 'Материал');
  assert.deepEqual(result.groups.map(g => [g.title, g.start, g.slides.length]), [
    ['Начало', 0, 1], ['Материал', 1, 1], ['Типы', 2, 3], ['Память', 5, 1]
  ]);
  assert.equal(result.slides[4].v, 2);
  assert.equal(result.slides[4].group, 2);
  assert.deepEqual(groupEntries([], 'Материал'), { slides: [], groups: [] });
});

test('переход по истории сохраняет дальнейшие посещения, новый переход заменяет их', () => {
  const history = new VisitHistory();
  [0, 1, 5, 5, 7].forEach(index => history.record(index));
  assert.deepEqual(history.entries, [0, 1, 5, 7]);
  assert.equal(history.move(-1), 5);
  history.record(5);
  assert.equal(history.canMove(1), true);
  assert.equal(history.move(1), 7);
  assert.equal(history.move(1), null);
  history.move(-1); history.record(3);
  assert.deepEqual(history.entries, [0, 1, 5, 3]);
  assert.equal(history.canMove(1), false);
});

test('история ограничена по размеру и допускает пустое состояние', () => {
  const history = new VisitHistory(3);
  assert.equal(history.move(-1), null);
  [0, 1, 2, 3, 4].forEach(index => history.record(index));
  assert.deepEqual(history.entries, [2, 3, 4]);
  assert.equal(history.move(-1), 3);
});

function slide(title, { hidden = false, parent = null, children = [], h = 0, v = 0 } = {}) {
  return { tagName: 'SECTION', children, parentElement: parent, id: '',
    classList: { contains: () => false }, getAttribute: key => key === 'data-visibility' && hidden ? 'hidden' : null,
    querySelector: () => ({ tagName: 'H2', textContent: title, getAttribute: () => null }),
    cloneNode: () => ({ textContent: title, querySelectorAll: () => [] }), h, v };
}
test('скрытые слайды и контейнеры групп не увеличивают число слайдов', () => {
  const parent = slide('Скрытый родитель', { hidden: true });
  const a = slide('A'); const b = slide('B', { h: 1, v: 1 });
  const hidden = slide('Скрытый', { hidden: true });
  const child = slide('Скрытый вложенный', { parent });
  const stack = slide('Группа', { children: [a, b] });
  const deck = { getSlides: () => [stack, a, b, hidden, child], getIndices: node => ({ h: node.h, v: node.v }) };
  const result = collect(deck, { slide: 'Слайд', start: 'Начало', material: 'Материал' });
  assert.equal(result.slides.length, 2);
  assert.deepEqual(result.slides.map(s => s.title), ['A', 'B']);
});
