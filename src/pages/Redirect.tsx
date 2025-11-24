import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Redirect = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"processing" | "ready" | "redirecting" | "error">("processing");
  const [debugInfo, setDebugInfo] = useState<{ 
    fullUrl: string; 
    fbclid: string | null;
    utmParams: Record<string, string>;
  }>({ fullUrl: "", fbclid: null, utmParams: {} });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [telegramUrl, setTelegramUrl] = useState("");

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        // Capture full URL immediately
        const fullUrl = window.location.href;
        console.log("Full URL captured:", fullUrl);

        // Method 1: React Router useSearchParams
        const fbclidFromRouter = searchParams.get("fbclid");
        console.log("fbclid from React Router:", fbclidFromRouter);

        // Method 2: Direct window.location parsing
        const urlParams = new URLSearchParams(window.location.search);
        const fbclidFromWindow = urlParams.get("fbclid");
        console.log("fbclid from window.location:", fbclidFromWindow);

        // Use whichever method found the parameter
        const fbclid = fbclidFromRouter || fbclidFromWindow;
        
        // Extract all UTM parameters
        const utmParams: Record<string, string> = {};
        const utmKeys = [
          'utm_source',
          'utm_medium', 
          'utm_campaign',
          'utm_content',
          'utm_term',
          'utm_adset_id',
          'utm_ad_id',
          'utm_campaign_id'
        ];
        
        utmKeys.forEach(key => {
          const value = searchParams.get(key) || urlParams.get(key);
          if (value) {
            utmParams[key] = value;
          }
        });

        // Get referrer
        const referrer = document.referrer || null;
        
        // Set debug info for display
        setDebugInfo({ fullUrl, fbclid, utmParams });

        console.log("Final fbclid value to save:", fbclid);
        console.log("UTM parameters:", utmParams);
        console.log("Referrer:", referrer);

        // Insert traffic data and generate token (id)
        console.log("Attempting to insert into database with fbclid and UTM params:", fbclid, utmParams);
        
        const insertData = {
          facebook_click_id: fbclid || null,
          utm_source: utmParams.utm_source || null,
          utm_medium: utmParams.utm_medium || null,
          utm_campaign: utmParams.utm_campaign || null,
          utm_content: utmParams.utm_content || null,
          utm_term: utmParams.utm_term || null,
          utm_adset_id: utmParams.utm_adset_id || null,
          utm_ad_id: utmParams.utm_ad_id || null,
          utm_campaign_id: utmParams.utm_campaign_id || null,
          referrer: referrer,
        };
        console.log("Insert data object:", insertData);

        const { data, error } = await supabase
          .from("telegram_leads")
          .insert(insertData)
          .select("id, facebook_click_id")
          .single();

        console.log("Supabase response:", { data, error });

        if (error) {
          console.error("Error saving traffic data:", error);
          setStatus("error");
          return;
        }

        if (!data?.id) {
          console.error("No id returned from database");
          setStatus("error");
          return;
        }

        console.log("Traffic saved successfully:", { 
          id: data.id, 
          facebook_click_id: data.facebook_click_id 
        });
        setStatus("ready");

        // Prepare Telegram URL
        const botUsername = "ClientinfoHarvestBot";
        const url = `https://t.me/${botUsername}?start=${data.id}`;
        setTelegramUrl(url);
        
        // Show confirmation dialog
        setShowConfirmDialog(true);

      } catch (err) {
        console.error("Unexpected error:", err);
        setStatus("error");
      }
    };

    handleRedirect();
  }, [searchParams]);

  const handleConfirmRedirect = () => {
    setShowConfirmDialog(false);
    setStatus("redirecting");
    setTimeout(() => {
      window.location.href = telegramUrl;
    }, 500);
  };

  const handleCancelRedirect = () => {
    setShowConfirmDialog(false);
    setStatus("error");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center p-8 max-w-2xl w-full">
        {/* Debug Info Display */}
        <div className="mb-8 p-4 bg-muted rounded-lg text-left text-sm">
          <p className="font-semibold mb-2 text-foreground">Debug Information:</p>
          <p className="text-muted-foreground break-all">
            <strong>Full URL:</strong> {debugInfo.fullUrl || "Loading..."}
          </p>
          <p className="text-muted-foreground">
            <strong>Detected fbclid:</strong> {debugInfo.fbclid || "(none)"}
          </p>
          {Object.keys(debugInfo.utmParams).length > 0 && (
            <div className="mt-2">
              <p className="font-semibold text-foreground">UTM Parameters:</p>
              {Object.entries(debugInfo.utmParams).map(([key, value]) => (
                <p key={key} className="text-muted-foreground ml-2">
                  <strong>{key}:</strong> {value}
                </p>
              ))}
            </div>
          )}
        </div>

        {status === "processing" && (
          <>
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg text-foreground">Processing your request...</p>
          </>
        )}
        
        {status === "ready" && (
          <>
            <div className="w-16 h-16 border-4 border-primary rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg text-foreground">Ready to redirect. Please confirm...</p>
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

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Redirect</AlertDialogTitle>
            <AlertDialogDescription>
              Please confirm the tracking information before redirecting to Telegram:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-4 p-4 bg-muted rounded-md text-left space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Full URL:</p>
              <p className="text-xs text-muted-foreground break-all font-mono">
                {debugInfo.fullUrl || "Loading..."}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Facebook Click ID:</p>
              <p className="text-sm text-muted-foreground font-mono">
                {debugInfo.fbclid || "(none)"}
              </p>
            </div>
            {Object.keys(debugInfo.utmParams).length > 0 && (
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">UTM Parameters:</p>
                <div className="space-y-1 ml-2">
                  {Object.entries(debugInfo.utmParams).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-sm text-muted-foreground font-semibold min-w-[140px]">
                        {key}:
                      </span>
                      <span className="text-sm text-foreground font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Referrer:</p>
              <p className="text-xs text-muted-foreground break-all font-mono">
                {document.referrer || "(none)"}
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelRedirect}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRedirect}>
              Continue to Telegram
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Redirect;
