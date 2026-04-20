import { describe, it, expect } from 'vitest';
import { nationalDigitsForIndia, toE164, hasNationalDigits, INDIA_CC } from './phone';

describe('phone utils', () => {
  describe('nationalDigitsForIndia', () => {
    it('should strip non-digits', () => {
      expect(nationalDigitsForIndia('987-654-3210')).toBe('9876543210');
    });

    it('should strip leading 0', () => {
      expect(nationalDigitsForIndia('09876543210')).toBe('9876543210');
    });

    it('should strip leading 91', () => {
      expect(nationalDigitsForIndia('919876543210')).toBe('9876543210');
    });

    it('should handle full international format +91', () => {
      expect(nationalDigitsForIndia('+91 98765 43210')).toBe('9876543210');
    });

    it('should limit to 10 digits', () => {
      expect(nationalDigitsForIndia('9876543210999')).toBe('9876543210');
    });
  });

  describe('toE164', () => {
    it('should prepend +91 for India', () => {
      expect(toE164(INDIA_CC, '9876543210')).toBe('+919876543210');
    });

    it('should throw Error if input results in empty digits', () => {
      expect(() => toE164(INDIA_CC, '')).toThrow('Phone number is required');
      expect(() => toE164(INDIA_CC, 'abc')).toThrow('Phone number is required');
    });
  });

  describe('hasNationalDigits', () => {
    it('should return true for valid digits', () => {
      expect(hasNationalDigits('9876543210')).toBe(true);
    });

    it('should return true even for partial digits', () => {
      expect(hasNationalDigits('987')).toBe(true);
    });

    it('should return false for no digits', () => {
      expect(hasNationalDigits('abc')).toBe(false);
      expect(hasNationalDigits('')).toBe(false);
    });
  });
});
