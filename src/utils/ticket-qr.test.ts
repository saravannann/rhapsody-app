import { describe, it, expect } from 'vitest';
import { buildTicketQrPayload, shortTicketRef, parseTicketQrPayload } from './ticket-qr';

describe('ticket-qr utils', () => {
  describe('buildTicketQrPayload', () => {
    it('should format payload correctly', () => {
      const payload = buildTicketQrPayload({
        ticketId: 'uuid123',
        quantity: 5,
        typeId: 'Platinum'
      });
      expect(payload).toBe('rhapsody|1|uuid123|5|Platinum');
    });

    it('should handle decimal quantities by rounding down', () => {
      const payload = buildTicketQrPayload({
        ticketId: 'uuid123',
        quantity: 5.8,
        typeId: 'Platinum'
      });
      expect(payload).toBe('rhapsody|1|uuid123|5|Platinum');
    });

    it('should ensure minimum quantity of 1', () => {
      const payload = buildTicketQrPayload({
        ticketId: 'uuid123',
        quantity: 0,
        typeId: 'Platinum'
      });
      expect(payload).toBe('rhapsody|1|uuid123|1|Platinum');
    });
  });

  describe('shortTicketRef', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    // Base of this UUID (first 8 chars without dashes) is "550E8400"
    
    it('should return R-XXXX-BASE if sequence is missing', () => {
      expect(shortTicketRef(uuid)).toBe('R-XXXX-550E8400');
      expect(shortTicketRef(uuid, null)).toBe('R-XXXX-550E8400');
    });

    it('should format sequence as 4 digit padded number', () => {
      expect(shortTicketRef(uuid, 42)).toBe('R-0042-550E8400');
      expect(shortTicketRef(uuid, '7')).toBe('R-0007-550E8400');
    });

    it('should handle large sequences', () => {
      expect(shortTicketRef(uuid, 12345)).toBe('R-12345-550E8400');
    });
  });

  describe('parseTicketQrPayload', () => {
    it('should return null for invalid prefix', () => {
      expect(parseTicketQrPayload('invalid|1|id|1|type')).toBeNull();
    });

    it('should return null for short payload', () => {
      expect(parseTicketQrPayload('rhapsody|1|id|1')).toBeNull();
    });

    it('should correctly parse a valid payload', () => {
      const raw = 'rhapsody|1|uuid456|10|Donor';
      const parsed = parseTicketQrPayload(raw);
      expect(parsed).toEqual({
        version: '1',
        ticketId: 'uuid456',
        quantity: 10,
        typeId: 'Donor'
      });
    });

    it('should return null if quantity is not a number', () => {
      expect(parseTicketQrPayload('rhapsody|1|uuid456|abc|Donor')).toBeNull();
    });
  });
});
