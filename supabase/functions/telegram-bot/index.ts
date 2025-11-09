import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
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
