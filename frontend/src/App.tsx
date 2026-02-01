import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import PlatformAdminLayout from "@/components/layouts/PlatformAdminLayout";
import CompanyLayout  from "@/components/layouts/CompanyLayout";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import ProtectedRoute from "@/contexts/ProtectedRoute";
import PlatformDashboard from "@/pages/platform/PlatformDashboard";
import PlatformSettings from "@/pages/platform/PlatformSettings";
import CompanyDashboard from "@/pages/company/CompanyDashboard";
import CompanySettings from "@/pages/company/CompanySettings";
import Branches from "@/pages/company/Branches";
import Staff from "@/pages/company/Staff";
import { isElectron } from "@/utils/platform";
import { lazy, Suspense } from "react";

// Lazy load inventory pages for better performance
const Inventory = lazy(() => import("@/pages/company/Inventory"));
const Recipes = lazy(() => import("@/pages/company/Recipes"));
const Suppliers = lazy(() => import("@/pages/company/Suppliers"));

const queryClient = new QueryClient();

const App = () => {
  const isElectronApp = isElectron();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LoadingProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
              <Routes>
                {/* Landing Page - Only for Web */}
                {!isElectronApp && <Route path="/" element={<Landing />} />}
                
                {/* Auth Page - Default for Electron, accessible for Web */}
                {isElectronApp ? (
                  <Route path="/" element={<Auth />} />
                ) : (
                  <Route path="/auth" element={<Auth />} />
                )}
                
                {/* Auth redirects for Web */}
                {!isElectronApp && (
                  <>
                    <Route path="/login" element={<Navigate to="/auth?mode=login" replace />} />
                    <Route path="/register" element={<Navigate to="/auth?mode=register" replace />} />
                  </>
                )}
                
                {/* Platform Admin Routes */}
                <Route
                  path="/platform"
                  element={
                    <ProtectedRoute requiredUserType="platform">
                      <NotificationProvider>
                        <PlatformAdminLayout />
                      </NotificationProvider>
                    </ProtectedRoute>
                  }
                >
                  <Route path="dashboard" element={<PlatformDashboard />} />
                  <Route path="companies" element={<div className="p-8">Companies Page Coming Soon</div>} />
                  <Route path="subscriptions" element={<div className="p-8">Subscriptions Page Coming Soon</div>} />
                  <Route path="analytics" element={<div className="p-8">Analytics Page Coming Soon</div>} />
                  <Route path="admins" element={<div className="p-8">Admins Page Coming Soon</div>} />
                  <Route path="settings" element={<PlatformSettings />} />
                  <Route index element={<Navigate to="/platform/dashboard" replace />} />
                </Route>

                {/* Company Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute requiredUserType="company">
                      <NotificationProvider>
                        <CompanyLayout />
                      </NotificationProvider>
                    </ProtectedRoute>
                  }
                >
                  <Route path="dashboard" element={<CompanyDashboard />} />
                  <Route path="pos" element={<div className="p-8">POS Page Coming Soon</div>} />
                  <Route path="orders" element={<div className="p-8">Orders Page Coming Soon</div>} />
                  <Route path="menu" element={<div className="p-8">Menu Page Coming Soon</div>} />
                  <Route 
                    path="inventory" 
                    element={
                      <Suspense fallback={<div className="p-8">Loading...</div>}>
                        <Inventory />
                      </Suspense>
                    } 
                  />
                  <Route 
                    path="recipes" 
                    element={
                      <Suspense fallback={<div className="p-8">Loading...</div>}>
                        <Recipes />
                      </Suspense>
                    } 
                  />
                  <Route 
                    path="suppliers" 
                    element={
                      <Suspense fallback={<div className="p-8">Loading...</div>}>
                        <Suppliers />
                      </Suspense>
                    } 
                  />
                  <Route path="customers" element={<div className="p-8">Customers Page Coming Soon</div>} />
                  <Route path="staff" element={<Staff />} />
                  <Route path="reports" element={<div className="p-8">Reports Page Coming Soon</div>} />
                  <Route path="billing" element={<div className="p-8">Billing Page Coming Soon</div>} />
                  <Route path="branches" element={<Branches />} />
                  <Route path="settings" element={<CompanySettings />} />
                </Route>
                
                {/* Catch all - redirect based on platform */}
                <Route 
                  path="*" 
                  element={<Navigate to={isElectronApp ? "/" : "/"} replace />} 
                />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </LoadingProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
