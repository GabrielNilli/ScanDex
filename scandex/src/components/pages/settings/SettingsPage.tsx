// =================================
//  IMPORTS
// =================================
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { dbService } from "../../../services/db/index.ts";
import type { DbStats } from "../../../services/db/types.ts";
import {
  clearAllImages,
  getStorageEstimate,
  type StorageEstimateInfo,
} from "../../../services/opfs/images.ts";
import {
  listCollections,
  type CollectionWithCount,
} from "../../../services/collections/collectionsService.ts";
import {
  applyTheme,
  getSettings,
  updateSettings,
  type ThemeMode,
} from "../../../services/settings/settingsService.ts";
import Logo from "../../ui/Logo.tsx";
import ThemeSection from "./sections/ThemeSection.tsx";
import GeneralSection from "./sections/GeneralSection.tsx";
import StorageSection from "./sections/StorageSection.tsx";
import DangerZoneSection from "./sections/DangerZoneSection.tsx";

// =================================
//  COMPONENT
// =================================
export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeMode>(getSettings().theme);
  const [defaultCollectionId, setDefaultCollectionId] = useState<number | "">(
    getSettings().defaultCollectionId ?? "",
  );
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [estimate, setEstimate] = useState<StorageEstimateInfo | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    Promise.all([
      listCollections(),
      dbService.getStats(),
      getStorageEstimate(),
    ]).then(([cols, dbStats, est]) => {
      setCollections(cols);
      setStats(dbStats);
      setEstimate(est);
    });
  }, []);

  const handleThemeChange = (value: ThemeMode) => {
    setTheme(value);
    updateSettings({ theme: value });
    applyTheme(value);
  };

  const handleDefaultCollectionChange = (value: number | "") => {
    setDefaultCollectionId(value);
    updateSettings({ defaultCollectionId: value === "" ? null : value });
  };

  const handleClearAllData = async () => {
    if (
      !window.confirm(
        "Sei sicuro di voler eliminare tutte le collezioni, le carte e le immagini salvate? L'operazione non è reversibile.",
      )
    ) {
      return;
    }
    try {
      await dbService.clearAll();
      await clearAllImages();
      const [dbStats, est] = await Promise.all([
        dbService.getStats(),
        getStorageEstimate(),
      ]);
      setStats(dbStats);
      setEstimate(est);
      setCollections([]);
      showToast("Tutti i dati sono stati eliminati.");
    } catch (err) {
      console.error("Errore durante la cancellazione dei dati:", err);
      showToast("Errore durante la cancellazione dei dati.", "error");
    }
  };

  // =================================
  //  RENDER
  // =================================
  return (
    <div className="min-h-dvh bg-slate-50 pb-24 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {toast && (
        <div
          className={`fixed left-4 right-4 top-4 z-50 flex items-center gap-3 rounded-xl border p-4 text-sm shadow-lg sm:left-auto sm:w-96 ${
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={20} className="shrink-0 text-green-600" />
          ) : (
            <AlertTriangle size={20} className="shrink-0 text-red-600" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white px-4 pt-6 pb-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <h1 className="font-headline text-xl font-bold tracking-tight">
            Impostazioni
          </h1>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Preferenze dell&apos;app e gestione dei dati salvati sul
          dispositivo.
        </p>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        <ThemeSection theme={theme} onChange={handleThemeChange} />
        <GeneralSection
          collections={collections}
          defaultCollectionId={defaultCollectionId}
          onDefaultCollectionChange={handleDefaultCollectionChange}
        />
        <StorageSection stats={stats} estimate={estimate} />
        <DangerZoneSection onClearAllData={handleClearAllData} />
      </main>
    </div>
  );
}
