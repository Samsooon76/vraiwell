import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Requests from "./pages/Requests";
import Analytics from "./pages/Analytics";
import Teams from "./pages/Teams";
import Integrations from "./pages/Integrations";
import Workflows from "./pages/Workflows";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/onboarding" element={<ProtectedRoute requireOnboarding><Onboarding /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
            <Route path="/dashboard/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/dashboard/teams" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
            <Route path="/dashboard/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
            <Route path="/dashboard/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
