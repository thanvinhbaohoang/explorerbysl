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

// Try fetching Messenger profile - prefers system user token, falls back to a page token.
const SYSTEM_USER_TOKEN = Deno.env.get("FACEBOOK_SYSTEM_USER_TOKEN");

async function fetchMessengerProfile(messengerId: string, token: string): Promise<any | null> {
  try {
    const url = `https://graph.facebook.com/v19.0/${messengerId}?fields=first_name,last_name,name,profile_pic,locale,timezone&access_token=${token}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const profile = await response.json();
    if (profile.error) return null;
    if (!profile.first_name && profile.name) {
      const parts = String(profile.name).trim().split(/\s+/);
      profile.first_name = parts.shift() || '';
      profile.last_name = parts.join(' ');
    }
    if (!profile.first_name && !profile.last_name) return null;
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
          let profileFound = false;
          let sourcePageId: string | null = customer.page_id || null;
          let profile: any = null;

          // 1. Try system user token first
          if (SYSTEM_USER_TOKEN) {
            profile = await fetchMessengerProfile(customer.messenger_id, SYSTEM_USER_TOKEN);
            if (profile) {
              console.log(`Found profile for ${customer.id} via system_user_token: ${profile.first_name} ${profile.last_name || ''}`);
            }
          }

          // 2. Fall back to per-page tokens
          if (!profile) {
            const pagesToTry = customer.page_id
              ? [{ page_id: customer.page_id, access_token: activePages.find(p => p.page_id === customer.page_id)?.access_token || '' }, ...activePages.filter(p => p.page_id !== customer.page_id)]
              : activePages;

            for (const page of pagesToTry) {
              if (!page.access_token) continue;
              const p = await fetchMessengerProfile(customer.messenger_id, page.access_token);
              if (p) {
                profile = p;
                sourcePageId = page.page_id;
                console.log(`Found profile for ${customer.id} via page ${page.page_id}: ${p.first_name} ${p.last_name || ''}`);
                break;
              }
              await delay(50);
            }
          }

          if (profile) {
            let photoUrl: string | null = null;
            if (profile.profile_pic) {
              photoUrl = await downloadAndStorePhoto(profile.profile_pic, customer.id);
            }

            const updateData: any = {
              messenger_name: `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`.trim(),
              updated_at: new Date().toISOString(),
            };
            if (photoUrl) updateData.messenger_profile_pic = photoUrl;
            if (!customer.page_id && sourcePageId) updateData.page_id = sourcePageId;
            if (profile.locale) updateData.locale = profile.locale;
            if (profile.timezone !== undefined) updateData.timezone_offset = profile.timezone;

            await supabase
              .from('customer')
              .update(updateData)
              .eq('id', customer.id);

            results.updated++;
            profileFound = true;
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

// Token diagnostic - returns stored-token shape + debug_token + visible pages + test PSID lookup
async function diagnoseSystemUserToken(testPsid?: string): Promise<any> {
  const tok = SYSTEM_USER_TOKEN || '';
  const trimmed = tok.trim();
  const storedShape = {
    present: !!tok,
    length: tok.length,
    trimmed_length: trimmed.length,
    differs_when_trimmed: tok !== trimmed,
    first8: tok.slice(0, 8),
    last8: tok.slice(-8),
    contains_whitespace: /\s/.test(tok),
    contains_newline: /[\r\n]/.test(tok),
    contains_quote: /["']/.test(tok),
  };

  if (!tok) return { stored: storedShape, error: 'FACEBOOK_SYSTEM_USER_TOKEN is not set' };

  const result: any = { stored: storedShape };

  // debug_token (use the same token as the access_token for self-debug)
  try {
    const debugUrl = `https://graph.facebook.com/v19.0/debug_token?input_token=${encodeURIComponent(trimmed)}&access_token=${encodeURIComponent(trimmed)}`;
    const r = await fetch(debugUrl);
    result.debug_token = await r.json();
  } catch (e) { result.debug_token = { error: String(e) }; }

  // /me
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(trimmed)}`);
    result.me = await r.json();
  } catch (e) { result.me = { error: String(e) }; }

  // visible pages
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,category&access_token=${encodeURIComponent(trimmed)}`);
    const j = await r.json();
    result.pages = j.data || j;
  } catch (e) { result.pages = { error: String(e) }; }

  // Test PSID lookup if provided
  if (testPsid) {
    try {
      const r = await fetch(`https://graph.facebook.com/v19.0/${testPsid}?fields=name,first_name,profile_pic&access_token=${encodeURIComponent(trimmed)}`);
      result.psid_test = { status: r.status, body: await r.json() };
    } catch (e) { result.psid_test = { error: String(e) }; }
  }

  return result;
}

