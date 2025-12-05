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

  // Extract token from /start command (e.g., /start TOKEN)
  const commandText = message.text || '';
  const token = commandText.split(' ')[1]; // Get the part after /start
  
  console.log("Start command token:", token);

  // Check if customer already exists, otherwise create new one
  let customerId = null;
  try {
    // First check if customer exists
    const { data: existingCustomer } = await supabase
      .from('customer')
      .select('id')
      .eq('telegram_id', u.id)
      .maybeSingle();

    if (existingCustomer) {
      // Customer exists - use existing ID
      customerId = existingCustomer.id;
      console.log("Existing customer found with id:", customerId);
      
      // Update customer info
      await supabase
        .from('customer')
        .update({
          username: u.username || null,
          first_name: u.first_name || null,
          last_name: u.last_name || null,
          language_code: u.language_code || null,
          is_premium: u.is_premium || false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);
    } else {
      // Customer doesn't exist - create new one
      const { data: newCustomer, error: insertError } = await supabase
        .from('customer')
        .insert({
          telegram_id: u.id,
          username: u.username || null,
          first_name: u.first_name || null,
          last_name: u.last_name || null,
          language_code: u.language_code || null,
          is_premium: u.is_premium || false,
          first_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        console.error("Error creating new customer:", insertError);
      } else {
        customerId = newCustomer?.id;
        console.log("New customer created with id:", customerId);
      }
    }
  } catch (dbError) {
    console.error("Database error:", dbError);
  }

  // If token exists, link to telegram_leads with customer_id
  if (token && customerId) {
    try {
      const { error: updateError } = await supabase
        .from('telegram_leads')
        .update({
          user_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', token);

      if (updateError) {
        console.error("Error updating telegram_leads:", updateError);
      } else {
        console.log("Successfully linked customer to telegram_leads token:", token);
      }
    } catch (linkError) {
      console.error("Error linking to telegram_leads:", linkError);
    }
  }

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

  // Format message
  const tokenInfo = token ? `\n🔗 *Tracking Token:* \`${escapeMd(token)}\`\n` : '';
  const msg = `
👋 Hi ${escapeMd(u.first_name || "there")}\\!
${tokenInfo}
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

// Download file from Telegram and upload to Supabase Storage
async function downloadAndStoreFile(fileId: string, fileType: 'photo' | 'voice' | 'video'): Promise<string | null> {
  try {
    // Get file path from Telegram
    const response = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
    const data = await response.json();
    
    if (!data.ok || !data.result.file_path) {
      console.error("Failed to get file path from Telegram");
      return null;
    }
    
    const telegramFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
    
    // Download the file
    const fileResponse = await fetch(telegramFileUrl);
    if (!fileResponse.ok) {
      console.error("Failed to download file from Telegram");
      return null;
    }
    
    const fileBuffer = await fileResponse.arrayBuffer();
    
    // Determine file extension from file_path
    const filePath = data.result.file_path;
    const extension = filePath.split('.').pop() || (fileType === 'photo' ? 'jpg' : fileType === 'voice' ? 'ogg' : 'mp4');
    
    // Generate unique filename
    const fileName = `telegram-${fileType}/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, fileBuffer, {
        contentType: fileType === 'photo' ? `image/${extension}` : fileType === 'voice' ? 'audio/ogg' : `video/${extension}`,
        cacheControl: '3600',
        upsert: false,
      });
    
    if (uploadError) {
      console.error("Failed to upload to storage:", uploadError);
      // Fallback to temporary Telegram URL
      return telegramFileUrl;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName);
    
    console.log("File stored permanently:", urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error("Error downloading and storing file:", error);
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
        // Download and store permanently instead of using temporary URL
        photoUrl = await downloadAndStoreFile(photoFileId, 'photo');
        messageText = message.caption || '[Photo]';
        console.log("Photo captured and stored:", { photoFileId, photoUrl, caption: message.caption });
      }

      // Handle voice messages
      if (message.voice) {
        messageType = 'voice';
        voiceFileId = message.voice.file_id;
        voiceDuration = message.voice.duration;
        // Download and store permanently
        const voiceUrl = await downloadAndStoreFile(voiceFileId, 'voice');
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

      // Handle video messages (regular videos)
      if (message.video) {
        messageType = 'video';
        const videoFileId = message.video.file_id;
        const videoDuration = message.video.duration;
        // Download and store permanently
        const videoUrl = await downloadAndStoreFile(videoFileId, 'video');
        const videoMimeType = message.video.mime_type || 'video/mp4';
        messageText = message.caption || '[Video]';
        
        console.log("Video captured and stored:", { videoFileId, videoUrl, duration: videoDuration });
        
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

      // Handle video note messages (circular videos)
      if (message.video_note) {
        messageType = 'video';
        const videoFileId = message.video_note.file_id;
        const videoDuration = message.video_note.duration;
        // Download and store permanently
        const videoUrl = await downloadAndStoreFile(videoFileId, 'video');
        messageText = '[Video Note]';
        
        console.log("Video note captured and stored:", { videoFileId, videoUrl, duration: videoDuration });
        
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
            video_mime_type: 'video/mp4',
            sender_type: 'customer',
            timestamp: new Date(message.date * 1000).toISOString(),
          });

        if (error) {
          console.error("Error saving video note:", error);
        } else {
          console.log("Video note saved successfully");
        }
        return; // Early return for video note messages
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

// Send photo to Telegram
async function sendPhoto(chatId: number, photoUrl: string, caption?: string) {
  const response = await fetch(`${TELEGRAM_API}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption: caption,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Telegram API error (sendPhoto):", error);
    throw new Error(`Failed to send photo: ${error}`);
  }

  return await response.json();
}

// Send video to Telegram
async function sendVideo(chatId: number, videoUrl: string, caption?: string) {
  const response = await fetch(`${TELEGRAM_API}/sendVideo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      video: videoUrl,
      caption: caption,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Telegram API error (sendVideo):", error);
    throw new Error(`Failed to send video: ${error}`);
  }

  return await response.json();
}

// Send document to Telegram
async function sendDocument(chatId: number, documentUrl: string, caption?: string) {
  const response = await fetch(`${TELEGRAM_API}/sendDocument`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      document: documentUrl,
      caption: caption,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Telegram API error (sendDocument):", error);
    throw new Error(`Failed to send document: ${error}`);
  }

  return await response.json();
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
      
      // Handle send_media action from frontend
      if (body.action === "send_media") {
        const { telegram_id, customer_id, media_url, media_type, caption } = body;
        
        if (!telegram_id || !media_url || !media_type) {
          return new Response(
            JSON.stringify({ error: "Missing required fields for media" }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 400,
            }
          );
        }

        try {
          console.log("Sending media to:", telegram_id, "Type:", media_type, "URL:", media_url);
          
          let messageType = media_type;
          
          // Send media based on type
          if (media_type === 'photo') {
            await sendPhoto(telegram_id, media_url, caption);
          } else if (media_type === 'video') {
            await sendVideo(telegram_id, media_url, caption);
          } else {
            await sendDocument(telegram_id, media_url, caption);
            messageType = 'document';
          }
          
          // Save to database
          const insertData: any = {
            customer_id,
            telegram_id,
            message_text: caption || `[${messageType.charAt(0).toUpperCase() + messageType.slice(1)}]`,
            message_type: messageType,
            sender_type: 'employee',
            timestamp: new Date().toISOString(),
          };
          
          if (media_type === 'photo') {
            insertData.photo_url = media_url;
          } else if (media_type === 'video') {
            insertData.video_url = media_url;
          }
          
          const { error: dbError } = await supabase
            .from('messages')
            .insert(insertData);

          if (dbError) {
            console.error("Error saving employee media message:", dbError);
            throw dbError;
          }

          console.log("Media sent and saved successfully");
          
          return new Response(
            JSON.stringify({ success: true }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        } catch (error: any) {
          console.error("Error sending media:", error);
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
