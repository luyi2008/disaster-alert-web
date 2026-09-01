import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RequireSession } from "./auth/RequireSession";
import { DevicesPage } from "./pages/DevicesPage";
import { HomeRedirect } from "./pages/HomeRedirect";
import { IncidentPage } from "./pages/IncidentPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SubscribePage } from "./pages/SubscribePage";
import { TestPage } from "./pages/TestPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/incidents/:incidentId/notifications/:token" element={<IncidentPage />} />
        <Route path="/devices" element={<RequireSession><DevicesPage /></RequireSession>} />
        <Route path="/devices/:id/subscribe" element={<RequireSession><SubscribePage /></RequireSession>} />
        <Route path="/devices/:id/subscribe/test" element={<RequireSession><TestPage /></RequireSession>} />
        <Route path="/settings" element={<RequireSession><SettingsPage /></RequireSession>} />
        <Route path="/subscribe" element={<RequireSession><DevicesPage /></RequireSession>} />
        <Route path="/subscribe/test" element={<RequireSession><DevicesPage /></RequireSession>} />
      </Routes>
    </BrowserRouter>
  );
}
