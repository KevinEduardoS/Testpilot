import { describe, expect, it } from 'vitest';
import { hashForView, viewFromHash } from './views';

describe('viewFromHash', () => {
  it.each([
    ['#/runs', 'runs'],
    ['#architecture', 'architecture'],
    ['', 'playground'],
    ['#/inexistente', 'playground'],
  ])('%j abre la vista %s', (hash, view) => {
    expect(viewFromHash(hash)).toBe(view);
  });

  it('es inversa de hashForView', () => {
    expect(viewFromHash(hashForView('runs'))).toBe('runs');
  });
});
