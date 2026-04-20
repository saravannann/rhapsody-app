import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { phone, ticketContent, templateData } = await request.json();

    if (!phone || (!ticketContent && !templateData)) {
      return NextResponse.json({ error: 'Phone and ticketContent/templateData are required' }, { status: 400 });
    }

    const WHATSAPP_PHONE_ID = process.env.NEXT_WHATSAPP_PHONE_ID;
    const WHATSAPP_ACCESS_TOKEN = process.env.NEXT_WHATSAPP_ACCESS_TOKEN;
    const WHATSAPP_VERSION = process.env.NEXT_WHATSAPP_VERSION || 'v20.0';

    if (!WHATSAPP_PHONE_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.error('Missing WhatsApp Credentials');
      return NextResponse.json({ error: 'WhatsApp credentials not configured' }, { status: 500 });
    }

    // WhatsApp Cloud API endpoint
    const url = `https://graph.facebook.com/${WHATSAPP_VERSION}/${WHATSAPP_PHONE_ID}/messages`;
    console.log('WA Requesting:', url, 'to phone:', phone);

    const recipient = phone.toString().trim().replace(/\D/g, '');
    console.log('WA Final Recipient:', recipient, ' (Digits only)');

    let body;
    if (templateData) {
      body = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: templateData.templateName,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: templateData.parameters
            }
          ]
        }
      };
    } else {
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
          preview_url: true,
          body: ticketContent
        }
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API response error:', JSON.stringify(data, null, 2));
      
      let errorMessage = data.error?.message || 'Failed to send WhatsApp message';
      
      // Handle Sandbox "Allowed List" error specifically
      if (data.error?.code === 131030) {
        errorMessage = `Meta Sandbox Restriction: Recipient phone number (${recipient}) is not in your Meta Dashboard "Allowed Numbers" list. Please add it in the Meta Developer Portal to test.`;
      }

      return NextResponse.json({ 
        success: false,
        error: errorMessage,
        details: data.error,
        meta_status: response.status,
        code: data.error?.code,
        subcode: data.error?.error_subcode
      }, { status: 200 }); 
    }

    console.log('WA Meta Success Response:', JSON.stringify(data, null, 2));
    
    // Sometimes Meta returns success but the message is not delivered 
    // (e.g. unverified number in sandbox). The message_id presence is a good sign.
    const messageId = data.messages?.[0]?.id;
    
    return NextResponse.json({ 
      success: true, 
      message_id: messageId,
      recipient: recipient,
      wa_id: data.contacts?.[0]?.wa_id
    });

  } catch (error) {
    console.error('WhatsApp API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
