// =================================
//  IMPORTS
// =================================
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { AlertTriangle, Download, HardDriveUpload, Loader2 } from "lucide-react";
import {
  exportBackup,
  importBackup,
} from "../../../../services/backup/backupService.ts";

// =================================
//  COMPONENT
// =================================
export default function BackupSection({
  onExported,
  onImported,
}: {
  onExported: (cardCount: number) => void;
  onImported: (result: {
    importedCards: number;
    skippedCards: number;
    importedCollections: number;
  }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const { cardCount } = await exportBackup();
      onExported(cardCount);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Errore durante l'esportazione.",
      );
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setError(null);
    try {
      const result = await importBackup(file);
      onImported(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Errore durante l'importazione.",
      );
    } finally {
      setImporting(false);
    }
  };

  // =================================
  //  RENDER
  // =================================
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <HardDriveUpload size={16} className="text-amber-600 dark:text-amber-400" />
        Backup e trasferimento dati
      </h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Collezioni, carte e immagini sono salvate solo su questo dispositivo.
        Esporta un file di backup per spostarle su un altro telefono o browser.
      </p>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          Esporta backup
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {importing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <HardDriveUpload size={16} />
          )}
          Importa backup
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileSelected}
          />
        </button>
      </div>
    </section>
  );
}