// Single-customer refresh with verbose result (used by CustomerDetail "Refresh from Facebook" button)
async function refreshSingleCustomer(customerId: string, overrideToken?: string): Promise<any> {
  const { data: customer, error } = await supabase
    .from('customer')
    .select('id, messenger_id, messenger_name, page_id')
    .eq('id', customerId)
    .maybeSingle();

  if (error) return { success: false, error: `DB error: ${error.message}` };
  if (!customer) return { success: false, error: 'Customer not found' };
  if (!customer.messenger_id) return { success: false, error: 'Customer has no messenger_id' };

  const activePages = await getActivePageTokens();
  const attempts: Array<{ source: string; error?: string }> = [];
  let profile: any = null;
  let source: 'system_user_token' | 'page_token' | null = null;
  let sourcePageId: string | null = customer.page_id || null;

  const fetchRaw = async (token: string, label: string) => {
    const url = `https://graph.facebook.com/v19.0/${customer.messenger_id}?fields=first_name,last_name,name,profile_pic,locale,timezone&access_token=${token}`;
    const r = await fetch(url);
    const txt = await r.text();
    if (!r.ok) { attempts.push({ source: label, error: `HTTP ${r.status}: ${txt}` }); return null; }
    let p: any; try { p = JSON.parse(txt); } catch { attempts.push({ source: label, error: `Non-JSON: ${txt}` }); return null; }
    if (p?.error) { attempts.push({ source: label, error: p.error.message || JSON.stringify(p.error) }); return null; }
    if (!p.first_name && p.name) {
      const parts = String(p.name).trim().split(/\s+/);
      p.first_name = parts.shift() || ''; p.last_name = parts.join(' ');
    }
    if (!p.first_name && !p.last_name) { attempts.push({ source: label, error: 'Empty name fields' }); return null; }
    return p;
  };

  const effectiveSystemToken = (overrideToken || SYSTEM_USER_TOKEN || '').trim();
  if (effectiveSystemToken) {
    profile = await fetchRaw(effectiveSystemToken, overrideToken ? 'override_token' : 'system_user_token');
    if (profile) source = overrideToken ? 'system_user_token' : 'system_user_token';
  } else {
    attempts.push({ source: 'system_user_token', error: 'No token available' });
  }

  if (!profile) {
    const pagesToTry = customer.page_id
      ? [{ page_id: customer.page_id, access_token: activePages.find(p => p.page_id === customer.page_id)?.access_token || '' }, ...activePages.filter(p => p.page_id !== customer.page_id)]
      : activePages;
    for (const page of pagesToTry) {
      if (!page.access_token) continue;
      const p = await fetchRaw(page.access_token, `page_token(${page.page_id})`);
      if (p) { profile = p; source = 'page_token'; sourcePageId = page.page_id; break; }
    }
  }

  if (!profile) {
    return { success: false, customer_id: customerId, error: 'Facebook profile fetch failed', attempts };
  }

  let photoUrl: string | null = null;
  if (profile.profile_pic) {
    photoUrl = await downloadAndStorePhoto(profile.profile_pic, customer.id);
  }

  const updateData: any = {
    messenger_name: `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`.trim(),
    updated_at: new Date().toISOString(),
  };
  if (photoUrl) updateData.messenger_profile_pic = photoUrl;
  if (!customer.page_id && sourcePageId) updateData.page_id = sourcePageId;
  if (profile.locale) updateData.locale = profile.locale;
  if (profile.timezone !== undefined) updateData.timezone_offset = profile.timezone;

  const { error: updErr } = await supabase.from('customer').update(updateData).eq('id', customer.id);
  if (updErr) return { success: false, error: `DB update failed: ${updErr.message}`, attempts };

  return {
    success: true,
    customer_id: customerId,
    updated: true,
    name: updateData.messenger_name,
    profile_pic: photoUrl,
    source,
    attempts,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let limit = 50;
    let customerId: string | null = null;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (typeof body.customer_id === 'string') customerId = body.customer_id;
        if (body.limit && typeof body.limit === 'number') {
          limit = Math.min(body.limit, 200);
        }
      } catch { /* defaults */ }
    }

    if (customerId) {
      console.log(`Refreshing single customer: ${customerId}`);
      const result = await refreshSingleCustomer(customerId);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
