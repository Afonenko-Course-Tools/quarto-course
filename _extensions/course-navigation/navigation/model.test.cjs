'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { groupEntries, VisitHistory, collect } = require('./model.js');

test('title slide, section boundaries, and nested slide coordinates are independent', () => {
  const result = groupEntries([
    { title: 'Course', isTitle: true, section: 'Start', h: 0, v: 0 },
    { title: 'First', h: 1, v: 0 },
    { title: 'Types', section: 'Types', sectionStart: true, h: 2, v: 0 },
    { title: 'Primitive', h: 2, v: 1 },
    { title: 'References', h: 2, v: 2 },
    { title: 'Memory', section: 'Memory', sectionStart: true, h: 3, v: 0 }
  ], 'Content');
  assert.deepEqual(result.groups.map(g => [g.title, g.start, g.slides.length]), [
    ['Start', 0, 1], ['Content', 1, 1], ['Types', 2, 3], ['Memory', 5, 1]
  ]);
  assert.equal(result.slides[4].v, 2);
  assert.equal(result.slides[4].group, 2);
  assert.deepEqual(groupEntries([], 'Content'), { slides: [], groups: [] });
});

test('history navigation does not erase forward visits; a fresh branch does', () => {
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

test('history remains bounded and empty history is safe', () => {
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
test('hidden slides and stack wrappers do not inflate slide progress', () => {
  const parent = slide('Hidden parent', { hidden: true });
  const a = slide('A'); const b = slide('B', { h: 1, v: 1 });
  const hidden = slide('Hidden', { hidden: true });
  const child = slide('Hidden nested', { parent });
  const stack = slide('Stack', { children: [a, b] });
  const deck = { getSlides: () => [stack, a, b, hidden, child], getIndices: node => ({ h: node.h, v: node.v }) };
  const result = collect(deck, { slide: 'Slide', start: 'Start', material: 'Content' });
  assert.equal(result.slides.length, 2);
  assert.deepEqual(result.slides.map(s => s.title), ['A', 'B']);
});
