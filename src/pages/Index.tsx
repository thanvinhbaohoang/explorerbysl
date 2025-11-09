import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
  language_code?: string;
}

interface LeadData {
  click_id: string;
  utm_campaign: string | null;
  utm_content: string | null;
  fbclid: string | null;
  device: string;
  timestamp: string;
  telegram_id: number | null;
  telegram_username: string | null;
  telegram_first_name: string | null;
  telegram_last_name: string | null;
  telegram_language: string | null;
  telegram_photo: string | null;
}

const Index = () => {
  const [clickId, setClickId] = useState<string>("");
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const BOT_USERNAME = "YourBotUsername"; // Replace with your actual bot username

  // Parse URL params and save initial click data
  useEffect(() => {
    const saveClickData = async () => {
      const params = new URLSearchParams(window.location.search);
      const utmCampaign = params.get("utm_campaign");
      const utmContent = params.get("utm_content");
      const fbclid = params.get("fbclid");
      const device = navigator.userAgent;

      try {
        const { data, error } = await supabase
          .from("telegram_leads")
          .insert([
            {
              utm_campaign: utmCampaign,
              utm_content: utmContent,
              fbclid: fbclid,
              device: device,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setClickId(data.click_id);
          setLeadData({
            click_id: data.click_id,
            utm_campaign: data.utm_campaign,
            utm_content: data.utm_content,
            fbclid: data.fbclid,
            device: data.device,
            timestamp: data.timestamp,
            telegram_id: data.telegram_id,
            telegram_username: data.telegram_username,
            telegram_first_name: data.telegram_first_name,
            telegram_last_name: data.telegram_last_name,
            telegram_language: data.telegram_language,
            telegram_photo: data.telegram_photo,
          });
        }
      } catch (error: any) {
        console.error("Error saving click data:", error);
        toast.error("Failed to track visit");
      } finally {
        setIsLoading(false);
      }
    };

    saveClickData();
  }, []);

  // Handle Telegram authentication callback
  useEffect(() => {
    // Define the global callback function for Telegram widget
    (window as any).onTelegramAuth = async (user: TelegramUser) => {
      console.log("Telegram auth received:", user);

      if (!clickId) {
        toast.error("No click ID found");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("telegram_leads")
          .update({
            telegram_id: user.id,
            telegram_username: user.username || null,
            telegram_first_name: user.first_name,
            telegram_last_name: user.last_name || null,
            telegram_language: user.language_code || null,
            telegram_photo: user.photo_url || null,
          })
          .eq("click_id", clickId)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setLeadData({
            click_id: data.click_id,
            utm_campaign: data.utm_campaign,
            utm_content: data.utm_content,
            fbclid: data.fbclid,
            device: data.device,
            timestamp: data.timestamp,
            telegram_id: data.telegram_id,
            telegram_username: data.telegram_username,
            telegram_first_name: data.telegram_first_name,
            telegram_last_name: data.telegram_last_name,
            telegram_language: data.telegram_language,
            telegram_photo: data.telegram_photo,
          });

          toast.success("Telegram verification successful!");

          // Redirect to Telegram bot after 3 seconds
          setTimeout(() => {
            window.location.href = `https://t.me/${BOT_USERNAME}?start=${clickId}`;
          }, 3000);
        }
      } catch (error: any) {
        console.error("Error updating Telegram data:", error);
        toast.error("Failed to save Telegram info");
      }
    };

    // Load Telegram widget script
    if (!isLoading && clickId) {
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.setAttribute("data-telegram-login", BOT_USERNAME);
      script.setAttribute("data-size", "large");
      script.setAttribute("data-onauth", "onTelegramAuth(user)");
      script.setAttribute("data-request-access", "write");
      script.async = true;

      const widgetContainer = document.getElementById("telegram-login-container");
      if (widgetContainer) {
        widgetContainer.appendChild(script);
      }
    }

    return () => {
      // Clean up
      delete (window as any).onTelegramAuth;
    };
  }, [clickId, isLoading]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md text-center">
        {/* Header */}
        <header className="mb-8">
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-foreground">
            Connect With Our Team on Telegram
          </h1>
          <h2 className="text-base font-normal text-muted-foreground">
            Please verify your Telegram account to continue.
          </h2>
        </header>

        {/* Telegram Login Widget */}
        <div className="mb-8 flex justify-center">
          <div
            id="telegram-login-container"
            className="inline-flex items-center justify-center"
          />
        </div>

        {/* MVP Data Display */}
        {leadData && (
          <div className="mb-8 rounded-none border border-border bg-background p-6 text-left shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Captured Data (MVP Test)
            </h3>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="font-medium text-muted-foreground">Click ID:</span>
                <span className="break-all text-foreground">{leadData.click_id}</span>
              </div>
              {leadData.utm_campaign && (
                <div className="grid grid-cols-2 gap-2">
                  <span className="font-medium text-muted-foreground">UTM Campaign:</span>
                  <span className="text-foreground">{leadData.utm_campaign}</span>
                </div>
              )}
              {leadData.utm_content && (
                <div className="grid grid-cols-2 gap-2">
                  <span className="font-medium text-muted-foreground">UTM Content:</span>
                  <span className="text-foreground">{leadData.utm_content}</span>
                </div>
              )}
              {leadData.fbclid && (
                <div className="grid grid-cols-2 gap-2">
                  <span className="font-medium text-muted-foreground">FB Click ID:</span>
                  <span className="break-all text-foreground">{leadData.fbclid}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <span className="font-medium text-muted-foreground">Device:</span>
                <span className="truncate text-foreground" title={leadData.device}>
                  {leadData.device}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="font-medium text-muted-foreground">Timestamp:</span>
                <span className="text-foreground">
                  {new Date(leadData.timestamp).toLocaleString()}
                </span>
              </div>
              {leadData.telegram_id && (
                <>
                  <div className="my-3 border-t border-border" />
                  <div className="grid grid-cols-2 gap-2">
                    <span className="font-medium text-muted-foreground">Telegram ID:</span>
                    <span className="text-foreground">{leadData.telegram_id}</span>
                  </div>
                  {leadData.telegram_username && (
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium text-muted-foreground">Username:</span>
                      <span className="text-foreground">@{leadData.telegram_username}</span>
                    </div>
                  )}
                  {leadData.telegram_first_name && (
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium text-muted-foreground">First Name:</span>
                      <span className="text-foreground">{leadData.telegram_first_name}</span>
                    </div>
                  )}
                  {leadData.telegram_last_name && (
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium text-muted-foreground">Last Name:</span>
                      <span className="text-foreground">{leadData.telegram_last_name}</span>
                    </div>
                  )}
                  <div className="mt-4 rounded-sm bg-muted p-3 text-center">
                    <p className="text-sm font-medium text-foreground">
                      Redirecting to Telegram bot in 3 seconds...
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-sm text-muted-foreground">
          By continuing, you agree to share your Telegram profile for faster support.
        </footer>
      </div>
    </div>
  );
};

export default Index;