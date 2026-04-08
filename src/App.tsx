import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import { preloadNotificationSounds } from "@/lib/notification-sound";

import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Chat from "./pages/Chat";
import Traffic from "./pages/Traffic";
import AdsInsight from "./pages/AdsInsight";
import AdDetail from "./pages/AdDetail";
import Redirect from "./pages/Redirect";
import Telegram from "./pages/Telegram";
import Ad from "./pages/Ad";
import WebhookDebug from "./pages/WebhookDebug";
import MediaGallery from "./pages/MediaGallery";
import Auth from "./pages/Auth";
import MondayImport from "./pages/MondayImport";
import FacebookPages from "./pages/FacebookPages";
import UserRoles from "./pages/UserRoles";
import Docs from "./pages/Docs";
import FacebookConnect from "./pages/FacebookConnect";
import NotFound from "./pages/NotFound";
import PendingApproval from "./pages/PendingApproval";

const queryClient = new QueryClient();

const App = () => {
  // Preload notification sounds on app start
  useEffect(() => {
    preloadNotificationSounds();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppLayout>
              <Routes>
                {/* Redirect root to customers */}
                <Route path="/" element={<Navigate to="/customers" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/pending-approval" element={<PendingApproval />} />
                
                {/* Protected routes */}
                <Route path="/redirect" element={<ProtectedRoute><Redirect /></ProtectedRoute>} />
                <Route path="/telegram" element={<Telegram />} />
                <Route path="/ad/*" element={<ProtectedRoute><Ad /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                <Route path="/traffic" element={<ProtectedRoute><Traffic /></ProtectedRoute>} />
                <Route path="/ads-insight" element={<ProtectedRoute><AdsInsight /></ProtectedRoute>} />
                <Route path="/ads-insight/:adId" element={<ProtectedRoute><AdDetail /></ProtectedRoute>} />
                <Route path="/webhook-debug" element={<ProtectedRoute><WebhookDebug /></ProtectedRoute>} />
                <Route path="/media-gallery" element={<ProtectedRoute><MediaGallery /></ProtectedRoute>} />
                <Route path="/monday-import" element={<ProtectedRoute><MondayImport /></ProtectedRoute>} />
                <Route path="/system" element={<ProtectedRoute><FacebookPages /></ProtectedRoute>} />
                <Route path="/facebook-connect" element={<ProtectedRoute><FacebookConnect /></ProtectedRoute>} />
                <Route path="/user-roles" element={<ProtectedRoute><UserRoles /></ProtectedRoute>} />
                <Route path="/docs" element={<ProtectedRoute><Docs /></ProtectedRoute>} />
                
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
