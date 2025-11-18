import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const HUMAN_ACCOUNT = "Haroldthan";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

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
      parse_mode: "MarkdownV2",
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

  // Send message with inline button
  await sendMessage(chatId, msg, {
    inline_keyboard: [
      [
        {
          text: "💬 Chat with Human Support",
          url: `https://t.me/${HUMAN_ACCOUNT}`,
        },
      ],
    ],
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
      }

      // Handle voice messages
      if (message.voice) {
        messageType = 'voice';
        voiceFileId = message.voice.file_id;
        voiceDuration = message.voice.duration;
        messageText = '[Voice message]';
      }

      // Handle video messages
      if (message.video) {
        messageType = 'video';
        messageText = message.caption || '[Video]';
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
          timestamp: new Date(message.date * 1000).toISOString(),
        });

      if (error) {
        console.error("Error saving message:", error);
      } else {
        console.log("Message saved successfully:", messageType);
      }
    }
  } catch (error) {
    console.error("Error in saveMessage:", error);
  }
}

// Handle incoming webhook
serve(async (req) => {
  try {
    if (req.method === "POST") {
      const update = await req.json();
      console.log("Received webhook:", JSON.stringify(update));

      // Handle /start command
      if (update.message?.text?.startsWith("/start")) {
        await handleStart(update.message);
      }
      
      // Save all messages to database
      if (update.message) {
        await saveMessage(update.message);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
