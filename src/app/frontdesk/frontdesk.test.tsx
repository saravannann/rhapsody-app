import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FrontdeskCheckInPage from './page';
import { supabase } from '@/utils/supabase';

// Helper to mock a successful ticket lookup
const mockTicket = {
  id: 'ticket-123',
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

  it('renders the scanner tab by default', () => {
    render(<FrontdeskCheckInPage />);
    expect(screen.getByText(/Scanner/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Paste ticket QR text/i)).toBeInTheDocument();
  });

  it('switches to research tab', async () => {
    render(<FrontdeskCheckInPage />);
    const researchTab = screen.getByText(/Research/i);
    fireEvent.click(researchTab);
    expect(screen.getByPlaceholderText(/Search by ID, Name, or Mobile/i)).toBeInTheDocument();
  });

  it('displays ticket details when a valid code is "scanned" (pasted)', async () => {
    // Robust chainable mock
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: mockTicket, error: null })),
      then: vi.fn().mockImplementation((onFulfilled) => {
        // Handle metric fetches or audit log fetches
        return Promise.resolve(onFulfilled({ data: [], error: null }));
      }),
    };

    (supabase.from as any).mockReturnValue(mockSupabaseChain);

    render(<FrontdeskCheckInPage />);
    
    // Switch to Manual mode first
    fireEvent.click(screen.getByText('Manual'));
    
    const input = screen.getByPlaceholderText(/Paste ticket QR text/i);
    fireEvent.change(input, { target: { value: 'ticket-123' } });
    
    // Click Verify button
    fireEvent.click(screen.getByText('Verify Ticket'));

    // Wait for the results modal to appear
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      // Check for partial check-in status text
      expect(screen.getByText(/2 \/ 5 Admitted/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('handles partial check-in validation', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: mockTicket, error: null })),
      then: vi.fn().mockImplementation((onFulfilled) => {
        return Promise.resolve(onFulfilled({ data: [], error: null }));
      }),
    };

    (supabase.from as any).mockReturnValue(mockSupabaseChain);

    render(<FrontdeskCheckInPage />);
    
    // Switch to Manual mode first
    fireEvent.click(screen.getByText('Manual'));
    
    // Paste code
    fireEvent.change(screen.getByPlaceholderText(/Paste ticket QR text/i), { 
      target: { value: 'ticket-123' } 
    });
    fireEvent.click(screen.getByText('Verify Ticket'));

    // Wait for modal to render
    await waitFor(() => {
      expect(screen.getByText('Confirm Admission')).toBeInTheDocument();
    }, { timeout: 4000 });

    await waitFor(() => screen.getByText('Confirm Admission'));

    // Default partial count should be 3 (5 total - 2 already in)
    expect(screen.getByText('3')).toBeInTheDocument();

    // Click plus button
    const plusBtn = screen.getByText('+');
    fireEvent.click(plusBtn);
    
    // Should NOT increase beyond capacity (3 remaining)
    expect(screen.getByText('3')).toBeInTheDocument();

    // Click minus button
    const minusBtn = screen.getByText('-');
    fireEvent.click(minusBtn);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
