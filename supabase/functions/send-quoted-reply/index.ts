import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';
import { replyTargetError, replyWindowOpen } from '../_shared/replyRules.ts';

const schema = z.object({
  request_id: z.string().uuid(), customer_id: z.string().uuid(), reply_to_message_id: z.string().uuid(),
  kind: z.enum(['text', 'photo', 'voice']), text: z.string().max(4096).optional(),
  media_url: z.string().url().optional(), duration: z.number().int().min(0).max(3600).optional(),
}).strict();

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
  const { data: staff, error: staffError } = await db.from('user_roles').select('role,display_name').eq('user_id', auth.user.id).in('role', ['admin', 'moderator', 'user']).limit(1).maybeSingle();
  if (staffError || !staff) return respond({ error: 'Approved staff only' }, 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respond({ error: 'Invalid reply request' }, 400);
  const input = parsed.data;
  if (input.kind === 'text' ? !input.text?.trim() || !!input.media_url : !input.media_url || (input.text?.length ?? 0) > 1024) return respond({ error: 'Missing reply content or caption too long' }, 400);
  if (input.media_url) {
    const media = new URL(input.media_url);
    if (media.origin !== new URL(url).origin || !media.pathname.startsWith('/storage/v1/object/public/chat-attachments/') || media.search || media.hash) return respond({ error: 'Upload reply media to chat attachments first' }, 400);
  }
  const { data: customer } = await db.from('customer').select('id,page_id,telegram_id,messenger_id').eq('id', input.customer_id).maybeSingle();
  const { data: target } = await db.from('messages').select('id,customer_id,platform,sender_type,telegram_message_id,messenger_mid,media_group_id,message_text,message_type').eq('id', input.reply_to_message_id).maybeSingle();
  if (!customer || !target) return respond({ error: 'Reply target unavailable' }, 404);
  const platform = target.platform;
  const targetError = replyTargetError(target, customer, platform);
  if (targetError) return respond({ error: targetError }, 400);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ ...input, request_id: undefined })));
  const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  const { data: existing, error: readError } = await db.from('outgoing_reply_requests').select('*').eq('id', input.request_id).maybeSingle();
  if (readError) return respond({ error: 'Reply tracking unavailable' }, 503);
  if (existing) {
    if (existing.user_id !== auth.user.id || existing.payload_hash !== hash) return respond({ error: 'Reply request does not match the original draft' }, 409);
    if (existing.status === 'confirmed') {
      const { data: message } = existing.result_message_id ? await db.from('messages').select('*').eq('id', existing.result_message_id).maybeSingle() : { data: null };
      return respond({ success: true, message, provider_message_id: existing.provider_message_id });
    }
    if (existing.status !== 'failed') return respond({ error: 'Delivery is awaiting confirmation. Check the receiving chat before sending again.', uncertain: true }, 409);
  }
  const { data: last } = await db.from('messages').select('timestamp').eq('customer_id', customer.id).eq('platform', platform).eq('sender_type', 'customer').order('timestamp', { ascending: false }).limit(1).maybeSingle();
  if (!replyWindowOpen(platform, last?.timestamp ?? null)) return respond({ error: 'Messenger’s 24-hour reply window has expired' }, 403);
  let endpoint: string;
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let body: string | FormData;
  const providerTarget = platform === 'telegram' ? String(target.telegram_message_id) : target.messenger_mid;
  if (platform === 'telegram') {
    const bot = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!bot || !customer.telegram_id) return respond({ error: 'Telegram conversation unavailable' }, 503);
    endpoint = `https://api.telegram.org/bot${bot}/${input.kind === 'text' ? 'sendMessage' : input.kind === 'photo' ? 'sendPhoto' : 'sendVoice'}`;
    const reply_parameters = { message_id: target.telegram_message_id, allow_sending_without_reply: false };
    if (input.kind === 'voice') {
      try {
        const media = await fetch(input.media_url ?? '', { redirect: 'error' });
        if (!media.ok) return respond({ error: 'Voice recording unavailable' }, 400);
        const blob = await media.blob();
        if (!blob.size || blob.size > 20 * 1024 * 1024) return respond({ error: 'Invalid voice recording size' }, 400);
        body = new FormData();
        body.append('chat_id', String(customer.telegram_id));
        body.append('reply_parameters', JSON.stringify(reply_parameters));
        body.append('voice', blob, 'voice.mp3');
        if (input.text) body.append('caption', input.text);
        headers = {};
      } catch { return respond({ error: 'Voice recording unavailable' }, 400); }
    } else body = JSON.stringify({ chat_id: customer.telegram_id, reply_parameters, ...(input.kind === 'text' ? { text: input.text } : { photo: input.media_url, caption: input.text }) });
  } else {
    const { data: page } = await db.from('facebook_pages').select('access_token').eq('page_id', customer.page_id).eq('is_active', true).maybeSingle();
    if (!page?.access_token || !customer.messenger_id) return respond({ error: 'Messenger page unavailable' }, 503);
    endpoint = `https://graph.facebook.com/v18.0/${customer.page_id}/messages`;
    headers.Authorization = `Bearer ${page.access_token}`;
    // Keep the native attachment quote in one provider request; Messenger has no attachment captions.
    if (input.kind !== 'text' && input.text?.trim()) return respond({ error: 'Messenger photo replies cannot include a caption. Send the caption as a text reply separately.' }, 400);
    body = JSON.stringify({ recipient: { id: customer.messenger_id }, messaging_type: 'RESPONSE', message: {
      reply_to: { mid: target.messenger_mid }, ...(input.kind === 'text' ? { text: input.text } : { attachment: { type: input.kind === 'photo' ? 'image' : 'audio', payload: { url: input.media_url, is_reusable: false } } }),
    } });
  }
  if (existing) {
    const { data: claimed, error } = await db.from('outgoing_reply_requests').update({ status: 'pending' }).eq('id', input.request_id).eq('status', 'failed').select('id').maybeSingle();
    if (error || !claimed) return respond({ error: 'This reply is already being sent' }, 409);
  } else {
    const { error } = await db.from('outgoing_reply_requests').insert({ id: input.request_id, user_id: auth.user.id, customer_id: customer.id, target_message_id: target.id, payload_hash: hash });
    if (error) return respond({ error: 'This reply is already being sent' }, 409);
  }
  try {
    const response = await fetch(endpoint, { method: 'POST', headers, body });
    const result = await response.json();
    if (!response.ok || result.ok === false || result.error) {
      await db.from('outgoing_reply_requests').update({ status: 'failed' }).eq('id', input.request_id);
      return respond({ error: result.description || result.error?.message || 'Provider rejected the reply' }, 400);
    }
    const providerId = platform === 'telegram' ? result.result?.message_id : result.message_id;
    if (!providerId) throw new Error('Provider message ID missing');
    const row = {
      id: crypto.randomUUID(), customer_id: customer.id, platform, sender_type: 'employee',
      sent_by_name: staff.display_name || auth.user.email?.split('@')[0] || 'Team', is_read: true,
      message_type: input.kind, message_text: input.text || (input.kind === 'photo' ? '[Photo]' : '[Voice message]'),
      telegram_id: platform === 'telegram' ? customer.telegram_id : null,
      telegram_message_id: platform === 'telegram' ? providerId : null,
      messenger_mid: platform === 'messenger' ? providerId : null,
      photo_url: input.kind === 'photo' ? input.media_url : null,
      voice_url: input.kind === 'voice' ? input.media_url : null,
      voice_duration: input.kind === 'voice' ? (result.result?.voice?.duration ?? input.duration ?? null) : null,
      reply_to_message_id: target.id, reply_to_provider_id: providerTarget,
      reply_snapshot: { sender: 'Customer', text: target.message_text?.slice(0, 160) || target.message_type, media_type: target.message_type },
      timestamp: new Date().toISOString(),
    };
    const { data: message, error: saveError } = await db.from('messages').insert(row).select('*').single();
    const { error: trackError } = await db.from('outgoing_reply_requests').update({ status: 'confirmed', provider_message_id: String(providerId), result_message_id: message?.id ?? null }).eq('id', input.request_id);
    return respond({ success: true, message, provider_message_id: String(providerId), warning: saveError || trackError ? 'Reply delivered, but the app record could not be confirmed. Do not resend.' : undefined });
  } catch {
    await db.from('outgoing_reply_requests').update({ status: 'uncertain' }).eq('id', input.request_id);
    return respond({ error: 'Delivery confirmation was interrupted. Check the receiving chat; this request will not be resent automatically.', uncertain: true }, 502);
  }
});