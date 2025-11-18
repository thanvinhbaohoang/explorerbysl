import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Redirect = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"processing" | "redirecting" | "error">("processing");

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        // Get parameters from URL
        const fbclid = searchParams.get("fbclid");
        const utmCampaign = searchParams.get("utm_campaign");
        const utmContent = searchParams.get("utm_content");

        // Get device information
        const device = /Mobile|Android|iPhone/i.test(navigator.userAgent) 
          ? "mobile" 
          : "desktop";

        console.log("Redirect params:", { fbclid, utmCampaign, utmContent, device });

        // Insert traffic data and generate click_id
        const { data, error } = await supabase
          .from("telegram_leads")
          .insert({
            fbclid: fbclid || null,
            utm_campaign: utmCampaign || null,
            utm_content: utmContent || null,
            device,
            timestamp: new Date().toISOString(),
          })
          .select("click_id")
          .single();

        if (error) {
          console.error("Error saving traffic data:", error);
          setStatus("error");
          return;
        }

        if (!data?.click_id) {
          console.error("No click_id returned");
          setStatus("error");
          return;
        }

        console.log("Traffic saved with click_id:", data.click_id);
        setStatus("redirecting");

        // Redirect to Telegram bot with the generated token
        const botUsername = "@ClientinfoHarvestBot"; // Your bot username
        const telegramUrl = `https://t.me/${botUsername}?start=${data.click_id}`;
        
        // Redirect after a brief delay to show status
        setTimeout(() => {
          window.location.href = telegramUrl;
        }, 1000);

      } catch (err) {
        console.error("Unexpected error:", err);
        setStatus("error");
      }
    };

    handleRedirect();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        {status === "processing" && (
          <>
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg text-foreground">Processing your request...</p>
          </>
        )}
        
        {status === "redirecting" && (
          <>
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg text-foreground">Redirecting to Telegram...</p>
          </>
        )}
        
        {status === "error" && (
          <>
            <div className="text-destructive mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-lg text-foreground">Something went wrong. Please try again.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Redirect;
