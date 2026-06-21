import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AppDataProvider } from "./context/AppDataContext";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import WorkspacePage from "./pages/WorkspacePage";

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppDataProvider>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<Navigate to="/workspace/optimize" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="workspace" element={<WorkspacePage />} />
              <Route path="workspace/:section" element={<WorkspacePage />} />
              <Route path="optimizer" element={<Navigate to="/workspace/optimize" replace />} />
              <Route path="resumes" element={<Navigate to="/workspace/resumes" replace />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/workspace/optimize" replace />} />
            </Route>
          </Routes>
        </AppDataProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
