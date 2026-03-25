import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Cache for config values from bot_settings
const configCache: Map<string, string> = new Map();
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper: read config from bot_settings first, fallback to env var
async function getConfigValue(supabaseClient: any, key: string, envFallback: string): Promise<string | undefined> {
  const now = Date.now();
  
  // Check cache first
  if ((now - configCacheTime) < CONFIG_CACHE_TTL && configCache.has(key)) {
    return configCache.get(key);
  }
  
  // If cache is stale, refresh all config values at once
  if ((now - configCacheTime) >= CONFIG_CACHE_TTL) {
    try {
      const { data } = await supabaseClient
        .from('bot_settings')
        .select('key, value')
        .in('key', ['facebook_app_id', 'facebook_app_secret', 'facebook_system_user_token', 'facebook_verify_token']);
      
      configCache.clear();
      if (data) {
        for (const row of data) {
          configCache.set(row.key, row.value);
        }
      }
      configCacheTime = now;
    } catch (err) {
      console.error('Error fetching config from bot_settings:', err);
    }
  }
  
  const dbValue = configCache.get(key);
  if (dbValue) return dbValue;
  
  return Deno.env.get(envFallback) || undefined;
}

// Cache for page access tokens (from DB only)
let pageTokensCache: Map<string, string> = new Map();
let pageTokensCacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Resolve config values (DB-first with env fallback)
let systemUserToken: string | undefined;
let appSecret: string | undefined;
let verifyToken: string | undefined;

async function initConfig() {
  systemUserToken = await getConfigValue(supabase, 'facebook_system_user_token', 'FACEBOOK_SYSTEM_USER_TOKEN');
  appSecret = await getConfigValue(supabase, 'facebook_app_secret', 'FACEBOOK_APP_SECRET');
  verifyToken = await getConfigValue(supabase, 'facebook_verify_token', 'FACEBOOK_VERIFY_TOKEN');
  
  // Log configuration status
  console.log('=== Messenger Webhook Configuration ===');
  console.log('SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓ Set' : '✗ Missing');
  console.log('FACEBOOK_SYSTEM_USER_TOKEN:', systemUserToken ? `✓ Set (length: ${systemUserToken.length})` : '✗ Missing');
  console.log('FACEBOOK_APP_SECRET:', appSecret ? `✓ Set (length: ${appSecret.length})` : '✗ Missing - Signature verification DISABLED');
  console.log('FACEBOOK_VERIFY_TOKEN:', verifyToken ? '✓ Set' : '✗ Missing');
  console.log('======================================');
}

// Config will be initialized inside serve() with await

// Fetch page tokens from database ONLY - no fallback to API
async function fetchPageTokens(): Promise<Map<string, string>> {
  const now = Date.now();
  
  // Return cached tokens if still valid
  if (pageTokensCache.size > 0 && (now - pageTokensCacheTime) < CACHE_TTL) {
    return pageTokensCache;
  }
  
  console.log('Fetching page tokens from database...');
  
  try {
    const { data: dbPages, error } = await supabase
      .from('facebook_pages')
      .select('page_id, access_token')
      .eq('is_active', true);
    
    if (error) {
      console.error('Error fetching page tokens from DB:', error);
      return pageTokensCache;
    }
    
    if (dbPages && dbPages.length > 0) {
      const newCache = new Map<string, string>();
      for (const page of dbPages) {
        newCache.set(page.page_id, page.access_token);
      }
      pageTokensCache = newCache;
      pageTokensCacheTime = now;
      console.log(`Loaded ${newCache.size} page tokens from database`);
      return newCache;
    }
    
    console.warn('No page tokens found in database. Please sync pages from the Facebook Pages UI.');
    return pageTokensCache;
  } catch (error) {
    console.error('Error fetching page tokens:', error);
    return pageTokensCache;
  }
}

// Get access token for a specific page - DB only, no fallback
async function getPageToken(pageId: string): Promise<string | null> {
  const tokens = await fetchPageTokens();
  const token = tokens.get(pageId);
  
  if (!token) {
    console.error(`No token found for page ${pageId}. Please sync pages from the Facebook Pages UI.`);
    return null;
  }
  
  return token;
}

