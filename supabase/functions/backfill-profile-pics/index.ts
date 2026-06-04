import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get all active page tokens
async function getActivePageTokens(): Promise<Array<{ page_id: string; access_token: string }>> {
  const { data, error } = await supabase
    .from('facebook_pages')
    .select('page_id, access_token')
    .eq('is_active', true);
  
  if (error || !data) {
    console.error("Failed to fetch active pages:", error);
    return [];
  }
  return data;
}

// Try to fetch Messenger profile using a page token
async function fetchMessengerProfile(messengerId: string, pageToken: string): Promise<any | null> {
  try {
    const url = `https://graph.facebook.com/v18.0/${messengerId}?fields=first_name,last_name,profile_pic,locale,timezone&access_token=${pageToken}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const profile = await response.json();
    if (profile.error) return null;
    return profile;
  } catch {
    return null;
  }
}

// Download image and store in Supabase Storage
async function downloadAndStorePhoto(imageUrl: string, customerId: string): Promise<string | null> {
  try {
    const downloadResponse = await fetch(imageUrl);
    if (!downloadResponse.ok) return null;
    
    const fileBuffer = await downloadResponse.arrayBuffer();
    const fileName = `profile-pics/${customerId}.jpg`;
    
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, fileBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true,
      });
    
    if (uploadError) {
      console.error("Failed to upload profile photo:", uploadError);
      return null;
    }
    
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  } catch {
    return null;
  }
}

// Get Telegram profile photo
async function getTelegramProfilePhoto(telegramId: number, customerId: string): Promise<string | null> {
  try {
    if (!BOT_TOKEN) return null;

    const response = await fetch(`${TELEGRAM_API}/getUserProfilePhotos?user_id=${telegramId}&limit=1`);
    const data = await response.json();
    
    if (!data.ok || !data.result.photos || data.result.photos.length === 0) return null;
    
    const photoSizes = data.result.photos[0];
    const largest = photoSizes[photoSizes.length - 1];
    
    const fileResponse = await fetch(`${TELEGRAM_API}/getFile?file_id=${largest.file_id}`);
    const fileData = await fileResponse.json();
    
    if (!fileData.ok || !fileData.result.file_path) return null;
    
    const telegramFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
    return await downloadAndStorePhoto(telegramFileUrl, customerId);
  } catch {
    return null;
  }
}

// Main backfill function
async function backfillProfilePics(limit: number = 50): Promise<{
  success: boolean;
  processed: number;
  updated: number;
  failed: number;
  remaining: number;
  errors: Array<{ customerId: string; error: string }>;
}> {
  const results = {
    success: true,
    processed: 0,
    updated: 0,
    failed: 0,
    remaining: 0,
    errors: [] as Array<{ customerId: string; error: string }>,
  };
  
  try {
    // Get active pages for inferring page_id
    const activePages = await getActivePageTokens();
    console.log(`Found ${activePages.length} active pages for profile lookups`);

    // Get customers that need fixing:
    // - Missing profile pic OR messenger_name is 'Unknown'
    const { data: customers, error: queryError } = await supabase
      .from('customer')
      .select('id, telegram_id, messenger_id, messenger_name, page_id')
      .or('messenger_profile_pic.is.null,messenger_name.eq.Unknown')
      .limit(limit);
    
    if (queryError) {
      throw new Error(`Failed to query customers: ${queryError.message}`);
    }
    
    if (!customers || customers.length === 0) {
      console.log("No customers found needing profile updates");
      return results;
    }
    
    // Count total remaining
    const { count: totalMissing } = await supabase
      .from('customer')
      .select('*', { count: 'exact', head: true })
      .or('messenger_profile_pic.is.null,messenger_name.eq.Unknown');

    console.log(`Processing ${customers.length} customers (${totalMissing} total need fixing)...`);
    
    for (const customer of customers) {
      await delay(100);
      
      try {
        if (customer.telegram_id) {
          // Telegram customer
          const photoUrl = await getTelegramProfilePhoto(customer.telegram_id, customer.id);
          if (photoUrl) {
            await supabase
              .from('customer')
              .update({ messenger_profile_pic: photoUrl })
              .eq('id', customer.id);
            results.updated++;
          }
          results.processed++;
          continue;
        }
        
        if (customer.messenger_id) {
          // Messenger customer - try known page_id first, then all active pages
          const pagesToTry = customer.page_id
            ? [{ page_id: customer.page_id, access_token: activePages.find(p => p.page_id === customer.page_id)?.access_token || '' }, ...activePages.filter(p => p.page_id !== customer.page_id)]
            : activePages;
          
          let profileFound = false;
          
          for (const page of pagesToTry) {
            if (!page.access_token) continue;
            
            const profile = await fetchMessengerProfile(customer.messenger_id, page.access_token);
            if (profile && profile.first_name) {
              console.log(`Found profile for ${customer.id} via page ${page.page_id}: ${profile.first_name} ${profile.last_name}`);
              
              // Download and store profile pic
              let photoUrl: string | null = null;
              if (profile.profile_pic) {
                photoUrl = await downloadAndStorePhoto(profile.profile_pic, customer.id);
              }
              
              // Update customer with name, pic, and page_id
              const updateData: any = {
                messenger_name: `${profile.first_name} ${profile.last_name}`,
                updated_at: new Date().toISOString(),
              };
              if (photoUrl) updateData.messenger_profile_pic = photoUrl;
              if (!customer.page_id) updateData.page_id = page.page_id;
              if (profile.locale) updateData.locale = profile.locale;
              if (profile.timezone) updateData.timezone_offset = profile.timezone;
              
              await supabase
                .from('customer')
                .update(updateData)
                .eq('id', customer.id);
              
              results.updated++;
              profileFound = true;
              break;
            }
            
            await delay(50); // Small delay between page attempts
          }
          
          if (!profileFound) {
            console.log(`Could not fetch profile for messenger customer ${customer.id}`);
          }
          
          results.processed++;
          continue;
        }
        
        // No telegram_id or messenger_id
        results.processed++;
      } catch (error) {
        results.failed++;
        results.errors.push({ customerId: customer.id, error: String(error) });
        console.error(`Error processing customer ${customer.id}:`, error);
      }
    }
    
    results.remaining = (totalMissing || 0) - results.processed;
    console.log(`Backfill complete: ${results.processed} processed, ${results.updated} updated, ${results.failed} failed, ${results.remaining} remaining`);
    
  } catch (error) {
    results.success = false;
    console.error("Backfill error:", error);
    throw error;
  }
  
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    let limit = 50;
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.limit && typeof body.limit === 'number') {
          limit = Math.min(body.limit, 200);
        }
      } catch {
        // Use default limit
      }
    }
    
    console.log(`Starting profile picture backfill with limit: ${limit}`);
    const results = await backfillProfilePics(limit);
    
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error in backfill-profile-pics:", error);
    
    return new Response(JSON.stringify({ 
      success: false, error: String(error),
      processed: 0, updated: 0, failed: 0, remaining: 0, errors: [],
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
