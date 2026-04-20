import { describe, it, expect } from 'vitest';
import { 
  parsePhoneFromContact, 
  toE164, 
  SUPPORTED_COUNTRY_CODES, 
  INDIA_CC, 
  US_CA_CC 
} from './phone';

describe('phone international utils', () => {
  describe('parsePhoneFromContact', () => {
    it('should parse Indian number with +91', () => {
      expect(parsePhoneFromContact('+91 98765 43210')).toEqual({
        countryCode: INDIA_CC,
        nationalDigits: '9876543210'
      });
    });

    it('should parse Indian number with 91 digits only', () => {
      expect(parsePhoneFromContact('919876543210')).toEqual({
        countryCode: INDIA_CC,
        nationalDigits: '9876543210'
      });
    });

    it('should parse US number with +1', () => {
      expect(parsePhoneFromContact('+1 (310) 555-0199')).toEqual({
        countryCode: US_CA_CC,
        nationalDigits: '3105550199'
      });
    });

    it('should parse US number with 1 digit only', () => {
      expect(parsePhoneFromContact('13105550199')).toEqual({
        countryCode: US_CA_CC,
        nationalDigits: '3105550199'
      });
    });

    it('should default to India for 10 digits without prefix', () => {
      expect(parsePhoneFromContact('9876543210')).toEqual({
        countryCode: INDIA_CC,
        nationalDigits: '9876543210'
      });
    });

    it('should handle messy local numbers by defaulting to India', () => {
      expect(parsePhoneFromContact('0-98765-43210')).toEqual({
        countryCode: INDIA_CC,
        nationalDigits: '9876543210'
      });
    });
  });

  describe('toE164', () => {
    it('should combine CC and digits', () => {
      expect(toE164(INDIA_CC, '9876543210')).toBe('+919876543210');
      expect(toE164(US_CA_CC, '3105550199')).toBe('+13105550199');
    });

    it('should throw Error for empty digits', () => {
      expect(() => toE164(INDIA_CC, '')).toThrow('Phone number is required');
    });
  });

  describe('constants', () => {
    it('should have supported codes', () => {
      expect(SUPPORTED_COUNTRY_CODES).toContain(INDIA_CC);
      expect(SUPPORTED_COUNTRY_CODES).toContain(US_CA_CC);
    });
  });
});
