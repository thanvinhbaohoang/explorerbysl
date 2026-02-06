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

// Rate limiting delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get Telegram profile photo and store permanently
async function getTelegramProfilePhoto(telegramId: number, customerId: string): Promise<string | null> {
  try {
    if (!BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN not configured");
      return null;
    }

    // Get user's profile photos
    const response = await fetch(`${TELEGRAM_API}/getUserProfilePhotos?user_id=${telegramId}&limit=1`);
    const data = await response.json();
    
    if (!data.ok || !data.result.photos || data.result.photos.length === 0) {
      console.log(`No profile photos found for Telegram user ${telegramId}`);
      return null;
    }
    
    // Get the largest size of the first photo (last in array is largest)
    const photoSizes = data.result.photos[0];
    const largest = photoSizes[photoSizes.length - 1];
    
    // Get file path from Telegram
    const fileResponse = await fetch(`${TELEGRAM_API}/getFile?file_id=${largest.file_id}`);
    const fileData = await fileResponse.json();
    
    if (!fileData.ok || !fileData.result.file_path) {
      console.error("Failed to get profile photo file path from Telegram");
      return null;
    }
    
    const telegramFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
    
    // Download the file
    const downloadResponse = await fetch(telegramFileUrl);
    if (!downloadResponse.ok) {
      console.error("Failed to download profile photo from Telegram");
      return null;
    }
    
    const fileBuffer = await downloadResponse.arrayBuffer();
    
    // Store in profile-pics folder with customer ID as filename
    const fileName = `profile-pics/${customerId}.jpg`;
    
    // Upload to Supabase Storage (upsert to allow updates)
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, fileBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true,
      });
    
    if (uploadError) {
      console.error("Failed to upload profile photo to storage:", uploadError);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName);
    
    console.log(`Telegram profile photo stored for ${customerId}:`, urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error("Error getting Telegram profile photo:", error);
    return null;
  }
}

// Get Messenger profile photo and store permanently
async function getMessengerProfilePhoto(messengerId: string, pageId: string, customerId: string): Promise<string | null> {
  try {
    // Get page token from database
    const { data: pageData, error: pageError } = await supabase
      .from('facebook_pages')
      .select('access_token')
      .eq('page_id', pageId)
      .eq('is_active', true)
      .single();
    
    if (pageError || !pageData?.access_token) {
      console.error(`No token found for page ${pageId}`);
      return null;
    }
    
    // Fetch user profile from Facebook
    const url = `https://graph.facebook.com/v18.0/${messengerId}?fields=profile_pic&access_token=${pageData.access_token}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch Messenger profile:", errorText);
      return null;
    }
    
    const profile = await response.json();
    
    if (!profile.profile_pic) {
      console.log(`No profile pic found for Messenger user ${messengerId}`);
      return null;
    }
    
    // Download the profile pic
    const downloadResponse = await fetch(profile.profile_pic);
    if (!downloadResponse.ok) {
      console.error("Failed to download Messenger profile pic");
      return null;
    }
    
    const arrayBuffer = await downloadResponse.arrayBuffer();
    const fileName = `profile-pics/${customerId}.jpg`;
    
    // Upload to Supabase Storage (upsert to allow updates)
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true,
      });
    
    if (uploadError) {
      console.error("Failed to upload Messenger profile pic:", uploadError);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName);
    
    console.log(`Messenger profile photo stored for ${customerId}:`, urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error("Error getting Messenger profile photo:", error);
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
    // Count total customers missing profile pics
    const { count: totalMissing } = await supabase
      .from('customer')
      .select('*', { count: 'exact', head: true })
      .is('messenger_profile_pic', null);
    
    // Get customers missing profile pics
    const { data: customers, error: queryError } = await supabase
      .from('customer')
      .select('id, telegram_id, messenger_id, page_id')
      .is('messenger_profile_pic', null)
      .limit(limit);
    
    if (queryError) {
      throw new Error(`Failed to query customers: ${queryError.message}`);
    }
    
    if (!customers || customers.length === 0) {
      console.log("No customers found with missing profile pictures");
      return results;
    }
    
    console.log(`Processing ${customers.length} customers...`);
    
    for (const customer of customers) {
      // Add delay to respect rate limits (100ms between requests)
      await delay(100);
      
      try {
        let photoUrl: string | null = null;
        
        if (customer.telegram_id) {
          // Telegram customer
          photoUrl = await getTelegramProfilePhoto(customer.telegram_id, customer.id);
        } else if (customer.messenger_id && customer.page_id) {
          // Messenger customer
          photoUrl = await getMessengerProfilePhoto(customer.messenger_id, customer.page_id, customer.id);
        } else {
          console.log(`Customer ${customer.id} has neither telegram_id nor messenger_id/page_id`);
        }
        
        if (photoUrl) {
          const { error: updateError } = await supabase
            .from('customer')
            .update({ messenger_profile_pic: photoUrl })
            .eq('id', customer.id);
          
          if (updateError) {
            throw new Error(`Failed to update customer: ${updateError.message}`);
          }
          
          results.updated++;
          console.log(`Updated customer ${customer.id} with profile photo`);
        }
        
        results.processed++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          customerId: customer.id,
          error: String(error),
        });
        console.error(`Error processing customer ${customer.id}:`, error);
      }
    }
    
    // Calculate remaining
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Parse request body
    let limit = 50;
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.limit && typeof body.limit === 'number') {
          limit = Math.min(body.limit, 200); // Cap at 200 to avoid timeouts
        }
      } catch {
        // Use default limit if body parsing fails
      }
    }
    
    console.log(`Starting profile picture backfill with limit: ${limit}`);
    
    const results = await backfillProfilePics(limit);
    
    return new Response(
      JSON.stringify(results),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error("Error in backfill-profile-pics:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: String(error),
        processed: 0,
        updated: 0,
        failed: 0,
        remaining: 0,
        errors: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
