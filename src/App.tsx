import { BrowserRouter, Route, Routes } from "react-router-dom";
import { BarkKeyPage } from "./pages/BarkKeyPage";
import { IncidentPage } from "./pages/IncidentPage";
import { SubscribePage } from "./pages/SubscribePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BarkKeyPage />} />
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="/incidents/:incidentId/notifications/:token" element={<IncidentPage />} />
      </Routes>
    </BrowserRouter>
  );
}
