import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const HUMAN_ACCOUNT = "Haroldthan";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

if (!BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}

// Send message to Telegram
async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: any
) {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      reply_markup: replyMarkup,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Telegram API error:", error);
    throw new Error(`Failed to send message: ${error}`);
  }

  return await response.json();
}

// Escape special characters for Markdown V2
function escapeMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// Handle /start command
async function handleStart(message: any) {
  const u = message.from;
  const chatId = message.chat.id;

  // Gather user data
  const info = {
    ID: u.id,
    Username: u.username ? `@${u.username}` : "(none)",
    First_Name: u.first_name || "(none)",
    Last_Name: u.last_name || "(none)",
    Language: u.language_code || "(unknown)",
    Is_Premium: u.is_premium ? "Yes" : "No",
  };

  console.log("User started bot:", info);

  // Save customer to database
  try {
    const { data, error } = await supabase
      .from('customer')
      .upsert({
        telegram_id: u.id,
        username: u.username || null,
        first_name: u.first_name || null,
        last_name: u.last_name || null,
        language_code: u.language_code || null,
        is_premium: u.is_premium || false,
        first_message_at: new Date().toISOString(),
      }, {
        onConflict: 'telegram_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error("Error saving customer to database:", error);
    } else {
      console.log("Customer saved to database:", data);
    }
  } catch (dbError) {
    console.error("Database error:", dbError);
  }

  // Format message
  const msg = `
👋 Hi ${escapeMd(u.first_name || "there")}\\!

Here's the info we captured from your Telegram account:

🧾 *User Data*
• ID: \`${info.ID}\`
• Username: ${escapeMd(info.Username)}
• Name: ${escapeMd(info.First_Name)} ${escapeMd(info.Last_Name)}
• Language: ${escapeMd(info.Language)}
• Premium: ${escapeMd(info.Is_Premium)}

Please tap below to chat with our human support team 👇
`;

  // Send message with inline button (with MarkdownV2)
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: msg,
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💬 Chat with Human Support",
              url: `https://t.me/${HUMAN_ACCOUNT}`,
            },
          ],
        ],
      },
    }),
  });
}

// Get file URL from Telegram
async function getFileUrl(fileId: string): Promise<string | null> {
  try {
    const response = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
    const data = await response.json();
    
    if (data.ok && data.result.file_path) {
      return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
    }
    return null;
  } catch (error) {
    console.error("Error getting file URL:", error);
    return null;
  }
}

