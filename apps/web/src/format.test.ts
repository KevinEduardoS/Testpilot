import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration } from './format';

describe('formatDuration', () => {
  it.each([
    [0, '0 ms'],
    [999.4, '999 ms'],
    [1000, '1.0 s'],
    [6149, '6.1 s'],
  ])('%d ms se muestra como %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe('formatClock', () => {
  it('usa formato de 24 horas con segundos', () => {
    expect(formatClock(new Date(2026, 10, 7, 14, 3, 27).getTime())).toBe('14:03:27');
  });
});
