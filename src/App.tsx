import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { BootstrapCheck } from "@/components/auth/BootstrapCheck";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Upload from "./pages/Upload";
import BusinessRules from "./pages/BusinessRules";
import Logs from "./pages/Logs";
import Backup from "./pages/Backup";
import Settings from "./pages/Settings";
import Companies from "./pages/Companies";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BootstrapCheck>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute requiredGroups={['super_admin', 'company_admin']}>
                  <AppLayout>
                    <Admin />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/upload" element={
                <ProtectedRoute>
                  <AppLayout>
                    <Upload />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/business-rules" element={
                <ProtectedRoute>
                  <AppLayout>
                    <BusinessRules />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/logs" element={
                <ProtectedRoute requiredGroups={['super_admin', 'company_admin']}>
                  <AppLayout>
                    <Logs />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/backup" element={
                <ProtectedRoute requiredGroups={['super_admin', 'company_admin']}>
                  <AppLayout>
                    <Backup />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <AppLayout>
                    <Settings />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/companies" element={
                <ProtectedRoute requiredGroups={['super_admin']}>
                  <AppLayout>
                    <Companies />
                  </AppLayout>
                </ProtectedRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </BootstrapCheck>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
