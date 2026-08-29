import { BrowserRouter, Route, Routes } from "react-router-dom";
import { BarkKeyPage } from "./pages/BarkKeyPage";
import { IncidentPage } from "./pages/IncidentPage";
import { SubscribePage } from "./pages/SubscribePage";
import { TestPage } from "./pages/TestPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BarkKeyPage />} />
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="/subscribe/test" element={<TestPage />} />
        <Route path="/incidents/:incidentId/notifications/:token" element={<IncidentPage />} />
      </Routes>
    </BrowserRouter>
  );
}
