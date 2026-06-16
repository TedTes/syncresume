import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AppDataProvider } from "./context/AppDataContext";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import DashboardPage from "./pages/DashboardPage";
import OptimizerPage from "./pages/OptimizerPage";
import ResumesPage from "./pages/ResumesPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppDataProvider>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<Navigate to="/optimizer" replace />} />
              <Route path="optimizer" element={<OptimizerPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="resumes" element={<ResumesPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/optimizer" replace />} />
            </Route>
          </Routes>
        </AppDataProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
