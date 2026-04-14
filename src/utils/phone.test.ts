import { describe, it, expect } from 'vitest';
import { nationalDigitsForIndia, toIndianE164, hasIndianNationalDigits } from './phone';

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

  describe('toIndianE164', () => {
    it('should prepend +91', () => {
      expect(toIndianE164('9876543210')).toBe('+919876543210');
    });

    it('should throw Error if input results in empty digits', () => {
      expect(() => toIndianE164('')).toThrow('Phone number is required');
      expect(() => toIndianE164('abc')).toThrow('Phone number is required');
    });
  });

  describe('hasIndianNationalDigits', () => {
    it('should return true for valid 10 digits', () => {
      expect(hasIndianNationalDigits('9876543210')).toBe(true);
    });

    it('should return true even for partial digits', () => {
      expect(hasIndianNationalDigits('987')).toBe(true);
    });

    it('should return false for no digits', () => {
      expect(hasIndianNationalDigits('abc')).toBe(false);
      expect(hasIndianNationalDigits('')).toBe(false);
    });
  });
});
