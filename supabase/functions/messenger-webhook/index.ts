import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const pageAccessToken = Deno.env.get('FACEBOOK_PAGE_ACCESS_TOKEN')!;
const appSecret = Deno.env.get('FACEBOOK_APP_SECRET')!;
const verifyToken = Deno.env.get('FACEBOOK_VERIFY_TOKEN')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Verify webhook signature
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  const hmac = new TextEncoder().encode(appSecret);
  const data = new TextEncoder().encode(payload);
  
  const key = await crypto.subtle.importKey(
    "raw",
    hmac,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const sigHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `sha256=${sigHex}` === signature;
}

// Fetch user profile from Facebook
async function getUserProfile(psid: string) {
  const url = `https://graph.facebook.com/v18.0/${psid}?fields=first_name,last_name,profile_pic&access_token=${pageAccessToken}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    console.error("Failed to fetch user profile:", await response.text());
    return null;
  }
  
  return await response.json();
}

// Send message via Facebook Send API
async function sendMessage(psid: string, text: string) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: psid },
      message: { text }
    })
  });
  
  if (!response.ok) {
    console.error("Failed to send message:", await response.text());
    return null;
  }
  
  return await response.json();
}

// Handle incoming messages
async function handleMessage(senderId: string, message: any) {
  console.log(`Handling message from ${senderId}:`, message);
  
  // Get or create customer
  let { data: customer, error: customerError } = await supabase
    .from('customer')
    .select('*')
    .eq('messenger_id', senderId)
    .maybeSingle();
  
  if (!customer) {
    // Fetch profile from Facebook
    const profile = await getUserProfile(senderId);
    
    // Create new customer
    const { data: newCustomer, error: insertError } = await supabase
      .from('customer')
      .insert({
        messenger_id: senderId,
        messenger_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
        messenger_profile_pic: profile?.profile_pic || null,
        first_message_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (insertError) {
      console.error("Error creating customer:", insertError);
      return;
    }
    
    customer = newCustomer;
  }
  
  // Determine message type and content
  let messageType = 'text';
  let messageText = null;
  let photoUrl = null;
  let photoFileId = null;
  let videoUrl = null;
  let videoFileId = null;
  let videoMimeType = null;
  let voiceUrl = null;
  let voiceFileId = null;
  let voiceDuration = null;
  
  if (message.text) {
    messageType = 'text';
    messageText = message.text;
  } else if (message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    
    if (attachment.type === 'image') {
      messageType = 'photo';
      photoUrl = attachment.payload.url;
      photoFileId = attachment.payload.sticker_id || 'fb_image';
    } else if (attachment.type === 'video') {
      messageType = 'video';
      videoUrl = attachment.payload.url;
      videoFileId = 'fb_video';
      videoMimeType = 'video/mp4';
    } else if (attachment.type === 'audio') {
      messageType = 'voice';
      voiceUrl = attachment.payload.url;
      voiceFileId = 'fb_audio';
    } else if (attachment.type === 'file') {
      messageType = 'text';
      messageText = `[File: ${attachment.payload.url}]`;
    }
  }
  
  // Save message to database
  const { error: messageError } = await supabase
    .from('messages')
    .insert({
      customer_id: customer.id,
      messenger_mid: message.mid,
      platform: 'messenger',
      message_type: messageType,
      message_text: messageText,
      photo_url: photoUrl,
      photo_file_id: photoFileId,
      video_url: videoUrl,
      video_file_id: videoFileId,
      video_mime_type: videoMimeType,
      voice_url: voiceUrl,
      voice_file_id: voiceFileId,
      voice_duration: voiceDuration,
      sender_type: 'customer',
      is_read: false,
      timestamp: new Date(message.timestamp).toISOString(),
    });
  
  if (messageError) {
    console.error("Error saving message:", messageError);
  }
}

// Handle referrals (ad attribution)
async function handleReferral(senderId: string, referral: any) {
  console.log(`Handling referral from ${senderId}:`, referral);
  
  // Get or create customer
  let { data: customer } = await supabase
    .from('customer')
    .select('*')
    .eq('messenger_id', senderId)
    .maybeSingle();
  
  if (!customer) {
    const profile = await getUserProfile(senderId);
    
    const { data: newCustomer } = await supabase
      .from('customer')
      .insert({
        messenger_id: senderId,
        messenger_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
        messenger_profile_pic: profile?.profile_pic || null,
        first_message_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    customer = newCustomer;
  }
  
  // Save lead attribution
  if (customer) {
    const { error: leadError } = await supabase
      .from('telegram_leads')
      .insert({
        user_id: customer.id,
        platform: 'messenger',
        messenger_ref: referral.ref || null,
        messenger_ad_context: referral.ads_context_data || null,
        referrer: referral.source || null,
      });
    
    if (leadError) {
      console.error("Error saving lead:", leadError);
    }
  }
}

// Handle postbacks (button clicks)
async function handlePostback(senderId: string, postback: any) {
  console.log(`Handling postback from ${senderId}:`, postback);
  
  // If postback has referral data, handle it
  if (postback.referral) {
    await handleReferral(senderId, postback.referral);
  }
  
  // You can handle button clicks here
  // For now, we'll just log them
}

serve(async (req) => {
  console.log(`[${new Date().toISOString()}] Incoming request: ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const url = new URL(req.url);
  
  // Health check endpoint
  if (url.pathname.endsWith('/health')) {
    console.log('Health check requested');
    return new Response(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'messenger-webhook'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Webhook verification (GET request from Facebook)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully');
      return new Response(challenge, { status: 200 });
    } else {
      console.error('Webhook verification failed');
      return new Response('Forbidden', { status: 403 });
    }
  }
  
  // Handle webhook events (POST request)
  if (req.method === 'POST') {
    const body = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    
    console.log('POST request received');
    console.log('Signature present:', !!signature);
    console.log('Body length:', body.length);
    
    // Verify signature
    if (signature) {
      const isValid = await verifySignature(body, signature);
      if (!isValid) {
        console.error('Invalid signature');
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }
      console.log('Signature verified successfully');
    }
    
    const data = JSON.parse(body);
    console.log('Parsed webhook data:', JSON.stringify(data, null, 2));
    
    // Handle special action for sending messages from frontend
    const action = url.searchParams.get('action');
    if (action === 'send') {
      const { psid, text } = data;
      
      if (!psid || !text) {
        return new Response(JSON.stringify({ error: 'Missing psid or text' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Send message
      const result = await sendMessage(psid, text);
      
      if (!result) {
        return new Response(JSON.stringify({ error: 'Failed to send message' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Get customer
      const { data: customer } = await supabase
        .from('customer')
        .select('id')
        .eq('messenger_id', psid)
        .single();
      
      // Save outbound message
      if (customer) {
        await supabase
          .from('messages')
          .insert({
            customer_id: customer.id,
            messenger_mid: result.message_id,
            platform: 'messenger',
            message_type: 'text',
            message_text: text,
            sender_type: 'employee',
            is_read: true,
            timestamp: new Date().toISOString(),
          });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Process webhook events from Facebook
    if (data.object === 'page') {
      console.log(`Processing ${data.entry.length} page entries`);
      for (const entry of data.entry) {
        console.log(`Processing ${entry.messaging?.length || 0} messaging events`);
        for (const event of entry.messaging) {
          const senderId = event.sender.id;
          console.log(`Event from sender ${senderId}:`, JSON.stringify(event, null, 2));
          
          if (event.message) {
            console.log('Handling message event');
            await handleMessage(senderId, event.message);
          } else if (event.postback) {
            console.log('Handling postback event');
            await handlePostback(senderId, event.postback);
          } else if (event.referral) {
            console.log('Handling referral event');
            await handleReferral(senderId, event.referral);
          }
        }
      }
    } else {
      console.log('Received non-page webhook event:', data.object);
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});