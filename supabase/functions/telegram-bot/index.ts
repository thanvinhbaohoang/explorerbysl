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
        
        // Fetch and store profile photo for new customer
        if (customerId) {
          const profilePhotoUrl = await getUserProfilePhoto(u.id, customerId);
          if (profilePhotoUrl) {
            await supabase
              .from('customer')
              .update({ messenger_profile_pic: profilePhotoUrl })
              .eq('id', customerId);
            console.log("Profile photo saved for new customer:", customerId);
          }
        }
      }
    }
  } catch (dbError) {
    console.error("Database error:", dbError);
  }

  // If token exists (lead UUID), link to telegram_leads with customer_id
  if (token && customerId) {
    try {
      // Check if token is a valid UUID (lead ID) or a messenger_ref
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
      
      if (isUuid) {
        // Token is a UUID - match by lead ID
        const { error: updateError } = await supabase
          .from('telegram_leads')
          .update({
            user_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', token);

        if (updateError) {
          console.error("Error updating telegram_leads by id:", updateError);
        } else {
          console.log("Successfully linked customer to telegram_leads by id:", token);
        }
      } else {
        // Token is a messenger_ref (e.g., "korean-visa-2") - match by messenger_ref
        // Find the most recent lead with this ref that doesn't have a user_id yet
        const { data: leadData, error: findError } = await supabase
          .from('telegram_leads')
          .select('id')
          .eq('messenger_ref', token)
          .is('user_id', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (findError) {
          console.error("Error finding telegram_lead by ref:", findError);
        } else if (leadData) {
          const { error: updateError } = await supabase
            .from('telegram_leads')
            .update({
              user_id: customerId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', leadData.id);

          if (updateError) {
            console.error("Error updating telegram_leads by ref:", updateError);
          } else {
            console.log("Successfully linked customer to telegram_leads by messenger_ref:", token);
          }
        } else {
          console.log("No unlinked telegram_lead found with messenger_ref:", token);
        }
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

  // Format bilingual Khmer/English welcome message
  const msg = `ក្រុមហ៊ុនទេសចរណ៍ អុិចផ្លរឺ

Explorer by SL

កញ្ចប់ធួរ | Tour Packages
សំបុត្រយន្តហោះ | Flight Booking
កក់សណ្ឋាគារ | Hotel Reservation
ធ្វើវីសាគ្រប់ប្រទេស | Visa Abroad
លិខិតឆ្លងដែន | Passport
ជួលខុនដូគ្រប់ប្រទេស | Condo Rental
អ្នកបកប្រែនិងនាំដើរលេង | Guide Service`;

  // Send warm greeting (no inline buttons - conversation starts here)
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: msg,
    }),
  });
  
  // Log user data for internal tracking (not shown to customer)
  console.log("Customer started conversation:", {
    telegram_id: u.id,
    username: u.username,
    name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
    language: u.language_code,
    token: token,
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

// Get user's profile photo from Telegram and store permanently
async function getUserProfilePhoto(userId: number, customerId: string): Promise<string | null> {
  try {
    // Get user's profile photos
    const response = await fetch(`${TELEGRAM_API}/getUserProfilePhotos?user_id=${userId}&limit=1`);
    const data = await response.json();
    
    if (!data.ok || !data.result.photos || data.result.photos.length === 0) {
      console.log(`No profile photos found for user ${userId}`);
      return null;
    }
    
    // Get the largest size of the first photo (last in array is largest)
    const photoSizes = data.result.photos[0];
    const largest = photoSizes[photoSizes.length - 1];
    
    console.log(`Found profile photo for user ${userId}, downloading...`);
    
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
        upsert: true, // Overwrite if exists
      });
    
    if (uploadError) {
      console.error("Failed to upload profile photo to storage:", uploadError);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName);
    
    console.log("Profile photo stored permanently:", urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error("Error getting user profile photo:", error);
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

// Download document from Telegram and upload to Supabase Storage
async function downloadAndStoreDocument(fileId: string, fileName: string): Promise<string | null> {
  try {
    // Get file path from Telegram
    const response = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
    const data = await response.json();
    
    if (!data.ok || !data.result.file_path) {
      console.error("Failed to get document path from Telegram");
      return null;
    }
    
    const telegramFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
    
    // Download the file
    const fileResponse = await fetch(telegramFileUrl);
    if (!fileResponse.ok) {
      console.error("Failed to download document from Telegram");
      return null;
    }
    
    const fileBuffer = await fileResponse.arrayBuffer();
    
    // Get extension from original filename or file path
    const extension = fileName.split('.').pop() || data.result.file_path.split('.').pop() || 'bin';
    
    // Generate unique filename
    const storedFileName = `telegram-document/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
    
    // Determine content type from extension
    const contentTypeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
    };
    const contentType = contentTypeMap[extension.toLowerCase()] || 'application/octet-stream';
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(storedFileName, fileBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });
    
    if (uploadError) {
      console.error("Failed to upload document to storage:", uploadError);
      // Fallback to temporary Telegram URL
      return telegramFileUrl;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(storedFileName);
    
    console.log("Document stored permanently:", urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error("Error downloading and storing document:", error);
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
      
      // Capture media_group_id for album grouping (Telegram sends this for multi-photo/video albums)
      const mediaGroupId = message.media_group_id || null;
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
        
        console.log("Video captured and stored:", { videoFileId, videoUrl, duration: videoDuration, mediaGroupId });
        
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
            media_group_id: mediaGroupId,
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
        
        console.log("Video note captured and stored:", { videoFileId, videoUrl, duration: videoDuration, mediaGroupId });
        
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
            media_group_id: mediaGroupId,
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
        const docFileId = message.document.file_id;
        const docFileName = message.document.file_name || 'document';
        const docMimeType = message.document.mime_type || 'application/octet-stream';
        
        // Download and store the document
        const docUrl = await downloadAndStoreDocument(docFileId, docFileName);
        messageText = message.caption || `[Document: ${docFileName}]`;
        
        console.log("Document captured and stored:", { docFileId, docUrl, fileName: docFileName, mimeType: docMimeType });
        
        // Save with document fields
        const { error } = await supabase
          .from('messages')
          .insert({
            customer_id: customer.id,
            telegram_id: message.from.id,
            message_text: messageText,
            message_type: messageType,
            document_url: docUrl,
            document_name: docFileName,
            document_mime_type: docMimeType,
            sender_type: 'customer',
            timestamp: new Date(message.date * 1000).toISOString(),
          });

        if (error) {
          console.error("Error saving document message:", error);
        } else {
          console.log("Document message saved successfully");
        }
        return; // Early return for document messages
      }

      // Save the message (for photos and text)
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
          media_group_id: mediaGroupId,
          sender_type: 'customer',
          timestamp: new Date(message.date * 1000).toISOString(),
        });

      if (error) {
        console.error("Error saving message:", error);
      } else {
        console.log("Message saved successfully:", { messageType, photoUrl, messageText, mediaGroupId });
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

// Send media group (album) to Telegram
async function sendMediaGroup(chatId: number, media: Array<{
  type: 'photo' | 'video',
  media: string,
  caption?: string
}>) {
  // Telegram's sendMediaGroup allows up to 10 items
  const limitedMedia = media.slice(0, 10);
  
  // Only first item should have caption
  const formattedMedia = limitedMedia.map((item, index) => ({
    type: item.type,
    media: item.media,
    caption: index === 0 ? item.caption : undefined,
  }));

  const response = await fetch(`${TELEGRAM_API}/sendMediaGroup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      media: formattedMedia,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Telegram API error (sendMediaGroup):", error);
    throw new Error(`Failed to send media group: ${error}`);
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

// Send voice message to Telegram (voice note bubble)
// Downloads the file and uploads as form-data for better format handling
async function sendVoice(chatId: number, voiceUrl: string, caption?: string) {
  try {
    // Download the audio file first
    console.log("Downloading voice file from:", voiceUrl);
    const fileResponse = await fetch(voiceUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download voice file: ${fileResponse.status}`);
    }
    
    const fileBlob = await fileResponse.blob();
    console.log("Downloaded voice file, size:", fileBlob.size, "type:", fileBlob.type);
    
    // Create form data with the file
    const formData = new FormData();
    formData.append("chat_id", chatId.toString());
    // Send as .ogg file to hint Telegram to treat it as voice
    formData.append("voice", fileBlob, "voice.ogg");
    if (caption) {
      formData.append("caption", caption);
    }
    
    const response = await fetch(`${TELEGRAM_API}/sendVoice`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Telegram API error (sendVoice):", error);
      // Fall back to sendAudio if voice format not supported
      console.log("Falling back to sendAudio...");
      return await sendAudioWithFile(chatId, fileBlob, caption);
    }

    return await response.json();
  } catch (error) {
    console.error("Error in sendVoice:", error);
    throw error;
  }
}

// Send audio file to Telegram using form-data (fallback)
async function sendAudioWithFile(chatId: number, fileBlob: Blob, caption?: string) {
  const formData = new FormData();
  formData.append("chat_id", chatId.toString());
  formData.append("audio", fileBlob, "audio.mp3");
  if (caption) {
    formData.append("caption", caption);
  }
  
  const response = await fetch(`${TELEGRAM_API}/sendAudio`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Telegram API error (sendAudio):", error);
    throw new Error(`Failed to send audio: ${error}`);
  }

  return await response.json();
}

// Send chat action (typing indicator) to show staff is viewing
async function sendChatAction(chatId: number, action: string) {
  const response = await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      action: action,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Telegram API error (sendChatAction):", error);
  }
  
  return response.ok;
}

// Send audio file to Telegram (audio file, not voice bubble)
async function sendAudio(chatId: number, audioUrl: string, caption?: string) {
  const response = await fetch(`${TELEGRAM_API}/sendAudio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      audio: audioUrl,
      caption: caption,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Telegram API error (sendAudio):", error);
    throw new Error(`Failed to send audio: ${error}`);
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
      
      // Handle mark_seen action (send typing indicator to show staff is viewing)
      if (body.action === "mark_seen") {
        const { telegram_id } = body;
        
        if (!telegram_id) {
          return new Response(
            JSON.stringify({ error: "Missing telegram_id" }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 400,
            }
          );
        }

        try {
          // Send "typing" action to show customer that staff is viewing
          await sendChatAction(telegram_id, 'typing');
          
          return new Response(
            JSON.stringify({ success: true }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        } catch (error: any) {
          console.error("Error sending chat action:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500,
            }
          );
        }
      }
      
      // Check if this is a send message request from frontend
      if (body.action === "send_message") {
        const { telegram_id, customer_id, message_text, sent_by_name } = body;
        
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
          
          // Save message to database
          const { error: dbError } = await supabase
            .from('messages')
            .insert({
              customer_id,
              telegram_id,
              message_text,
              message_type: 'text',
              sender_type: 'employee',
              sent_by_name: sent_by_name || null,
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
        const { telegram_id, customer_id, media_url, media_type, caption, sent_by_name } = body;
        
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
          } else if (media_type === 'voice' || media_type === 'audio') {
            await sendVoice(telegram_id, media_url, caption);
            messageType = 'voice';
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
            sent_by_name: sent_by_name || null,
            timestamp: new Date().toISOString(),
          };
          
          if (media_type === 'photo') {
            insertData.photo_url = media_url;
          } else if (media_type === 'video') {
            insertData.video_url = media_url;
          } else if (media_type === 'voice' || media_type === 'audio') {
            insertData.voice_url = media_url;
          } else if (media_type === 'document') {
            insertData.document_url = media_url;
            // Extract filename from URL or use default
            const urlParts = media_url.split('/');
            const fileName = urlParts[urlParts.length - 1] || 'document';
            insertData.document_name = body.document_name || fileName;
            insertData.document_mime_type = body.document_mime_type || 'application/octet-stream';
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

      // Handle send_media_group action from frontend (album)
      if (body.action === "send_media_group") {
        const { telegram_id, customer_id, media_items, caption, sent_by_name, media_group_id } = body;
        
        if (!telegram_id || !media_items || !Array.isArray(media_items) || media_items.length === 0) {
          return new Response(
            JSON.stringify({ error: "Missing required fields for media group" }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 400,
            }
          );
        }

        try {
          console.log("Sending media group to:", telegram_id, "Items:", media_items.length);
          
          // Build media array for Telegram API
          const mediaForTelegram = media_items.map((item: any, index: number) => ({
            type: item.type as 'photo' | 'video',
            media: item.url,
            caption: index === 0 ? caption : undefined,
          }));
          
          // Send media group to Telegram
          await sendMediaGroup(telegram_id, mediaForTelegram);
          
          // Save each media item as a separate message in DB with shared media_group_id
          for (let i = 0; i < media_items.length; i++) {
            const item = media_items[i];
            const insertData: any = {
              customer_id,
              telegram_id,
              message_text: i === 0 && caption ? caption : `[${item.type.charAt(0).toUpperCase() + item.type.slice(1)}]`,
              message_type: item.type,
              sender_type: 'employee',
              sent_by_name: sent_by_name || null,
              timestamp: new Date().toISOString(),
              media_group_id: media_group_id,
            };
            
            if (item.type === 'photo') {
              insertData.photo_url = item.url;
            } else if (item.type === 'video') {
              insertData.video_url = item.url;
            }
            
            const { error: dbError } = await supabase
              .from('messages')
              .insert(insertData);

            if (dbError) {
              console.error("Error saving media group item:", dbError);
            }
          }

          console.log("Media group sent and saved successfully");
          
          return new Response(
            JSON.stringify({ success: true, media_group_id }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        } catch (error: any) {
          console.error("Error sending media group:", error);
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
