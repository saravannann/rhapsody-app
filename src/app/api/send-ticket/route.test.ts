import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextResponse } from 'next/server';

// Mock global fetch
global.fetch = vi.fn();

describe('POST /api/send-ticket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_WHATSAPP_PHONE_ID = '12345';
    process.env.NEXT_WHATSAPP_ACCESS_TOKEN = 'token123';
  });

  it('should return 400 if phone or ticketContent is missing', async () => {
    const req = new Request('http://localhost/api/send-ticket', {
      method: 'POST',
      body: JSON.stringify({ phone: '9876543210' }), // missing ticketContent
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/required/i);
  });

  it('should return 500 if credentials are missing', async () => {
    delete process.env.NEXT_WHATSAPP_PHONE_ID;
    
    const req = new Request('http://localhost/api/send-ticket', {
      method: 'POST',
      body: JSON.stringify({ phone: '9876543210', ticketContent: 'Hi' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toMatch(/credentials/i);
  });

  it('should return 200 with success: true when Meta API succeeds', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        messages: [{ id: 'wa_id_123' }],
        contacts: [{ wa_id: '919876543210' }]
      }),
    });

    const req = new Request('http://localhost/api/send-ticket', {
      method: 'POST',
      body: JSON.stringify({ phone: '9876543210', ticketContent: 'Your ticket is here' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message_id).toBe('wa_id_123');
  });

  it('should handle Meta API errors (e.g. sandbox restriction)', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({
        error: {
          message: 'Recipient is not in allowed list',
          code: 131030
        }
      }),
    });

    const req = new Request('http://localhost/api/send-ticket', {
      method: 'POST',
      body: JSON.stringify({ phone: '9876543210', ticketContent: 'Hi' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(false);
    expect(data.error).toMatch(/Meta Sandbox Restriction/i);
  });
});
