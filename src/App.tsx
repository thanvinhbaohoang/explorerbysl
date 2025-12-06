import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
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
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppLayout>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              
              {/* Protected routes */}
              <Route path="/redirect" element={<ProtectedRoute><Redirect /></ProtectedRoute>} />
              <Route path="/telegram" element={<ProtectedRoute><Telegram /></ProtectedRoute>} />
              <Route path="/ad/*" element={<ProtectedRoute><Ad /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
              <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
              <Route path="/traffic" element={<ProtectedRoute><Traffic /></ProtectedRoute>} />
              <Route path="/ads-insight" element={<ProtectedRoute><AdsInsight /></ProtectedRoute>} />
              <Route path="/ads-insight/:adId" element={<ProtectedRoute><AdDetail /></ProtectedRoute>} />
              <Route path="/webhook-debug" element={<ProtectedRoute><WebhookDebug /></ProtectedRoute>} />
              <Route path="/media-gallery" element={<ProtectedRoute><MediaGallery /></ProtectedRoute>} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
