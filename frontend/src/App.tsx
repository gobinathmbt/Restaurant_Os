import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import PlatformAdminLayout from "@/components/layouts/PlatformAdminLayout";
import CompanyLayout  from "@/components/layouts/CompanyLayout";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import ProtectedRoute from "@/contexts/ProtectedRoute";
import PlatformDashboard from "@/pages/platform/PlatformDashboard";
import PlatformSettings from "@/pages/platform/PlatformSettings";
import CompanyDashboard from "@/pages/company/CompanyDashboard";
import CompanySettings from "@/pages/company/CompanySettings";
import { isElectron } from "@/utils/platform";

const queryClient = new QueryClient();

const App = () => {
  const isElectronApp = isElectron();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
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
                      <PlatformAdminLayout />
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
                      <CompanyLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="dashboard" element={<CompanyDashboard />} />
                  <Route path="pos" element={<div className="p-8">POS Page Coming Soon</div>} />
                  <Route path="orders" element={<div className="p-8">Orders Page Coming Soon</div>} />
                  <Route path="menu" element={<div className="p-8">Menu Page Coming Soon</div>} />
                  <Route path="inventory" element={<div className="p-8">Inventory Page Coming Soon</div>} />
                  <Route path="customers" element={<div className="p-8">Customers Page Coming Soon</div>} />
                  <Route path="staff" element={<div className="p-8">Staff Page Coming Soon</div>} />
                  <Route path="reports" element={<div className="p-8">Reports Page Coming Soon</div>} />
                  <Route path="billing" element={<div className="p-8">Billing Page Coming Soon</div>} />
                  <Route path="branches" element={<div className="p-8">Branches Page Coming Soon</div>} />
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
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
