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
const pageId = '561589463698263'; // Facebook Page ID to filter echo messages

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
  const url = `https://graph.facebook.com/v18.0/${psid}?fields=first_name,last_name,profile_pic,locale,timezone&access_token=${pageAccessToken}`;
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
    const errorText = await response.text();
    console.error("Failed to send message:", errorText);
    return { error: JSON.parse(errorText) };
  }
  
  return await response.json();
}

// Send media attachment via Facebook Send API
async function sendAttachment(psid: string, type: string, url: string) {
  const apiUrl = `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: psid },
      message: {
        attachment: {
          type: type, // 'image', 'video', 'file'
          payload: {
            url: url,
            is_reusable: true
          }
        }
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to send attachment:", errorText);
    return { error: JSON.parse(errorText) };
  }
  
  return await response.json();
}

// Download file and store in Supabase Storage
async function downloadAndStoreFile(url: string, fileType: 'photo' | 'voice' | 'video'): Promise<string | null> {
  try {
    console.log(`Downloading ${fileType} from:`, url);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to download file: ${response.status}`);
      return null;
    }
    
    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Determine file extension based on content type
    let extension = 'bin';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';
    else if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('gif')) extension = 'gif';
    else if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('mp4')) extension = 'mp4';
    else if (contentType.includes('webm')) extension = 'webm';
    else if (contentType.includes('mpeg') || contentType.includes('mp3')) extension = 'mp3';
    else if (contentType.includes('ogg')) extension = 'ogg';
    else if (contentType.includes('wav')) extension = 'wav';
    else if (contentType.includes('aac') || contentType.includes('m4a')) extension = 'm4a';
    
    // Create unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const folder = `messenger-${fileType}`;
    const fileName = `${folder}/${timestamp}_${randomId}.${extension}`;
    
    console.log(`Uploading to storage: ${fileName}`);
    
    // Upload to Supabase Storage
    const arrayBuffer = await blob.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, arrayBuffer, {
        contentType,
        upsert: false
      });
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return null;
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName);
    
    console.log(`File stored permanently at: ${publicUrlData.publicUrl}`);
    return publicUrlData.publicUrl;
    
  } catch (error) {
    console.error(`Error storing ${fileType}:`, error);
    return null;
  }
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
        locale: profile?.locale || null,
        timezone_offset: profile?.timezone || null,
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
      // Download and store permanently
      const storedUrl = await downloadAndStoreFile(attachment.payload.url, 'photo');
      photoUrl = storedUrl || attachment.payload.url; // Fallback to original if storage fails
      photoFileId = attachment.payload.sticker_id || 'fb_image';
      console.log(`Photo stored: ${photoUrl}`);
    } else if (attachment.type === 'video') {
      messageType = 'video';
      // Download and store permanently
      const storedUrl = await downloadAndStoreFile(attachment.payload.url, 'video');
      videoUrl = storedUrl || attachment.payload.url;
      videoFileId = 'fb_video';
      videoMimeType = 'video/mp4';
      console.log(`Video stored: ${videoUrl}`);
    } else if (attachment.type === 'audio') {
      messageType = 'voice';
      // Download and store permanently
      const storedUrl = await downloadAndStoreFile(attachment.payload.url, 'voice');
      voiceUrl = storedUrl || attachment.payload.url;
      voiceFileId = 'fb_audio';
      console.log(`Voice stored: ${voiceUrl}`);
    } else if (attachment.type === 'file') {
      messageType = 'text';
      messageText = `[File: ${attachment.payload.url}]`;
    }
  }
  
  // Save message to database
  const timestamp = message.timestamp ? new Date(message.timestamp).toISOString() : new Date().toISOString();
  
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
      timestamp,
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
        locale: profile?.locale || null,
        timezone_offset: profile?.timezone || null,
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
    // Frontend sends { psid, text } while Facebook sends { object: 'page', entry: [...] }
    if (data.psid && data.text && !data.object) {
      const { psid, text } = data;
      
      if (!psid || !text) {
        return new Response(JSON.stringify({ error: 'Missing psid or text' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Check if message is within 24-hour window
      const { data: customerRecord } = await supabase
        .from('customer')
        .select('id')
        .eq('messenger_id', psid)
        .single();
      
      if (customerRecord) {
        // Get last customer message timestamp
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('timestamp')
          .eq('customer_id', customerRecord.id)
          .eq('sender_type', 'customer')
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (lastMessage) {
          const hoursSinceLastMessage = (Date.now() - new Date(lastMessage.timestamp).getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceLastMessage > 24) {
            return new Response(JSON.stringify({ 
              error: 'Cannot send message: 24-hour messaging window has expired. Customer last messaged ' + Math.floor(hoursSinceLastMessage) + ' hours ago.',
              code: 'MESSAGING_WINDOW_EXPIRED',
              hoursSinceLastMessage: Math.floor(hoursSinceLastMessage)
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      }
      
      // Send message
      const result = await sendMessage(psid, text);
      
      if (result?.error) {
        const fbError = result.error.error;
        
        // Handle 24-hour window error specifically
        if (fbError.code === 10 && fbError.error_subcode === 2018278) {
          return new Response(JSON.stringify({ 
            error: 'Cannot send message: 24-hour messaging window has expired. Wait for customer to message first.',
            code: 'MESSAGING_WINDOW_EXPIRED',
            details: fbError.message
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ 
          error: fbError.message,
          code: fbError.code,
          type: fbError.type
        }), {
          status: 400,
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
    
    // Handle send_media action for attachments (images, videos, files)
    if (data.psid && data.media_url && data.media_type && !data.object) {
      const { psid, media_url, media_type, caption } = data;
      
      if (!psid || !media_url || !media_type) {
        return new Response(JSON.stringify({ error: 'Missing psid, media_url, or media_type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Check if message is within 24-hour window
      const { data: customerRecord } = await supabase
        .from('customer')
        .select('id')
        .eq('messenger_id', psid)
        .single();
      
      if (customerRecord) {
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('timestamp')
          .eq('customer_id', customerRecord.id)
          .eq('sender_type', 'customer')
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (lastMessage) {
          const hoursSinceLastMessage = (Date.now() - new Date(lastMessage.timestamp).getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceLastMessage > 24) {
            return new Response(JSON.stringify({ 
              error: 'Cannot send media: 24-hour messaging window has expired.',
              code: 'MESSAGING_WINDOW_EXPIRED',
              hoursSinceLastMessage: Math.floor(hoursSinceLastMessage)
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      }
      
      // Map media_type to Facebook attachment type
      let fbAttachmentType = 'file';
      let dbMediaType = media_type;
      if (media_type === 'photo') fbAttachmentType = 'image';
      else if (media_type === 'video') fbAttachmentType = 'video';
      else if (media_type === 'audio' || media_type === 'voice') {
        fbAttachmentType = 'audio';
        dbMediaType = 'voice';
      }
      
      // Send attachment
      const result = await sendAttachment(psid, fbAttachmentType, media_url);
      
      if (result?.error) {
        const fbError = result.error.error;
        
        if (fbError.code === 10 && fbError.error_subcode === 2018278) {
          return new Response(JSON.stringify({ 
            error: 'Cannot send media: 24-hour messaging window has expired.',
            code: 'MESSAGING_WINDOW_EXPIRED',
            details: fbError.message
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ 
          error: fbError.message,
          code: fbError.code,
          type: fbError.type
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Get customer and save message
      const { data: customer } = await supabase
        .from('customer')
        .select('id')
        .eq('messenger_id', psid)
        .single();
      
      if (customer) {
        const insertData: any = {
          customer_id: customer.id,
          messenger_mid: result.message_id,
          platform: 'messenger',
          message_type: dbMediaType,
          message_text: caption || `[${dbMediaType.charAt(0).toUpperCase() + dbMediaType.slice(1)}]`,
          sender_type: 'employee',
          is_read: true,
          timestamp: new Date().toISOString(),
        };
        
        if (media_type === 'photo') insertData.photo_url = media_url;
        else if (media_type === 'video') insertData.video_url = media_url;
        else if (media_type === 'audio' || media_type === 'voice') insertData.voice_url = media_url;
        
        await supabase.from('messages').insert(insertData);
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
          const recipientId = event.recipient.id;
          console.log(`Event from sender ${senderId}:`, JSON.stringify(event, null, 2));
          
          // Handle messages sent by the page (employee) through Messenger app
          if (senderId === pageId && event.message) {
            // Check if this is an echo of a message we already sent via our interface
            const isEcho = event.message.is_echo === true;
            
            if (isEcho) {
              // Check if we already have this message (sent from our interface)
              const { data: existingMessage } = await supabase
                .from('messages')
                .select('id')
                .eq('messenger_mid', event.message.mid)
                .maybeSingle();
              
              if (existingMessage) {
                console.log('Skipping echo - message already saved from interface');
                continue;
              }
              
              // This is a message sent directly through Messenger by employee
              console.log('Employee message sent via Messenger app');
              
              // Get the recipient (customer) info
              const { data: customer } = await supabase
                .from('customer')
                .select('*')
                .eq('messenger_id', recipientId)
                .maybeSingle();
              
              if (customer) {
                const timestamp = event.message.timestamp ? new Date(event.message.timestamp).toISOString() : new Date().toISOString();
                
                await supabase
                  .from('messages')
                  .insert({
                    customer_id: customer.id,
                    messenger_mid: event.message.mid,
                    platform: 'messenger',
                    message_type: 'text',
                    message_text: event.message.text || null,
                    sender_type: 'employee',
                    is_read: true,
                    timestamp,
                  });
                
                console.log('Saved employee message from Messenger app');
              }
            }
            continue;
          }
          
          // Skip other page-related events
          if (senderId === pageId) {
            console.log('Skipping other page event');
            continue;
          }
          
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