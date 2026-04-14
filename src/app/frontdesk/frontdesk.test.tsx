import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FrontdeskCheckInPage from './page';
import { supabase } from '@/utils/supabase';

const mockTicket = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  purchaser_name: 'John Doe',
  type: 'Platinum',
  quantity: 5,
  checked_in_count: 2,
  price: 500,
  sequence_number: 42,
};

describe('FrontdeskCheckInPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and switches tabs', () => {
    render(<FrontdeskCheckInPage />);
    expect(screen.getByText(/Scanner/i)).toBeInTheDocument();
    
    fireEvent.click(screen.getByText(/Research/i));
    expect(screen.getByPlaceholderText(/Search by ID, Name, or Mobile/i)).toBeInTheDocument();
  });

  it('performs ticket lookup and shows modal', async () => {
    // Override only the lookup call
    (supabase.from as any).mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: mockTicket, error: null })),
      then: vi.fn((resolve) => Promise.resolve(resolve({ data: [], error: null }))),
    }));

    render(<FrontdeskCheckInPage />);
    
    // Switch to Manual & Paste ID
    fireEvent.click(screen.getByText('Manual'));
    const input = screen.getByPlaceholderText(/Paste ticket QR text/i);
    fireEvent.change(input, { target: { value: mockTicket.id } });
    fireEvent.click(screen.getByText('Verify Ticket'));

    // Wait for the results modal to appear
    await waitFor(() => {
      expect(screen.getByText(/Verification Result/i)).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText(/2 \/ 5 Admitted/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('validates partial check-in quantity', async () => {
    (supabase.from as any).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: mockTicket, error: null })),
      then: vi.fn((resolve) => Promise.resolve(resolve({ data: [], error: null }))),
    }));

    render(<FrontdeskCheckInPage />);
    fireEvent.click(screen.getByText('Manual'));
    fireEvent.change(screen.getByPlaceholderText(/Paste ticket QR text/i), { target: { value: mockTicket.id } });
    fireEvent.click(screen.getByText('Verify Ticket'));

    await waitFor(() => {
      expect(screen.getByText('Confirm Admission')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Remaining: 3
    expect(screen.getByText('3')).toBeInTheDocument();

    // Decrease count
    fireEvent.click(screen.getByText('-'));
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
