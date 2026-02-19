import { describe, expect, it } from 'vitest';

describe('web smoke', () => {
  it('works', () => {
    expect('hub').toContain('hu');
  });
});
