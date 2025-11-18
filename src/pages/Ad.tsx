import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const Ad = () => {
  const [searchParams] = useSearchParams();
  const [debugInfo, setDebugInfo] = useState<{
    fullUrl: string;
    fbclidFromRouter: string | null;
    fbclidFromWindow: string | null;
    allParams: Record<string, string>;
  }>({
    fullUrl: "",
    fbclidFromRouter: null,
    fbclidFromWindow: null,
    allParams: {},
  });

  useEffect(() => {
    // Capture full URL immediately
    const fullUrl = window.location.href;
    console.log("=== AD PAGE DEBUG ===");
    console.log("Full URL:", fullUrl);

    // Method 1: React Router useSearchParams
    const fbclidFromRouter = searchParams.get("fbclid");
    console.log("fbclid from React Router:", fbclidFromRouter);

    // Method 2: Direct window.location parsing
    const urlParams = new URLSearchParams(window.location.search);
    const fbclidFromWindow = urlParams.get("fbclid");
    console.log("fbclid from window.location:", fbclidFromWindow);

    // Get all parameters
    const allParams: Record<string, string> = {};
    urlParams.forEach((value, key) => {
      allParams[key] = value;
      console.log(`Parameter ${key}:`, value);
    });

    console.log("All URL parameters:", allParams);
    console.log("window.location.search:", window.location.search);
    console.log("=== END DEBUG ===");

    setDebugInfo({
      fullUrl,
      fbclidFromRouter,
      fbclidFromWindow,
      allParams,
    });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full p-8 bg-card rounded-lg border">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Ad Page - Debug Info</h1>
        
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-semibold mb-2 text-foreground">Full URL:</p>
            <p className="text-sm text-muted-foreground break-all font-mono">
              {debugInfo.fullUrl || "Loading..."}
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="font-semibold mb-2 text-foreground">fbclid (React Router):</p>
            <p className="text-sm text-muted-foreground font-mono">
              {debugInfo.fbclidFromRouter || "(none)"}
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="font-semibold mb-2 text-foreground">fbclid (window.location):</p>
            <p className="text-sm text-muted-foreground font-mono">
              {debugInfo.fbclidFromWindow || "(none)"}
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="font-semibold mb-2 text-foreground">All URL Parameters:</p>
            {Object.keys(debugInfo.allParams).length > 0 ? (
              <div className="space-y-1">
                {Object.entries(debugInfo.allParams).map(([key, value]) => (
                  <p key={key} className="text-sm text-muted-foreground font-mono">
                    <strong>{key}:</strong> {value}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">(no parameters detected)</p>
            )}
          </div>
        </div>

        <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-sm text-muted-foreground">
            Check your browser console (F12) for detailed logs.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Ad;
