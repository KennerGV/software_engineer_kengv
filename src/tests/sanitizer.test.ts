import { describe, it, expect } from 'vitest';
import { sanitizeInput } from '../utils/sanitizer';

describe('sanitizeInput', () => {
  it('should return empty string if input is empty', () => {
    expect(sanitizeInput('')).toBe('');
  });

  it('should escape HTML characters correctly', () => {
    const input = '<script>alert("Hello & welcome to \'my\' site!");</script>';
    const expected = '&lt;script&gt;alert(&quot;Hello &amp; welcome to &#039;my&#039; site!&quot;);&lt;/script&gt;';
    expect(sanitizeInput(input)).toBe(expected);
  });

  it('should return the same string if no HTML characters are present', () => {
    expect(sanitizeInput('Hello World')).toBe('Hello World');
  });
});
