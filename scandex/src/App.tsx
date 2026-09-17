// =================================
//  IMPORTS
// =================================
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import "./App.css";

import SideNav from "./components/ui/SideNav";
import BottomTabs from "./components/ui/BottomTabs";

import CollectionsPage from "./components/pages/collections/CollectionsPage";
import SetsPage from "./components/pages/sets/SetsPage";
import ScansPage from "./components/pages/scans/ScansPage";
import SettingsPage from "./components/pages/settings/SettingsPage";
import { applyTheme, getSettings } from "./services/settings/settingsService";
import { migrateMissingSetIds, saveScannedCard } from "./services/cards/cardsService";
import {
  createCollection,
  listCollections,
} from "./services/collections/collectionsService";
import {
  onScanReceived,
  type RemoteScanRequest,
} from "./services/remote/remoteService";

// =================================
//  COMPONENT
// =================================
function App() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(getSettings().theme);
    migrateMissingSetIds().catch((err) =>
      console.warn("Migrazione set_id fallita:", err),
    );
  }, []);

  // In arrivo dal telefono collegato (vedi Impostazioni > Scansione da telefono):
  // riceve la carta già riconosciuta e la salva come se fosse stata scansionata qui.
  useEffect(() => {
    return onScanReceived(async (payload: RemoteScanRequest) => {
      try {
        let collectionId: number | null = null;
        if (payload.collectionName) {
          const collections = await listCollections();
          const existing = collections.find(
            (c) => c.name === payload.collectionName,
          );
          collectionId = existing
            ? existing.id
            : (await createCollection(payload.collectionName)).id;
        }
        const card = await saveScannedCard({
          collectionId,
          result: payload.result,
          imageBlob: payload.imageBlob,
        });
        setToast(`Carta ricevuta dal telefono: ${card.name}`);
        setTimeout(() => setToast(null), 4000);
      } catch (err) {
        console.error("Errore salvataggio scansione remota:", err);
      }
    });
  }, []);

  return (
    <BrowserRouter>
      {toast && (
        <div className="fixed left-4 right-4 top-4 z-[100] mx-auto flex max-w-sm items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 shadow-lg dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 lg:left-auto">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          {toast}
        </div>
      )}
      <div className="lg:flex">
        <SideNav />
        <div className="lg:flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/collections" replace />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/sets" element={<SetsPage />} />
            <Route path="/scans" element={<ScansPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
      <BottomTabs />
    </BrowserRouter>
  );
}

export default App;
