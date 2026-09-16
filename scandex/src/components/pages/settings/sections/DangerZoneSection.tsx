// =================================
//  IMPORTS
// =================================
import { Trash2 } from "lucide-react";

// =================================
//  COMPONENT
// =================================
export default function DangerZoneSection({
  onClearAllData,
}: {
  onClearAllData: () => void;
}) {
  // =================================
  //  RENDER
  // =================================
  return (
    <section className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm dark:border-red-900 dark:bg-slate-800">
      <h2 className="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">
        Zona pericolosa
      </h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Elimina definitivamente tutte le collezioni, le carte e le immagini
        salvate su questo dispositivo.
      </p>
      <button
        onClick={onClearAllData}
        className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
      >
        <Trash2 size={16} />
        Elimina tutti i dati
      </button>
    </section>
  );
}
