import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import AdsInsight from "./pages/AdsInsight";
import AdDetail from "./pages/AdDetail";
import Redirect from "./pages/Redirect";
import Ad from "./pages/Ad";
import NotFound from "./pages/NotFound";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/redirect" element={<Redirect />} />
          <Route path="/ad/*" element={<Ad />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ads-insight" element={<AdsInsight />} />
          <Route path="/ads-insight/:adId" element={<AdDetail />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
