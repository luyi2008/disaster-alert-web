import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AddDevicePage } from "./pages/AddDevicePage";
import { BarkKeyPage } from "./pages/BarkKeyPage";
import { DeviceSubscriptionPage, DeviceTestPage, LegalPlaceholder } from "./pages/DeviceFlowPages";
import { DevicesPage } from "./pages/DevicesPage";
import { IncidentPage } from "./pages/IncidentPage";
import { LoginPage } from "./pages/LoginPage";
import { SubscribePage } from "./pages/SubscribePage";
import { TestPage } from "./pages/TestPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BarkKeyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/privacy" element={<LegalPlaceholder title="隐私政策" />} />
        <Route path="/terms" element={<LegalPlaceholder title="服务条款" />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/devices/add" element={<AddDevicePage />} />
        <Route path="/devices/:deviceId/subscription" element={<DeviceSubscriptionPage />} />
        <Route path="/devices/:deviceId/test" element={<DeviceTestPage />} />
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="/subscribe/test" element={<TestPage />} />
        <Route path="/incidents/:incidentId/notifications/:token" element={<IncidentPage />} />
      </Routes>
    </BrowserRouter>
  );
}
