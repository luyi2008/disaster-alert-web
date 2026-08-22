import { BrowserRouter, Route, Routes } from "react-router-dom";
import { IncidentPage } from "./pages/IncidentPage";
import { SubscribePage } from "./pages/SubscribePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SubscribePage />} />
        <Route path="/incidents/:incidentId/notifications/:token" element={<IncidentPage />} />
      </Routes>
    </BrowserRouter>
  );
}
