import { describe, it, expect } from 'vitest';

describe('Test infrastructure', () => {
  it('basic assertion works', () => {
    expect(1 + 1).toBe(2);
  });

  it('DOM environment is available', () => {
    const div = document.createElement('div');
    div.textContent = 'Hello';
    document.body.appendChild(div);

    expect(div.textContent).toBe('Hello');
    expect(document.body.contains(div)).toBe(true);

    document.body.removeChild(div);
  });
});