// Save message to database
async function saveMessage(message: any) {
  try {
    // First, ensure customer exists
    const { data: customer } = await supabase
      .from('customer')
      .select('id')
      .eq('telegram_id', message.from.id)
      .single();

    if (customer) {
      let messageType = 'text';
      let messageText = message.text || message.caption || null;
      let photoFileId = null;
      let photoUrl = null;
      let voiceFileId = null;
      let voiceDuration = null;

      // Handle photo messages
      if (message.photo && message.photo.length > 0) {
        messageType = 'photo';
        // Get the largest photo
        const largestPhoto = message.photo[message.photo.length - 1];
        photoFileId = largestPhoto.file_id;
        photoUrl = await getFileUrl(photoFileId);
        messageText = message.caption || '[Photo]';
        console.log("Photo captured:", { photoFileId, photoUrl, caption: message.caption });
      }

      // Handle voice messages
      if (message.voice) {
        messageType = 'voice';
        voiceFileId = message.voice.file_id;
        voiceDuration = message.voice.duration;
        const voiceUrl = await getFileUrl(voiceFileId);
        messageText = '[Voice message]';
        
        // Save with voice URL
        const { error } = await supabase
          .from('messages')
          .insert({
            customer_id: customer.id,
            telegram_id: message.from.id,
            message_text: messageText,
            message_type: messageType,
            photo_file_id: photoFileId,
            photo_url: photoUrl,
            voice_file_id: voiceFileId,
            voice_duration: voiceDuration,
            voice_url: voiceUrl,
            sender_type: 'customer',
            timestamp: new Date(message.date * 1000).toISOString(),
          });

        if (error) {
          console.error("Error saving voice message:", error);
        } else {
          console.log("Voice message saved successfully");
        }
        return; // Early return for voice messages
      }

      // Handle video messages
      if (message.video) {
        messageType = 'video';
        const videoFileId = message.video.file_id;
        const videoDuration = message.video.duration;
        const videoUrl = await getFileUrl(videoFileId);
        const videoMimeType = message.video.mime_type || 'video/mp4';
        messageText = message.caption || '[Video]';
        
        console.log("Video captured:", { videoFileId, videoUrl, duration: videoDuration });
        
        // Save with video URL
        const { error } = await supabase
          .from('messages')
          .insert({
            customer_id: customer.id,
            telegram_id: message.from.id,
            message_text: messageText,
            message_type: messageType,
            video_file_id: videoFileId,
            video_url: videoUrl,
            video_duration: videoDuration,
            video_mime_type: videoMimeType,
            sender_type: 'customer',
            timestamp: new Date(message.date * 1000).toISOString(),
          });

        if (error) {
          console.error("Error saving video message:", error);
        } else {
          console.log("Video message saved successfully");
        }
        return; // Early return for video messages
      }

      // Handle audio messages
      if (message.audio) {
        messageType = 'audio';
        messageText = '[Audio]';
      }

      // Handle document messages
      if (message.document) {
        messageType = 'document';
        messageText = message.caption || `[Document: ${message.document.file_name || 'file'}]`;
      }

      // Save the message
      const { error } = await supabase
        .from('messages')
        .insert({
          customer_id: customer.id,
          telegram_id: message.from.id,
          message_text: messageText,
          message_type: messageType,
          photo_file_id: photoFileId,
          photo_url: photoUrl,
          voice_file_id: voiceFileId,
          voice_duration: voiceDuration,
          voice_url: null, // Will be null for non-voice messages
          sender_type: 'customer',
          timestamp: new Date(message.date * 1000).toISOString(),
        });

      if (error) {
        console.error("Error saving message:", error);
      } else {
        console.log("Message saved successfully:", { messageType, photoUrl, messageText });
      }
    }
  } catch (error) {
    console.error("Error in saveMessage:", error);
  }
}

// Handle incoming webhook
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === "POST") {
      // Parse the body once
      const body = await req.json();
      
      // Check if this is a send message request from frontend
      if (body.action === "send_message") {
        const { telegram_id, customer_id, message_text } = body;
        
        if (!telegram_id || !message_text) {
          return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 400,
            }
          );
        }

        try {
          console.log("Sending message to:", telegram_id, "Text:", message_text);
          
          // Send message to Telegram user
          await sendMessage(telegram_id, message_text);
          
          // Save to database
          const { error: dbError } = await supabase
            .from('messages')
            .insert({
              customer_id,
              telegram_id,
              message_text,
              message_type: 'text',
              sender_type: 'employee',
              timestamp: new Date().toISOString(),
            });

          if (dbError) {
            console.error("Error saving employee message:", dbError);
            throw dbError;
          }

          console.log("Message sent and saved successfully");
          
          return new Response(
            JSON.stringify({ success: true }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        } catch (error: any) {
          console.error("Error sending message:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500,
            }
          );
        }
      }
      
      // Handle webhook updates from Telegram
      console.log("Received webhook:", JSON.stringify(body));

      // Handle /start command
      if (body.message?.text?.startsWith("/start")) {
        await handleStart(body.message);
      }
      
      // Save all messages to database
      if (body.message) {
        await saveMessage(body.message);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Handle GET requests (for health checks)
    const meResponse = await fetch(`${TELEGRAM_API}/getMe`);
    const meData = await meResponse.json();
    
    return new Response(
      JSON.stringify({
        status: "Telegram bot is running",
        bot_username: meData.result?.username,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
