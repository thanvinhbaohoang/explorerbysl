import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Telegram = () => {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [capturedData, setCapturedData] = useState<any>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  useEffect(() => {
    const captureAndRedirect = async () => {
      try {
        // Capture all URL parameters
        const productRef = searchParams.get("p"); // e.g., korean-visa-2
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

        const data = {
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
          messenger_ref: productRef, // Store the product reference
        };

        setCapturedData(data);

        // Save to Supabase telegram_leads table and get the ID
        const { data: insertedData, error } = await supabase
          .from("telegram_leads")
          .insert(data)
          .select('id')
          .single();

        if (error) {
          console.error("Error saving to telegram_leads:", error);
          toast.error("Failed to save tracking data");
        } else {
          console.log("Successfully saved to telegram_leads with id:", insertedData.id);
          setLeadId(insertedData.id);
          toast.success("Tracking data captured!");
        }

      } catch (error) {
        console.error("Error during capture:", error);
        toast.error("An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    captureAndRedirect();
  }, [searchParams]);

  const handleRedirect = () => {
    // Redirect to Telegram bot with the lead ID as the start parameter
    // This allows the bot to link the customer to the lead record
    const telegramUrl = leadId 
      ? `https://t.me/newshowcasebot?start=${leadId}`
      : "https://t.me/newshowcasebot";
    window.location.href = telegramUrl;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-4xl font-bold text-foreground">
          {isLoading ? "Processing..." : "Ready to Continue"}
        </h1>
        
        {!isLoading && (
          <>
            <p className="text-muted-foreground">
              Your tracking data has been captured. Click below to continue to Telegram.
            </p>

            <button
              onClick={handleRedirect}
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Continue to Telegram
            </button>

            {/* Debug Information */}
            {capturedData && (
              <div className="mt-8 p-4 bg-muted rounded-lg text-left">
                <h2 className="font-semibold mb-2 text-foreground">Captured Data:</h2>
                <pre className="text-xs text-muted-foreground overflow-auto">
                  {JSON.stringify(capturedData, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Telegram;
