import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

const BOT_USERNAME = "ExplorerBySLBot";

const Telegram = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const captureAndRedirect = async () => {
      try {
        // Capture all URL parameters
        const productRef = searchParams.get("p");
        const fbclid = searchParams.get("fbclid");
        const utmSource = searchParams.get("utm_source");
        const utmMedium = searchParams.get("utm_medium");
        const utmCampaign = searchParams.get("utm_campaign");
        const utmContent = searchParams.get("utm_content");
        const utmTerm = searchParams.get("utm_term");
        const utmAdsetId = searchParams.get("utm_adset_id");
        const utmAdId = searchParams.get("utm_ad_id");
        const utmCampaignId = searchParams.get("utm_campaign_id");
        const referrer = document.referrer;

        // Call edge function to save traffic data (uses service role to bypass RLS)
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capture-traffic`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              facebook_click_id: fbclid,
              utm_source: utmSource,
              utm_medium: utmMedium,
              utm_campaign: utmCampaign,
              utm_content: utmContent,
              utm_term: utmTerm,
              utm_adset_id: utmAdsetId,
              utm_ad_id: utmAdId,
              utm_campaign_id: utmCampaignId,
              referrer: referrer || null,
              messenger_ref: productRef,
              platform: 'telegram',
            }),
          }
        );

        let leadId: string | undefined;
        if (response.ok) {
          const insertedData = await response.json();
          leadId = insertedData?.id;
        } else {
          console.error("Error saving lead:", await response.text());
        }

        // Redirect with lead UUID as start parameter so bot can link customer to lead
        const telegramUrl = leadId 
          ? `https://t.me/${BOT_USERNAME}?start=${leadId}`
          : `https://t.me/${BOT_USERNAME}`;
        
        window.location.href = telegramUrl;
      } catch (error) {
        console.error("Error during capture:", error);
        // Redirect anyway even if capture fails
        window.location.href = `https://t.me/${BOT_USERNAME}`;
      }
    };

    captureAndRedirect();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Connecting to Telegram...</p>
      </div>
    </div>
  );
};

export default Telegram;
