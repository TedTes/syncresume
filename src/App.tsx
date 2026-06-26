import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AppDataProvider } from "./context/AppDataContext";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import ApplicationPage from "./pages/ApplicationPage";
import DashboardPage from "./pages/DashboardPage";
import LandingPage from "./pages/LandingPage";
import ResumesPage from "./pages/ResumesPage";
import SettingsPage from "./pages/SettingsPage";
import WorkspacePage from "./pages/WorkspacePage";

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppDataProvider>
          <Routes>
            {/* Public landing page */}
            <Route path="/" element={<LandingPage />} />

            {/* Authenticated app — AppShell is a pathless layout route */}
            <Route element={<AppShell />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="applications/:runId" element={<ApplicationPage />} />
              <Route path="workspace" element={<WorkspacePage />} />
              <Route path="workspace/review/:runId" element={<WorkspacePage />} />
              <Route path="workspace/resumes" element={<Navigate to="/workspace" replace />} />
              <Route path="workspace/:section" element={<WorkspacePage />} />
              <Route path="resumes" element={<ResumesPage />} />
              <Route path="optimizer" element={<Navigate to="/workspace/optimize" replace />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/workspace/optimize" replace />} />
          </Routes>
        </AppDataProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
