import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Traffic from "./pages/Traffic";
import AdsInsight from "./pages/AdsInsight";
import AdDetail from "./pages/AdDetail";
import Redirect from "./pages/Redirect";
import Telegram from "./pages/Telegram";
import Ad from "./pages/Ad";
import WebhookDebug from "./pages/WebhookDebug";
import MediaGallery from "./pages/MediaGallery";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/redirect" element={<Redirect />} />
          <Route path="/telegram" element={<Telegram />} />
          <Route path="/ad/*" element={<Ad />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/traffic" element={<Traffic />} />
          <Route path="/ads-insight" element={<AdsInsight />} />
          <Route path="/ads-insight/:adId" element={<AdDetail />} />
          <Route path="/webhook-debug" element={<WebhookDebug />} />
          <Route path="/media-gallery" element={<MediaGallery />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
