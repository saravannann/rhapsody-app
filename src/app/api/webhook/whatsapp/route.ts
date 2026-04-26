import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

// GET: Webhook Verification
// Meta sends a GET request to verify the endpoint
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.NEXT_WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook Verified!');
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

// POST: Webhook Events
// Meta sends status updates and messages here
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('WA Webhook Received:', JSON.stringify(body, null, 2));

    // 1. Validate it's a WhatsApp webhook
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ error: 'Not a WhatsApp webhook' }, { status: 404 });
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // 2. Handle Status Updates (sent, delivered, read, failed)
    if (value?.statuses && value.statuses.length > 0) {
      for (const statusUpdate of value.statuses) {
        const messageId = statusUpdate.id;
        const status = statusUpdate.status; // 'sent', 'delivered', 'read', 'failed'
        const timestamp = statusUpdate.timestamp;
        const recipientId = statusUpdate.recipient_id;

        console.log(`WA Status Update: ${messageId} -> ${status} for ${recipientId}`);

        // Update ticket in Supabase
        const { error } = await supabase
          .from('tickets')
          .update({ 
            whatsapp_status: status,
            last_whatsapp_at: new Date(parseInt(timestamp) * 1000).toISOString()
          })
          .eq('wa_message_id', messageId);

        if (error) {
          console.error(`Failed to update ticket for wamid ${messageId}:`, error);
        }
      }
    }

    // 3. Acknowledge the webhook (must be 200)
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
