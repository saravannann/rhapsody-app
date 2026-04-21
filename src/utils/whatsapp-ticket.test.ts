import { describe, it, expect } from 'vitest';
import { phoneToWhatsAppDigits, buildWhatsAppSendUrl, buildTicketWhatsAppMessage, buildTicketTemplateData } from './whatsapp-ticket';

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

  describe('buildTicketTemplateData', () => {
    const baseParams = {
      purchaserName: 'John Doe',
      passLabel: 'Platinum Pass',
      quantity: 1,
      totalInr: 500,
      ref: 'REF123',
      ticketId: 'TICK-456'
    };

    it('should return regular template for non-donor pass', () => {
      const data = buildTicketTemplateData(baseParams);
      expect(data.templateName).toBe('regular_ticket_v2');
      expect(data.parameters).toHaveLength(6);
    });

    it('should return donor template for donor pass and skip ticketId parameter', () => {
      const data = buildTicketTemplateData({
        ...baseParams,
        passLabel: 'Donor Pass'
      });
      expect(data.templateName).toBe('donor_ticket_v2');
      expect(data.parameters).toHaveLength(5);
      // Ensure ticketId is not in parameters
      expect(data.parameters.some(p => p.text === 'TICK-456')).toBe(false);
    });

    it('should respect environment variables if set', () => {
      const originalRegular = process.env.NEXT_PUBLIC_WHATSAPP_REGULAR_TEMPLATE;
      const originalDonor = process.env.NEXT_PUBLIC_WHATSAPP_DONOR_TEMPLATE;
      
      process.env.NEXT_PUBLIC_WHATSAPP_REGULAR_TEMPLATE = 'custom_regular';
      process.env.NEXT_PUBLIC_WHATSAPP_DONOR_TEMPLATE = 'custom_donor';
      
      const regularData = buildTicketTemplateData(baseParams);
      expect(regularData.templateName).toBe('custom_regular');
      
      const donorData = buildTicketTemplateData({ ...baseParams, passLabel: 'Donor Pass' });
      expect(donorData.templateName).toBe('custom_donor');
      
      // Cleanup
      process.env.NEXT_PUBLIC_WHATSAPP_REGULAR_TEMPLATE = originalRegular;
      process.env.NEXT_PUBLIC_WHATSAPP_DONOR_TEMPLATE = originalDonor;
    });
  });
});
