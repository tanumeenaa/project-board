import test from 'node:test';
import assert from 'node:assert/strict';

import { createPosition, rebalancePositions, movePosition } from '../src/utils/position.js';

test('createPosition returns a floating value between neighbors', () => {
  const value = createPosition(0, 100);
  assert.ok(value > 0 && value < 100);
  assert.ok(Number.isFinite(value));
});

test('rebalancePositions keeps values sorted and non-overlapping', () => {
  const positions = [-1, 2, 5, 9, 12];
  const rebalance = rebalancePositions(positions);
  assert.equal(rebalance.length, positions.length);
  assert.ok(rebalance.every((value, index, list) => index === 0 || list[index - 1] < value));
  assert.ok(rebalance[0] >= 0);
});

test('movePosition can shift a value to the end when no room exists', () => {
  const value = movePosition([0, 10, 20], 10, 30);
  assert.ok(value > 20);
});

test('movePosition assigns a finite position in an empty destination list', () => {
  const value = movePosition([], 1000, undefined);
  assert.equal(value, 1000);
  assert.ok(Number.isFinite(value));
});

test('movePosition honors the requested top, middle, and bottom insertion positions', () => {
  assert.equal(movePosition([1000, 2000], 1000, 500), 500);
  assert.equal(movePosition([1000, 2000], 1000, 1500), 1500);
  assert.equal(movePosition([1000, 2000], 1000, 3000), 3000);
});
