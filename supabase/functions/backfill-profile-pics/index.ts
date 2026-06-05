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

// System User Token: DB (bot_settings) first, env var fallback.
async function getSystemUserToken(): Promise<{ token: string | null; source: 'db' | 'env' | null }> {
  try {
    const { data } = await supabase
      .from('bot_settings')
      .select('value')
      .eq('key', 'facebook_system_user_token')
      .maybeSingle();
    const v = (data?.value || '').trim();
    if (v) return { token: v, source: 'db' };
  } catch (e) {
    console.error('getSystemUserToken: bot_settings lookup failed', e);
  }
  const envTok = (Deno.env.get('FACEBOOK_SYSTEM_USER_TOKEN') || '').trim();
  if (envTok) return { token: envTok, source: 'env' };
  return { token: null, source: null };
}

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
    const { token: bulkSystemToken, source: bulkTokenSource } = await getSystemUserToken();
    console.log(`[bulk] system user token source=${bulkTokenSource} length=${bulkSystemToken?.length || 0}`);

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
          if (bulkSystemToken) {
            profile = await fetchMessengerProfile(customer.messenger_id, bulkSystemToken);
            if (profile) {
              console.log(`Found profile for ${customer.id} via system_user_token(${bulkTokenSource}): ${profile.first_name} ${profile.last_name || ''}`);
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

// Try a single Graph PSID lookup with the given token. Returns { ok, graph, status, maskedUrl, tokenMeta }.
async function tryGraphLookup(psid: string, token: string, tokenSource: string) {
  const url = `https://graph.facebook.com/v19.0/${psid}?fields=name,first_name,profile_pic&access_token=${token}`;
  const maskedUrl = url.replace(token, `${token.slice(0, 8)}…${token.slice(-4)}`);
  const tokenMeta = {
    source: tokenSource,
    length: token.length,
    prefix: token.slice(0, 8),
    suffix: token.slice(-4),
  };
  console.log(`[refreshSingleCustomer] GET ${maskedUrl}`);
  const r = await fetch(url);
  const txt = await r.text();
  console.log(`[refreshSingleCustomer] via=${tokenSource} HTTP ${r.status} body=${txt}`);
  let graph: any;
  try { graph = JSON.parse(txt); } catch { graph = { error: { message: `Non-JSON: ${txt}` } }; }
  const ok = r.ok && !graph?.error;
  return { ok, graph, status: r.status, maskedUrl, tokenMeta };
}

// Single-customer refresh: page token first (using customer.page_id), then System User token,
// then sweep across all active pages as last resort.
async function refreshSingleCustomer(customerId: string): Promise<any> {
  const { data: customer, error } = await supabase
    .from('customer')
    .select('id, messenger_id, messenger_name, page_id')
    .eq('id', customerId)
    .maybeSingle();

  if (error) return { success: false, error: `DB error: ${error.message}` };
  if (!customer) return { success: false, error: 'Customer not found' };
  if (!customer.messenger_id) return { success: false, error: 'Customer has no messenger_id' };

  console.log(`[refreshSingleCustomer] customer=${customerId} psid=${customer.messenger_id} page_id=${customer.page_id || '(none)'}`);

  const attempts: Array<{ via: string; status: number; error?: string }> = [];
  let successResult: { graph: any; maskedUrl: string; tokenMeta: any; tokenUsed: string; resolvedPageId: string | null } | null = null;

  // Load all active pages once (also used as fallback sweep)
  const activePages = await getActivePageTokens();

  // 1. Primary: page token matching customer.page_id
  if (customer.page_id) {
    const pageRow = activePages.find(p => p.page_id === customer.page_id);
    if (pageRow?.access_token) {
      const r = await tryGraphLookup(customer.messenger_id, pageRow.access_token, `page_token:${customer.page_id}`);
      attempts.push({ via: `page_token:${customer.page_id}`, status: r.status, error: r.graph?.error?.message });
      if (r.ok) {
        successResult = { graph: r.graph, maskedUrl: r.maskedUrl, tokenMeta: r.tokenMeta, tokenUsed: 'page_token', resolvedPageId: customer.page_id };
      }
    } else {
      attempts.push({ via: `page_token:${customer.page_id}`, status: 0, error: 'No active page row / token for customer.page_id' });
    }
  }

  // 2. Fallback: System User Token
  if (!successResult) {
    const { token: sysToken, source: sysSource } = await getSystemUserToken();
    if (sysToken) {
      const r = await tryGraphLookup(customer.messenger_id, sysToken, `system_user_token:${sysSource}`);
      attempts.push({ via: `system_user_token:${sysSource}`, status: r.status, error: r.graph?.error?.message });
      if (r.ok) {
        successResult = { graph: r.graph, maskedUrl: r.maskedUrl, tokenMeta: r.tokenMeta, tokenUsed: 'system_user_token', resolvedPageId: customer.page_id };
      }
    } else {
      attempts.push({ via: 'system_user_token', status: 0, error: 'Not configured' });
    }
  }

  // 3. Last resort: sweep every other active page token (heals mis-tagged page_id)
  if (!successResult) {
    for (const p of activePages) {
      if (!p.access_token) continue;
      if (customer.page_id && p.page_id === customer.page_id) continue; // already tried
      const r = await tryGraphLookup(customer.messenger_id, p.access_token, `page_sweep:${p.page_id}`);
      attempts.push({ via: `page_sweep:${p.page_id}`, status: r.status, error: r.graph?.error?.message });
      if (r.ok) {
        successResult = { graph: r.graph, maskedUrl: r.maskedUrl, tokenMeta: r.tokenMeta, tokenUsed: 'page_sweep', resolvedPageId: p.page_id };
        break;
      }
    }
  }

  if (!successResult) {
    const lastErr = attempts[attempts.length - 1];
    return {
      success: false,
      customer_id: customerId,
      error: lastErr?.error || 'All token attempts failed',
      status: lastErr?.status || 400,
      attempts,
    };
  }

  const graph = successResult.graph;

  // Normalize name
  let firstName: string = graph.first_name || '';
  let lastName = '';
  if (!firstName && graph.name) {
    const parts = String(graph.name).trim().split(/\s+/);
    firstName = parts.shift() || '';
    lastName = parts.join(' ');
  } else if (graph.name && firstName) {
    const rest = String(graph.name).trim().replace(new RegExp(`^${firstName}\\s*`), '');
    lastName = rest;
  }

  const fullName = `${firstName}${lastName ? ' ' + lastName : ''}`.trim() || graph.name || customer.messenger_name || '';

  let photoUrl: string | null = null;
  if (graph.profile_pic) {
    photoUrl = await downloadAndStorePhoto(graph.profile_pic, customer.id);
  }

  const updateData: any = {
    messenger_name: fullName,
    updated_at: new Date().toISOString(),
  };
  if (photoUrl) updateData.messenger_profile_pic = photoUrl;
  // Auto-heal page_id if sweep resolved it
  if (!customer.page_id && successResult.resolvedPageId) {
    updateData.page_id = successResult.resolvedPageId;
  }

  const { error: updErr } = await supabase.from('customer').update(updateData).eq('id', customer.id);
  if (updErr) return { success: false, error: `DB update failed: ${updErr.message}`, graph };

  return {
    success: true,
    customer_id: customerId,
    updated: true,
    name: fullName,
    profile_pic: photoUrl,
    token_used: successResult.tokenUsed,
    resolved_page_id: successResult.resolvedPageId,
    attempts,
    graph,
    request: { url: successResult.maskedUrl, token: successResult.tokenMeta },
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
