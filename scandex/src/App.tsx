// =================================
//  IMPORTS
// =================================
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import BottomTabs from "./components/ui/BottomTabs";

import CollectionsPage from "./components/pages/collections/CollectionsPage";
import SetsPage from "./components/pages/sets/SetsPage";
import ScansPage from "./components/pages/scans/ScansPage";
import SettingsPage from "./components/pages/settings/SettingsPage";
import { applyTheme, getSettings } from "./services/settings/settingsService";
import { migrateMissingSetIds } from "./services/cards/cardsService";

// =================================
//  COMPONENT
// =================================
function App() {
  useEffect(() => {
    applyTheme(getSettings().theme);
    migrateMissingSetIds().catch((err) =>
      console.warn("Migrazione set_id fallita:", err),
    );
  }, []);

  return (
    <BrowserRouter>
      <div>
        <Routes>
          <Route path="/" element={<Navigate to="/collections" replace />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/sets" element={<SetsPage />} />
          <Route path="/scans" element={<ScansPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
      <BottomTabs />
    </BrowserRouter>
  );
}

export default App;
