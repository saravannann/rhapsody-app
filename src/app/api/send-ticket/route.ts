import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { phone, ticketContent } = await request.json();

    if (!phone || !ticketContent) {
      return NextResponse.json({ error: 'Phone and ticketContent are required' }, { status: 400 });
    }

    console.log('WA Content Length:', ticketContent.length);
    console.log('WA Content Snippet:', ticketContent.substring(0, 50) + '...');

    const WHATSAPP_PHONE_ID = process.env.NEXT_WHATSAPP_PHONE_ID;
    const WHATSAPP_ACCESS_TOKEN = process.env.NEXT_WHATSAPP_ACCESS_TOKEN;
    const WHATSAPP_VERSION = process.env.NEXT_WHATSAPP_VERSION || 'v20.0';

    console.log('WA Env Check:', { 
      hasId: !!WHATSAPP_PHONE_ID, 
      hasToken: !!WHATSAPP_ACCESS_TOKEN, 
      version: WHATSAPP_VERSION 
    });

    if (!WHATSAPP_PHONE_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.error('Missing WhatsApp Credentials');
      return NextResponse.json({ error: 'WhatsApp credentials not configured' }, { status: 500 });
    }

    // WhatsApp Cloud API endpoint
    const url = `https://graph.facebook.com/${WHATSAPP_VERSION}/${WHATSAPP_PHONE_ID}/messages`;
    console.log('WA Requesting:', url, 'to phone:', phone);

    const recipient = phone.toString().replace(/\D/g, '');
    console.log('WA Final Recipient:', recipient);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
          preview_url: true,
          body: ticketContent
        }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API response error:', data);
      return NextResponse.json({ 
        success: false,
        error: data.error?.message || 'Failed to send WhatsApp message',
        details: data.error,
        meta_status: response.status
      }, { status: 200 }); // Return 200 so the frontend can read the error payload easily
    }

    console.log('WA Meta Success Response:', data);
    return NextResponse.json({ success: true, message_id: data.messages?.[0]?.id });

  } catch (error) {
    console.error('WhatsApp API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
