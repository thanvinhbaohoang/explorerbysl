import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Redirect = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"processing" | "redirecting" | "error">("processing");
  const [debugInfo, setDebugInfo] = useState<{ fullUrl: string; fbclid: string | null }>({ fullUrl: "", fbclid: null });

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
        
        // Set debug info for display
        setDebugInfo({ fullUrl, fbclid });

        console.log("Final fbclid value to save:", fbclid);

        // Insert traffic data and generate token (id)
        console.log("Attempting to insert into database with fbclid:", fbclid);
        
        const insertData = {
          facebook_click_id: fbclid || null,
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
        setStatus("redirecting");

        // Redirect to Telegram bot with the generated token
        const botUsername = "ClientinfoHarvestBot";
        const telegramUrl = `https://t.me/${botUsername}?start=${data.id}`;
        
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
        </div>

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