// Sync pages from Facebook to database using System User Token
async function syncPagesToDatabase(): Promise<{ success: boolean; pages: any[]; error?: string }> {
  console.log('Syncing pages from Facebook to database using System User Token...');
  
  if (!systemUserToken) {
    return { success: false, pages: [], error: 'FACEBOOK_SYSTEM_USER_TOKEN is not configured' };
  }
  
  try {
    const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,category,picture&access_token=${systemUserToken}`;
    const response = await fetch(pagesUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch pages from Facebook:', errorText);
      return { success: false, pages: [], error: errorText };
    }
    
    const data = await response.json();
    const pages = data.data || [];
    const syncedPages = [];
    
    for (const page of pages) {
      const pageData = {
        page_id: page.id,
        name: page.name,
        category: page.category,
        picture_url: page.picture?.data?.url || null,
        access_token: page.access_token,
        is_active: true,
        updated_at: new Date().toISOString()
      };
      
      // Upsert page data
      const { data: upsertedPage, error } = await supabase
        .from('facebook_pages')
        .upsert(pageData, { onConflict: 'page_id' })
        .select()
        .single();
      
      if (error) {
        console.error(`Error upserting page ${page.id}:`, error);
      } else {
        syncedPages.push({
          id: page.id,
          name: page.name,
          category: page.category,
          picture: page.picture?.data?.url
        });
      }
    }
    
    // Invalidate cache to use new tokens
    pageTokensCache = new Map();
    pageTokensCacheTime = 0;
    
    console.log(`Synced ${syncedPages.length} pages to database`);
    return { success: true, pages: syncedPages };
  } catch (error) {
    console.error('Error syncing pages:', error);
    return { success: false, pages: [], error: String(error) };
  }
}

// Verify webhook signature with detailed debug logging
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  if (!appSecret) {
    console.warn('FACEBOOK_APP_SECRET not configured - skipping signature verification');
    console.warn('⚠️ This is insecure! Configure FACEBOOK_APP_SECRET for production.');
    return true; // Skip verification if no secret configured
  }
  
  console.log('=== Signature Verification Debug ===');
  console.log('App Secret length:', appSecret.length);
  console.log('App Secret first 4 chars:', appSecret.substring(0, 4));
  console.log('App Secret last 4 chars:', appSecret.substring(appSecret.length - 4));
  console.log('Payload length:', payload.length);
  console.log('Received signature:', signature);
  
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
  
  const expectedSignature = `sha256=${sigHex}`;
  console.log('Expected signature:', expectedSignature);
  console.log('Signatures match:', expectedSignature === signature);
  console.log('=====================================');
  
  return expectedSignature === signature;
}

// Fetch user profile from Facebook using page token from DB
async function getUserProfile(psid: string, pageId: string) {
  const token = await getPageToken(pageId);
  
  if (!token) {
    console.error(`Cannot fetch user profile - no token for page ${pageId}`);
    return null;
  }
  
  const url = `https://graph.facebook.com/v18.0/${psid}?fields=first_name,last_name,profile_pic,locale,timezone&access_token=${token}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch user profile:", errorText);
      if (errorText.includes('pages_messaging') || errorText.includes('permission')) {
        console.warn("Note: Your Facebook App needs 'pages_messaging' permission to fetch user profiles.");
      }
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

// Send message via Facebook Send API using page token from DB
async function sendMessage(psid: string, text: string, pageId: string) {
  const token = await getPageToken(pageId);
  
  if (!token) {
    console.error(`Cannot send message - no token for page ${pageId}`);
    return { error: { error: { message: 'No page token available. Please sync pages first.', code: 'NO_TOKEN' } } };
  }
  
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${token}`;
  
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

// Send media attachment via Facebook Send API using page token from DB
async function sendAttachment(psid: string, type: string, url: string, pageId: string) {
  const token = await getPageToken(pageId);
  
  if (!token) {
    console.error(`Cannot send attachment - no token for page ${pageId}`);
    return { error: { error: { message: 'No page token available. Please sync pages first.', code: 'NO_TOKEN' } } };
  }
  
  const apiUrl = `https://graph.facebook.com/v18.0/me/messages?access_token=${token}`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: psid },
      message: {
        attachment: {
          type: type,
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
    
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const folder = `messenger-${fileType}`;
    const fileName = `${folder}/${timestamp}_${randomId}.${extension}`;
    
    console.log(`Uploading to storage: ${fileName}`);
    
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

// Download and store profile picture permanently
async function downloadAndStoreProfilePic(url: string, customerId: string): Promise<string | null> {
  try {
    console.log(`Downloading profile pic for customer ${customerId} from:`, url);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to download profile pic: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const fileName = `profile-pics/${customerId}.jpg`;
    
    // Upload to Supabase Storage (upsert to allow updates)
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true, // Overwrite if exists
      });
    
    if (uploadError) {
      console.error('Profile pic upload error:', uploadError);
      return null;
    }
    
    const { data: publicUrlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName);
    
    console.log(`Profile pic stored permanently at: ${publicUrlData.publicUrl}`);
    return publicUrlData.publicUrl;
    
  } catch (error) {
    console.error(`Error storing profile pic:`, error);
    return null;
  }
}

// Handle incoming messages
async function handleMessage(senderId: string, message: any, pageId: string, hasReferral: boolean = false) {
  console.log(`Handling message from ${senderId} on page ${pageId}:`, message);
  console.log(`Has referral data: ${hasReferral}`);
  
  let customer: any = null;
  let isNewCustomer = false;
  
  try {
    console.log(`Looking up customer with messenger_id: ${senderId}`);
    const { data: existingCustomer, error: customerError } = await supabase
      .from('customer')
      .select('*')
      .eq('messenger_id', senderId)
      .maybeSingle();
    
    if (customerError) {
      console.error("Error looking up customer:", customerError);
    }
    
    customer = existingCustomer;
    console.log(`Customer lookup result:`, customer ? `Found: ${customer.id}` : 'Not found');
    
    // If customer exists but has "Unknown" name, try to refresh their profile
    if (customer && customer.messenger_name === 'Unknown') {
      console.log(`Customer has Unknown name, attempting to refresh profile for ${senderId}`);
      const profile = await getUserProfile(senderId, pageId);
      
      if (profile && profile.first_name) {
        console.log(`Profile refresh successful: ${profile.first_name} ${profile.last_name}`);
        
        // Download and store profile pic permanently if available
        let permanentProfilePicUrl = customer.messenger_profile_pic;
        if (profile.profile_pic) {
          const storedUrl = await downloadAndStoreProfilePic(profile.profile_pic, customer.id);
          if (storedUrl) {
            permanentProfilePicUrl = storedUrl;
          }
        }
        
        const { error: updateError } = await supabase
          .from('customer')
          .update({
            messenger_name: `${profile.first_name} ${profile.last_name}`,
            messenger_profile_pic: permanentProfilePicUrl,
            locale: profile.locale || customer.locale,
            timezone_offset: profile.timezone || customer.timezone_offset,
            updated_at: new Date().toISOString(),
          })
          .eq('id', customer.id);
        
        if (updateError) {
          console.error("Error updating customer profile:", updateError);
        } else {
          console.log(`Customer profile updated successfully with permanent photo`);
          customer.messenger_name = `${profile.first_name} ${profile.last_name}`;
        }
      } else {
        console.log(`Profile refresh failed, keeping Unknown name`);
      }
    }
    
    if (!customer) {
      isNewCustomer = true;
      console.log(`Creating new customer for messenger_id: ${senderId}`);
      
      console.log(`Fetching Facebook profile for ${senderId} on page ${pageId}`);
      const profile = await getUserProfile(senderId, pageId);
      console.log(`Profile fetch result:`, profile ? `Success: ${profile.first_name} ${profile.last_name}` : 'Failed');
      
      // Create customer first (to get customer ID for profile pic storage)
      const customerData = {
        messenger_id: senderId,
        messenger_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
        messenger_profile_pic: null, // Will be updated after storage
        locale: profile?.locale || null,
        timezone_offset: profile?.timezone || null,
        first_message_at: new Date().toISOString(),
        page_id: pageId,
      };
      console.log(`Inserting customer:`, customerData);
      
      const { data: newCustomer, error: insertError } = await supabase
        .from('customer')
        .insert(customerData)
        .select()
        .single();
      
      if (insertError) {
        console.error("Error creating customer:", insertError);
        return;
      }
      
      customer = newCustomer;
      console.log(`Customer created successfully: ${customer.id}`);
      
      // Now download and store profile pic permanently if available
      if (profile?.profile_pic && customer.id) {
        const permanentProfilePicUrl = await downloadAndStoreProfilePic(profile.profile_pic, customer.id);
        if (permanentProfilePicUrl) {
          const { error: updateError } = await supabase
            .from('customer')
            .update({ messenger_profile_pic: permanentProfilePicUrl })
            .eq('id', customer.id);
          
          if (updateError) {
            console.error("Error updating customer profile pic:", updateError);
          } else {
            console.log(`Profile pic stored permanently for new customer: ${customer.id}`);
            customer.messenger_profile_pic = permanentProfilePicUrl;
          }
        }
      }
    }
    
    if (isNewCustomer && !hasReferral) {
      console.log(`Creating lead entry for new Messenger customer: ${customer.id}`);
      const { error: leadError } = await supabase
        .from('telegram_leads')
        .insert({
          user_id: customer.id,
          platform: 'messenger',
          messenger_ref: 'direct_message',
        });
      
      if (leadError) {
        console.error("Error creating lead for new customer:", leadError);
      } else {
        console.log(`Lead created successfully for customer: ${customer.id}`);
      }
    }
  } catch (err) {
    console.error("Unexpected error in handleMessage:", err);
    return;
  }
  
  if (!customer) {
    console.error("No customer available, cannot save message");
    return;
  }
  
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
  let documentUrl: string | null = null;
  let documentName: string | null = null;
  let documentMimeType: string | null = null;
  
  const timestamp = message.timestamp ? new Date(message.timestamp).toISOString() : new Date().toISOString();

  if (message.text) {
    messageType = 'text';
    messageText = message.text;
    
    // Insert single text message
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        customer_id: customer.id,
        messenger_mid: message.mid,
        platform: 'messenger',
        message_type: messageType,
        message_text: messageText,
        sender_type: 'customer',
        is_read: false,
        timestamp,
      });
    
    if (messageError) {
      console.error("Error saving text message:", messageError);
    }
  } else if (message.attachments && message.attachments.length > 0) {
    // Generate a media_group_id if there are multiple attachments
    const mediaGroupId = message.attachments.length > 1 
      ? `messenger-${Date.now()}-${Math.random().toString(36).substring(7)}`
      : null;
    
    console.log(`Processing ${message.attachments.length} attachments, mediaGroupId: ${mediaGroupId}`);
    
    // Process each attachment separately
    for (let i = 0; i < message.attachments.length; i++) {
      const attachment = message.attachments[i];
      let attPhotoUrl: string | null = null;
      let attPhotoFileId: string | null = null;
      let attVideoUrl: string | null = null;
      let attVideoFileId: string | null = null;
      let attVideoMimeType: string | null = null;
      let attVoiceUrl: string | null = null;
      let attVoiceFileId: string | null = null;
      let attDocumentUrl: string | null = null;
      let attDocumentName: string | null = null;
      let attDocumentMimeType: string | null = null;
      let attMessageType = 'text';
      let attMessageText: string | null = null;
      
      if (attachment.type === 'image') {
        attMessageType = 'photo';
        const storedUrl = await downloadAndStoreFile(attachment.payload.url, 'photo');
        attPhotoUrl = storedUrl || attachment.payload.url;
        attPhotoFileId = attachment.payload.sticker_id || 'fb_image';
        // Only set caption text for the first attachment
        attMessageText = i === 0 ? (message.text || null) : null;
        console.log(`Photo ${i + 1} stored: ${attPhotoUrl}`);
      } else if (attachment.type === 'video') {
        attMessageType = 'video';
        const storedUrl = await downloadAndStoreFile(attachment.payload.url, 'video');
        attVideoUrl = storedUrl || attachment.payload.url;
        attVideoFileId = 'fb_video';
        attVideoMimeType = 'video/mp4';
        attMessageText = i === 0 ? (message.text || null) : null;
        console.log(`Video ${i + 1} stored: ${attVideoUrl}`);
      } else if (attachment.type === 'audio') {
        attMessageType = 'voice';
        const storedUrl = await downloadAndStoreFile(attachment.payload.url, 'voice');
        attVoiceUrl = storedUrl || attachment.payload.url;
        attVoiceFileId = 'fb_audio';
        console.log(`Voice stored: ${attVoiceUrl}`);
      } else if (attachment.type === 'file') {
        attMessageType = 'document';
        const storedUrl = await downloadAndStoreFile(attachment.payload.url, 'photo'); // reuse download logic
        const fileName = attachment.payload.name || 'document';
        attDocumentUrl = storedUrl || attachment.payload.url;
        attDocumentName = fileName;
        attDocumentMimeType = 'application/octet-stream';
        attMessageText = `[Document: ${fileName}]`;
        console.log(`Document stored: ${attDocumentUrl}`);
      }
      
      // Insert each attachment as a message
      const { error: attachmentError } = await supabase
        .from('messages')
        .insert({
          customer_id: customer.id,
          messenger_mid: `${message.mid}-${i}`,
          platform: 'messenger',
          message_type: attMessageType,
          message_text: attMessageText,
          photo_url: attPhotoUrl,
          photo_file_id: attPhotoFileId,
          video_url: attVideoUrl,
          video_file_id: attVideoFileId,
          video_mime_type: attVideoMimeType,
          voice_url: attVoiceUrl,
          voice_file_id: attVoiceFileId,
          voice_duration: voiceDuration,
          document_url: attDocumentUrl,
          document_name: attDocumentName,
          document_mime_type: attDocumentMimeType,
          media_group_id: mediaGroupId,
          sender_type: 'customer',
          is_read: false,
          timestamp,
        });
      
      if (attachmentError) {
        console.error(`Error saving attachment ${i + 1}:`, attachmentError);
      } else {
        console.log(`Attachment ${i + 1} saved successfully`);
      }
    }
  }
}

// Handle referrals (ad attribution)
async function handleReferral(senderId: string, referral: any, pageId: string) {
  console.log(`Handling referral from ${senderId} on page ${pageId}:`, referral);
  
  let { data: customer } = await supabase
    .from('customer')
    .select('*')
    .eq('messenger_id', senderId)
    .maybeSingle();
  
  if (!customer) {
    const profile = await getUserProfile(senderId, pageId);
    
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
async function handlePostback(senderId: string, postback: any, pageId: string) {
  console.log(`Handling postback from ${senderId} on page ${pageId}:`, postback);
  
  if (postback.referral) {
    await handleReferral(senderId, postback.referral, pageId);
  }
}

serve(async (req) => {
  console.log(`[${new Date().toISOString()}] Incoming request: ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const url = new URL(req.url);
  
  // Health check endpoint
  if (url.pathname.endsWith('/health')) {
    console.log('Health check requested');
    
    // Check token status
    const tokens = await fetchPageTokens();
    
    return new Response(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'messenger-webhook',
      config: {
        systemUserToken: systemUserToken ? 'configured' : 'missing',
        appSecret: appSecret ? 'configured' : 'missing (signature verification disabled)',
        verifyToken: verifyToken ? 'configured' : 'missing',
        pageTokensInDB: tokens.size
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Endpoint to fetch all connected pages (from database or Facebook)
  if (url.pathname.endsWith('/pages') && req.method === 'GET') {
    console.log('Fetching all connected pages');
    try {
      // First try database
      const { data: dbPages, error: dbError } = await supabase
        .from('facebook_pages')
        .select('page_id, name, category, picture_url, is_active, updated_at')
        .eq('is_active', true);
      
      if (!dbError && dbPages && dbPages.length > 0) {
        const pages = dbPages.map(page => ({
          id: page.page_id,
          name: page.name,
          category: page.category,
          picture: page.picture_url,
          synced: true,
          lastUpdated: page.updated_at
        }));
        
        console.log(`Found ${pages.length} pages in database`);
        return new Response(JSON.stringify({ success: true, pages, source: 'database' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Fallback to Facebook API using System User Token for initial discovery
      if (!systemUserToken) {
        return new Response(JSON.stringify({ error: 'No System User Token configured', pages: [] }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,category,picture&access_token=${systemUserToken}`;
      const response = await fetch(pagesUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch pages:', errorText);
        return new Response(JSON.stringify({ error: 'Failed to fetch pages', details: errorText }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const data = await response.json();
      
      const pages = (data.data || []).map((page: any) => ({
        id: page.id,
        name: page.name,
        category: page.category,
        picture: page.picture?.data?.url,
        synced: false
      }));
      
      console.log(`Found ${pages.length} connected pages from Facebook`);
      
      return new Response(JSON.stringify({ success: true, pages, source: 'facebook' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error fetching pages:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch pages' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Endpoint to sync pages from Facebook to database
  if (url.pathname.endsWith('/pages/sync') && req.method === 'POST') {
    console.log('Syncing pages to database');
    const result = await syncPagesToDatabase();
    
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Endpoint to get app and system user info
  if (url.pathname.endsWith('/app-info') && req.method === 'GET') {
    console.log('Fetching app and system user info');
    
    try {
      if (!systemUserToken) {
        return new Response(JSON.stringify({ 
          error: 'No System User Token configured',
          app: null,
          systemUser: null
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Fetch info about the current token (which includes app and user info)
      const debugUrl = `https://graph.facebook.com/debug_token?input_token=${systemUserToken}&access_token=${systemUserToken}`;
      console.log('Calling debug_token API...');
      const debugResponse = await fetch(debugUrl);
      let tokenData = null;
      
      if (debugResponse.ok) {
        const debugResult = await debugResponse.json();
        tokenData = debugResult.data;
        console.log('Token debug info:', JSON.stringify(tokenData, null, 2));
      } else {
        const errorText = await debugResponse.text();
        console.error('Failed to debug token:', errorText);
        console.error('This usually means the System User Token is invalid or expired.');
      }
      
      // Fetch app info using the app_id from token debug
      // Note: Usage statistics (daily/weekly/monthly active users) require an app access token, not system user token
      let appInfo = null;
      if (tokenData?.app_id) {
        // Only request fields accessible with system user token
        const appUrl = `https://graph.facebook.com/v18.0/${tokenData.app_id}?fields=id,name,category,link,privacy_policy_url&access_token=${systemUserToken}`;
        const appResponse = await fetch(appUrl);
        
        if (appResponse.ok) {
          appInfo = await appResponse.json();
          console.log('App info:', JSON.stringify(appInfo, null, 2));
        } else {
          const errorText = await appResponse.text();
          console.log('App endpoint failed (expected with system user token):', errorText);
          // Use fallback data from token debug
          console.log('Using token debug data as fallback for app info');
        }
      }
      
      // Build app info from token debug data as fallback
      const appInfoFromToken = tokenData ? {
        id: tokenData.app_id,
        name: tokenData.application || 'Unknown App',
      } : null;
      
      // Fetch system user info using the user_id from token debug
      let systemUserInfo = null;
      if (tokenData?.user_id) {
        const userUrl = `https://graph.facebook.com/v18.0/${tokenData.user_id}?fields=id,name&access_token=${systemUserToken}`;
        const userResponse = await fetch(userUrl);
        
        if (userResponse.ok) {
          systemUserInfo = await userResponse.json();
          console.log('System user info:', JSON.stringify(systemUserInfo, null, 2));
        } else {
          console.error('Failed to fetch system user info:', await userResponse.text());
        }
      }
      
      // Also try to get the business info (which system users belong to)
      let businessInfo = null;
      try {
        const businessUrl = `https://graph.facebook.com/v18.0/me?fields=business&access_token=${systemUserToken}`;
        const businessResponse = await fetch(businessUrl);
        
        if (businessResponse.ok) {
          const businessResult = await businessResponse.json();
          if (businessResult.business) {
            // Fetch more business details
            const businessDetailsUrl = `https://graph.facebook.com/v18.0/${businessResult.business.id}?fields=id,name,profile_picture_uri,verification_status,link&access_token=${systemUserToken}`;
            const detailsResponse = await fetch(businessDetailsUrl);
            
            if (detailsResponse.ok) {
              businessInfo = await detailsResponse.json();
              console.log('Business info:', JSON.stringify(businessInfo, null, 2));
            }
          }
        }
      } catch (err) {
        console.log('Could not fetch business info:', err);
      }
      
      // Use direct app info if available, otherwise fall back to token debug data
      const finalAppInfo = appInfo ? {
        id: appInfo.id,
        name: appInfo.name,
        category: appInfo.category,
        link: appInfo.link,
        privacyPolicyUrl: appInfo.privacy_policy_url,
      } : appInfoFromToken;
      
      return new Response(JSON.stringify({
        success: true,
        app: finalAppInfo,
        systemUser: systemUserInfo ? {
          id: systemUserInfo.id,
          name: systemUserInfo.name,
        } : null,
        business: businessInfo ? {
          id: businessInfo.id,
          name: businessInfo.name,
          profilePicture: businessInfo.profile_picture_uri,
          verificationStatus: businessInfo.verification_status,
          link: businessInfo.link,
        } : null,
        token: tokenData ? {
          appId: tokenData.app_id,
          userId: tokenData.user_id,
          type: tokenData.type,
          isValid: tokenData.is_valid,
          expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : 'Never',
          scopes: tokenData.scopes,
          granularScopes: tokenData.granular_scopes,
        } : null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error fetching app info:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch app info' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Endpoint to get page tokens (for authenticated admin users)
  if (url.pathname.endsWith('/pages/tokens') && req.method === 'GET') {
    console.log('Fetching page tokens');
    
    try {
      const { data: dbPages, error } = await supabase
        .from('facebook_pages')
        .select('page_id, name, access_token, updated_at, token_expires_at')
        .eq('is_active', true);
      
      if (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch tokens', details: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const tokens = (dbPages || []).map(page => ({
        pageId: page.page_id,
        name: page.name,
        accessToken: page.access_token,
        updatedAt: page.updated_at,
        expiresAt: page.token_expires_at
      }));
      
      return new Response(JSON.stringify({ success: true, tokens }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error fetching tokens:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch tokens' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
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
    console.log('Body preview (first 200 chars):', body.substring(0, 200));
    
    if (signature) {
      const isValid = await verifySignature(body, signature);
      if (!isValid) {
        console.error('Invalid signature - Request rejected');
        console.error('This usually means FACEBOOK_APP_SECRET is incorrect or outdated.');
        console.error('Please verify your App Secret in Facebook Developer Console matches the secret in Supabase.');
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }
      console.log('Signature verified successfully');
    } else {
      console.warn('No signature header - Request may not be from Facebook');
    }
    
    const data = JSON.parse(body);
    console.log('Parsed webhook data:', JSON.stringify(data, null, 2));
    
    // Handle special action for sending messages from frontend
    if (data.psid && data.text && !data.object) {
      const { psid, text, sent_by_name, page_id } = data;
      
      if (!psid || !text) {
        return new Response(JSON.stringify({ error: 'Missing psid or text' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (!page_id) {
        return new Response(JSON.stringify({ error: 'Missing page_id - required to send messages' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
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
      
      const result = await sendMessage(psid, text, page_id);
      
      if (result?.error) {
        const fbError = result.error.error;
        
        if (fbError?.code === 10 && fbError?.error_subcode === 2018278) {
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
          error: fbError?.message || 'Unknown error',
          code: fbError?.code || 'UNKNOWN',
          type: fbError?.type
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const { data: customer } = await supabase
        .from('customer')
        .select('id')
        .eq('messenger_id', psid)
        .single();
      
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
            sent_by_name: sent_by_name || null,
            is_read: true,
            timestamp: new Date().toISOString(),
          });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Handle send_media action for attachments
    if (data.psid && data.media_url && data.media_type && !data.object) {
      const { psid, media_url, media_type, caption, sent_by_name, page_id, document_name, document_mime_type } = data;
      
      if (!psid || !media_url || !media_type) {
        return new Response(JSON.stringify({ error: 'Missing psid, media_url, or media_type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (!page_id) {
        return new Response(JSON.stringify({ error: 'Missing page_id - required to send media' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
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
      
      let fbAttachmentType = 'file';
      let dbMediaType = media_type;
      if (media_type === 'photo') fbAttachmentType = 'image';
      else if (media_type === 'video') fbAttachmentType = 'video';
      else if (media_type === 'audio' || media_type === 'voice') {
        fbAttachmentType = 'audio';
        dbMediaType = 'voice';
      }
      
      const result = await sendAttachment(psid, fbAttachmentType, media_url, page_id);
      
      if (result?.error) {
        const fbError = result.error.error;
        
        if (fbError?.code === 10 && fbError?.error_subcode === 2018278) {
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
          error: fbError?.message || 'Unknown error',
          code: fbError?.code || 'UNKNOWN',
          type: fbError?.type
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
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
          sent_by_name: sent_by_name || null,
          is_read: true,
          timestamp: new Date().toISOString(),
        };
        
        if (media_type === 'photo') insertData.photo_url = media_url;
        else if (media_type === 'video') insertData.video_url = media_url;
        else if (media_type === 'audio' || media_type === 'voice') insertData.voice_url = media_url;
        else if (media_type === 'document') {
          insertData.document_url = media_url;
          const urlParts = media_url.split('/');
          insertData.document_name = document_name || urlParts[urlParts.length - 1] || 'document';
          insertData.document_mime_type = document_mime_type || 'application/octet-stream';
        }
        
        await supabase.from('messages').insert(insertData);
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Handle send_media_batch action for multiple attachments with shared media_group_id
    if (data.action === 'send_media_batch' && data.psid && data.media_items && !data.object) {
      const { psid, media_items, caption, sent_by_name, page_id, media_group_id } = data;
      
      if (!psid || !media_items || !Array.isArray(media_items) || media_items.length === 0) {
        return new Response(JSON.stringify({ error: 'Missing psid or media_items' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (!page_id) {
        return new Response(JSON.stringify({ error: 'Missing page_id - required to send media batch' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Check 24-hour window
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
              error: 'Cannot send media batch: 24-hour messaging window has expired.',
              code: 'MESSAGING_WINDOW_EXPIRED',
              hoursSinceLastMessage: Math.floor(hoursSinceLastMessage)
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      }
      
      // Send each media item sequentially (Messenger doesn't support media groups like Telegram)
      for (let i = 0; i < media_items.length; i++) {
        const item = media_items[i];
        let fbAttachmentType = 'file';
        let dbMediaType = item.type;
        
        if (item.type === 'photo') fbAttachmentType = 'image';
        else if (item.type === 'video') fbAttachmentType = 'video';
        
        const result = await sendAttachment(psid, fbAttachmentType, item.url, page_id);
        
        if (result?.error) {
          const fbError = result.error.error;
          if (fbError?.code === 10 && fbError?.error_subcode === 2018278) {
            return new Response(JSON.stringify({ 
              error: 'Cannot send media batch: 24-hour messaging window has expired.',
              code: 'MESSAGING_WINDOW_EXPIRED'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
        
        // Save each item to DB with shared media_group_id
        if (customerRecord) {
          const insertData: any = {
            customer_id: customerRecord.id,
            messenger_mid: result?.message_id || null,
            platform: 'messenger',
            message_type: dbMediaType,
            message_text: i === 0 && caption ? caption : `[${dbMediaType.charAt(0).toUpperCase() + dbMediaType.slice(1)}]`,
            sender_type: 'employee',
            sent_by_name: sent_by_name || null,
            is_read: true,
            timestamp: new Date().toISOString(),
            media_group_id: media_group_id,
          };
          
          if (item.type === 'photo') insertData.photo_url = item.url;
          else if (item.type === 'video') insertData.video_url = item.url;
          
          await supabase.from('messages').insert(insertData);
        }
      }
      
      return new Response(JSON.stringify({ success: true, media_group_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Process webhook events from Facebook
    if (data.object === 'page') {
      console.log(`Processing ${data.entry.length} page entries`);
      for (const entry of data.entry) {
        const currentPageId = entry.id;
        console.log(`Processing page ${currentPageId} with ${entry.messaging?.length || 0} messaging events`);
        
        for (const event of entry.messaging || []) {
          const senderId = event.sender.id;
          const recipientId = event.recipient.id;
          console.log(`[Page ${currentPageId}] Event from sender ${senderId}:`, JSON.stringify(event, null, 2));
          
          // Handle messages sent by the page (employee) through Messenger app
          if (senderId === currentPageId && event.message) {
            const isEcho = event.message.is_echo === true;
            
            if (isEcho) {
              const { data: existingMessage } = await supabase
                .from('messages')
                .select('id')
                .eq('messenger_mid', event.message.mid)
                .maybeSingle();
              
              if (existingMessage) {
                console.log('Skipping echo - message already saved from interface');
                continue;
              }
              
              console.log(`Employee message sent via Messenger app on page ${currentPageId}`);
              
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
          
          if (senderId === currentPageId) {
            console.log('Skipping other page event');
            continue;
          }
          
          if (event.message) {
            console.log('Handling message event');
            const hasReferral = !!event.message.referral;
            if (hasReferral) {
              console.log('Message contains referral data, handling referral first');
              await handleReferral(senderId, event.message.referral, currentPageId);
            }
            await handleMessage(senderId, event.message, currentPageId, hasReferral);
          } else if (event.postback) {
            console.log('Handling postback event');
            await handlePostback(senderId, event.postback, currentPageId);
          } else if (event.referral) {
            console.log('Handling referral event');
            await handleReferral(senderId, event.referral, currentPageId);
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
