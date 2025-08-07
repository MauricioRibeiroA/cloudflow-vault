// src/App.tsx
import React from 'react'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/components/auth/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
// import { BootstrapCheck } from '@/components/auth/BootstrapCheck'

import { AppLayout } from '@/components/layout/AppLayout'
import Index from './pages/Index'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import SimpleUpload from './pages/SimpleUpload'
import SimpleBackblaze from './pages/SimpleBackblaze'
import BusinessRules from './pages/BusinessRules'
import Logs from './pages/Logs'
import Backup from './pages/Backup'
import Settings from './pages/Settings'
import Companies from './pages/Companies'
import Plans from './components/Plans'
import SuperAdminDashboard from './components/SuperAdminDashboard'
import SecureFiles from './pages/SecureFiles'
import HierarchicalDemo from './pages/HierarchicalDemo'
import Trial from './pages/Trial'
import CompanySignup from './pages/CompanySignup'
import NotFound from './pages/NotFound'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* <BootstrapCheck> */}
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/signup/company" element={<CompanySignup />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredGroups={['super_admin', 'company_admin']}>
                    <AppLayout>
                      <Admin />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/simple-upload"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SimpleUpload />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/simple-backblaze"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SimpleBackblaze />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/business-rules"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <BusinessRules />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/logs"
                element={
                  <ProtectedRoute requiredGroups={['super_admin', 'company_admin']}>
                    <AppLayout>
                      <Logs />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/backup"
                element={
                  <ProtectedRoute requiredGroups={['super_admin', 'company_admin']}>
                    <AppLayout>
                      <Backup />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Settings />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/companies"
                element={
                  <ProtectedRoute requiredGroups={['super_admin']}>
                    <AppLayout>
                      <Companies />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/plans"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Plans />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/super-admin"
                element={
                  <ProtectedRoute requiredGroups={['super_admin']}>
                    <AppLayout>
                      <SuperAdminDashboard />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/secure-files"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SecureFiles />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/hierarchical-demo"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <HierarchicalDemo />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/trial"
                element={
                  <ProtectedRoute requiredGroups={['company_admin']}>
                    <AppLayout>
                      <Trial />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        {/* </BootstrapCheck> */}
      </AuthProvider>
    </QueryClientProvider>
  )
}
