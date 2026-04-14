import { describe, it, expect } from 'vitest';
import { ticketQuantity, ticketUnitPrice, ticketLineTotal } from './ticket-counts';

describe('ticket-counts utils', () => {
  describe('ticketQuantity', () => {
    it('should return the floor of a valid quantity', () => {
      expect(ticketQuantity({ quantity: 5.8 })).toBe(5);
    });

    it('should default to 1 for missing or invalid quantity', () => {
      expect(ticketQuantity({})).toBe(1);
      expect(ticketQuantity({ quantity: null })).toBe(1);
      expect(ticketQuantity({ quantity: 0 })).toBe(1);
      expect(ticketQuantity({ quantity: -5 })).toBe(1);
      expect(ticketQuantity({ quantity: '10' })).toBe(1);
    });
  });

  describe('ticketUnitPrice', () => {
    it('should return number for valid price', () => {
      expect(ticketUnitPrice({ price: 500 })).toBe(500);
      expect(ticketUnitPrice({ price: '1000' })).toBe(1000);
    });

    it('should return 0 for invalid price', () => {
      expect(ticketUnitPrice({})).toBe(0);
      expect(ticketUnitPrice({ price: 'abc' })).toBe(0);
    });
  });

  describe('ticketLineTotal', () => {
    it('should calculate total correctly (price * quantity)', () => {
      const ticket = { price: 500, quantity: 3 };
      expect(ticketLineTotal(ticket)).toBe(1500);
    });

    it('should handle missing quantity (defaulting to 1)', () => {
      const ticket = { price: 1000 };
      expect(ticketLineTotal(ticket)).toBe(1000);
    });

    it('should handle zero price', () => {
      const ticket = { price: 0, quantity: 10 };
      expect(ticketLineTotal(ticket)).toBe(0);
    });
  });
});
