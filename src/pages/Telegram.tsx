import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const BOT_USERNAME = "ClientInfoHarvestBot";

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

        // Save to Supabase and get the lead ID
        const { data: insertedData } = await supabase
          .from("telegram_leads")
          .insert({
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
          })
          .select('id')
          .single();

        // Redirect immediately with lead ID as start parameter
        const leadId = insertedData?.id;
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
