import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import ProtectedRoute from "@/contexts/ProtectedRoute";
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
                
                {/* Dashboard - Protected Route */}
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <div className="p-8 text-center text-2xl">Dashboard Coming Soon</div>
                    </ProtectedRoute>
                  } 
                />
                
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
