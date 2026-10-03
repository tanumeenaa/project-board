export function createPosition(before = 0, after = 1000) {
  const min = Number.isFinite(before) ? before : 0;
  const max = Number.isFinite(after) ? after : min + 1000;
  if (max - min <= 1) {
    return (min + max) / 2;
  }
  return min + (max - min) / 2;
}

export function rebalancePositions(values) {
  const sorted = [...values]
    .filter((value) => Number.isFinite(value))
    .sort((first, second) => first - second);

  if (sorted.length === 0) {
    return [];
  }

  return sorted.map((_, index) => (index + 1) * 1000);
}

export function movePosition(positions, currentValue, targetValue) {
  const sorted = positions
    .filter(Number.isFinite)
    .sort((first, second) => first - second);

  if (Number.isFinite(targetValue)) {
    return targetValue;
  }

  return sorted.length ? sorted.at(-1) + 1000 : 1000;
}
