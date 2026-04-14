import { describe, it, expect } from 'vitest';
import { phoneToWhatsAppDigits, buildWhatsAppSendUrl, buildTicketWhatsAppMessage } from './whatsapp-ticket';

describe('whatsapp-ticket utils', () => {
  describe('phoneToWhatsAppDigits', () => {
    it('should strip non-digits', () => {
      expect(phoneToWhatsAppDigits('+91 98765-43210')).toBe('919876543210');
    });

    it('should handle empty input', () => {
      expect(phoneToWhatsAppDigits('')).toBe('');
    });
  });

  describe('buildWhatsAppSendUrl', () => {
    it('should format URL correctly', () => {
      const url = buildWhatsAppSendUrl('919876543210', 'Hello World');
      expect(url).toBe('https://wa.me/919876543210?text=Hello%20World');
    });

    it('should return # if phone is empty', () => {
      expect(buildWhatsAppSendUrl('', 'msg')).toBe('#');
    });
  });

  describe('buildTicketWhatsAppMessage', () => {
    const baseParams = {
      purchaserName: 'Jane Doe',
      passLabel: 'Platinum Pass',
      quantity: 2,
      totalInr: 2000,
      ref: 'R-0001-ABCD',
      ticketPageUrl: 'https://rhapsody.app/ticket/123'
    };

    it('should generate the correct message for Platinum Pass', () => {
      const msg = buildTicketWhatsAppMessage(baseParams);
      expect(msg).toContain('Dear Jane Doe');
      expect(msg).toContain('Platinum Pass × 2');
      expect(msg).toContain('Reference: R-0001-ABCD');
      expect(msg).toContain('₹2,000');
      expect(msg).toContain('Sir Mutha Venkata Subba Rao');
    });

    it('should generate a special message for Donor Pass', () => {
      const msg = buildTicketWhatsAppMessage({
        ...baseParams,
        passLabel: 'Donor Pass'
      });
      expect(msg).toContain('heartfelt gratitude');
      expect(msg).toContain('Each Donor Pass will be offered to Two Cancer Survivors');
    });

    it('should handle missing name by defaulting to Guest', () => {
      const msg = buildTicketWhatsAppMessage({
        ...baseParams,
        purchaserName: ''
      });
      expect(msg).toContain('Dear Guest');
    });

    it('should use a default template for unknown pass labels', () => {
      const msg = buildTicketWhatsAppMessage({
        ...baseParams,
        passLabel: 'Standard'
      });
      expect(msg).toContain('Hello Jane Doe');
      expect(msg).toContain('Your Rhapsody ticket is confirmed');
    });
  });
});
