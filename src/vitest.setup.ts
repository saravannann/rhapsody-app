import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';
import { vi } from 'vitest';

// Mock Supabase with a robust Thenable chain
const createSupabaseMock = () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    or: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => Promise.resolve(resolve({ data: [], error: null }))),
  };
  return chain;
};

vi.mock('@/utils/supabase', () => ({
  supabase: {
    from: vi.fn(() => createSupabaseMock()),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock html5-qrcode
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn().mockResolvedValue(undefined);
    clear = vi.fn();
    isScanning = false;
  },
  Html5QrcodeSupportedFormats: {},
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.alert
window.alert = vi.fn();
