import { describe, it, expect } from 'vitest';
import { 
  resolvePassTargets, 
  soldCountsFromTickets, 
  buildTargetRowsFromProfile, 
  totalPassTarget,
  PASS_TARGET_DEFAULTS
} from './pass-targets';

describe('pass-targets utils', () => {
  describe('resolvePassTargets', () => {
    it('should return defaults for null/invalid input', () => {
      expect(resolvePassTargets(null)).toEqual(PASS_TARGET_DEFAULTS);
      expect(resolvePassTargets([])).toEqual(PASS_TARGET_DEFAULTS);
      expect(resolvePassTargets('invalid')).toEqual(PASS_TARGET_DEFAULTS);
    });

    it('should merge partial updates with defaults', () => {
      const saved = { "Platinum Pass": 100 };
      const resolved = resolvePassTargets(saved);
      expect(resolved["Platinum Pass"]).toBe(100);
      expect(resolved["Donor Pass"]).toBe(PASS_TARGET_DEFAULTS["Donor Pass"]);
    });

    it('should parse string numbers correctly', () => {
      const saved = { "Student Pass": "75" };
      const resolved = resolvePassTargets(saved);
      expect(resolved["Student Pass"]).toBe(75);
    });

    it('should ignore negative numbers and use defaults', () => {
      const saved = { "Platinum Pass": -10 };
      const resolved = resolvePassTargets(saved);
      expect(resolved["Platinum Pass"]).toBe(PASS_TARGET_DEFAULTS["Platinum Pass"]);
    });
  });

  describe('soldCountsFromTickets', () => {
    it('should aggregate counts by ticket type name', () => {
      const tickets = [
        { type: 'Platinum', quantity: 2 },
        { type: 'Platinum', quantity: 3 },
        { type: 'Donor', quantity: 1 },
        { type: 'Unknown', quantity: 10 }
      ];
      const counts = soldCountsFromTickets(tickets);
      expect(counts["Platinum Pass"]).toBe(5);
      expect(counts["Donor Pass"]).toBe(1);
      expect(counts["Student Pass"]).toBe(0);
    });

    it('should handle missing types', () => {
      const tickets = [{ type: null, quantity: 5 }];
      const counts = soldCountsFromTickets(tickets);
      expect(counts["Platinum Pass"]).toBe(0);
    });
  });

  describe('totalPassTarget', () => {
    it('should return the sum of all resolved targets', () => {
      const saved = { "Platinum Pass": 10, "Donor Pass": 10, "Student Pass": 10 };
      expect(totalPassTarget(saved)).toBe(30);
    });
  });

  describe('buildTargetRowsFromProfile', () => {
    it('should build formatted rows correctly', () => {
      const saved = { "Platinum Pass": 100 };
      const sold = { "Platinum Pass": 25, "Donor Pass": 5, "Student Pass": 0 };
      const rows = buildTargetRowsFromProfile(saved, sold);
      
      const platinum = rows.find(r => r.name === "Platinum Pass");
      expect(platinum?.sold).toBe(25);
      expect(platinum?.target).toBe(100);
      expect(platinum?.color).toBe('bg-[#ec4899]');
    });
  });
});
