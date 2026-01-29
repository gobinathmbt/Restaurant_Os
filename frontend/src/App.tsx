import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import ProtectedRoute from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                {/* Landing Page */}
                <Route path="/" element={<Landing />} />
                
                {/* Login Page */}
                <Route path="/login" element={<Auth />} />
                
                {/* Register Page */}
                <Route path="/register" element={<Auth />} />
                
                {/* Dashboard - Protected Route */}
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <div className="p-8 text-center text-2xl">Dashboard Coming Soon</div>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Catch all - redirect to home */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
