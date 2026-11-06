import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'https://esm.sh/zod@3.25.76';

// Per-platform allowlists. The platform is resolved from the stored target message, never
// from the request body, so a browser cannot pick which allowlist applies.
const TELEGRAM_ALLOWED = ['❤','👍','🙏'];
const MESSENGER_ALLOWED = ['❤','👍','😆','😮','😢','😠','🙏'];
const schema = z.object({ message_id: z.string().uuid(), emoji: z.string().max(8).nullable() }).strict();
Deno.serve(async req => {
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return respond({ ok: true });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return respond({ error: 'Service unavailable' }, 503);
  const db = createClient(url, key);
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return respond({ error: 'Sign in required' }, 401);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return respond({ error: 'Sign in required' }, 401);
  const { data: staff, error: staffError } = await db.from('user_roles').select('role').eq('user_id', auth.user.id).in('role', ['admin', 'user', 'moderator']).limit(1).maybeSingle();
  if (staffError || !staff) return respond({ error: 'Approved staff only' }, 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respond({ error: 'Invalid reaction request' }, 400);
  const { message_id, emoji } = parsed.data;
  const { data: message } = await db.from('messages').select('id,customer_id,platform,sender_type,telegram_message_id,messenger_mid,media_group_id').eq('id', message_id).maybeSingle();
  if (!message || message.sender_type !== 'customer' || message.media_group_id) return respond({ error: 'This message cannot receive a reaction' }, 400);
  const allowed = message.platform === 'telegram' ? TELEGRAM_ALLOWED : message.platform === 'messenger' ? MESSENGER_ALLOWED : [];
  if (emoji !== null && !allowed.includes(emoji)) return respond({ error: 'That reaction is not verified on this channel' }, 400);
  const { data: customer } = await db.from('customer').select('id,telegram_id,messenger_id,page_id').eq('id', message.customer_id).maybeSingle();
  if (!customer) return respond({ error: 'Conversation unavailable' }, 404);
  let endpoint: string;
  let payload: object;
  let providerHeaders: Record<string,string> = { 'Content-Type': 'application/json' };
  if (message.platform === 'telegram') {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken || !customer.telegram_id || !message.telegram_message_id) return respond({ error: 'This older Telegram message has no verified message ID. React to a new message instead.' }, 400);
    endpoint = `https://api.telegram.org/bot${botToken}/setMessageReaction`;
    payload = { chat_id: customer.telegram_id, message_id: message.telegram_message_id, reaction: emoji ? [{ type: 'emoji', emoji }] : [] };
  } else if (message.platform === 'messenger') {
    if (customer.page_id !== '109469038735899' || !customer.messenger_id || !message.messenger_mid || /-\d+$/.test(message.messenger_mid)) return respond({ error: 'Only heart reactions on Explorer by SL Messenger are verified at present' }, 400);
    const { data: last } = await db.from('messages').select('timestamp').eq('customer_id', customer.id).eq('sender_type', 'customer').order('timestamp', { ascending: false }).limit(1).maybeSingle();
    if (!last || Date.now() - new Date(last.timestamp).getTime() >= 86400000) return respond({ error: 'Messenger’s 24-hour reply window has expired' }, 403);
    const { data: page } = await db.from('facebook_pages').select('access_token').eq('page_id', customer.page_id).eq('is_active', true).maybeSingle();
    if (!page?.access_token) return respond({ error: 'Messenger page is unavailable' }, 503);
    endpoint = `https://graph.facebook.com/v18.0/${customer.page_id}/messages`;
    providerHeaders = { ...providerHeaders, Authorization: `Bearer ${page.access_token}` };
    payload = { recipient: { id: customer.messenger_id }, sender_action: 'react', payload: { message_id: message.messenger_mid, reaction: emoji } };
  } else return respond({ error: 'Unsupported channel' }, 400);
  const lease = crypto.randomUUID();
  const { data: claimed, error: claimError } = await db.rpc('claim_message_reaction', { p_message_id: message_id, p_customer_id: customer.id, p_lease_id: lease });
  if (claimError || !claimed) return respond({ error: 'A reaction is already being updated. Please try again shortly.' }, 409);
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: providerHeaders, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || result.ok === false || result.error) {
      await db.rpc('finish_message_reaction', { p_message_id: message_id, p_lease_id: lease, p_success: false, p_emoji: null, p_user_id: auth.user.id });
      return respond({ error: result.description || result.error?.message || 'Provider rejected the reaction' }, 400);
    }
    const { data: saved, error } = await db.rpc('finish_message_reaction', { p_message_id: message_id, p_lease_id: lease, p_success: true, p_emoji: emoji, p_user_id: auth.user.id });
    if (error || !saved) return respond({ error: 'The provider accepted the reaction, but its badge could not be saved. Check the receiving message before retrying.' }, 500);
    return respond({ success: true });
  } catch {
    // An ambiguous network result retains the lease to avoid immediate duplicate sends.
    return respond({ error: 'Reaction confirmation was interrupted. Check the receiving message before retrying in 90 seconds.' }, 502);
  }
});