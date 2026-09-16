// =================================
//  IMPORTS
// =================================
import { Database, HardDrive } from "lucide-react";
import type { DbStats } from "../../../../services/db/types.ts";
import type { StorageEstimateInfo } from "../../../../services/opfs/images.ts";

// =================================
//  COMPONENT
// =================================
export default function StorageSection({
  stats,
  estimate,
}: {
  stats: DbStats | null;
  estimate: StorageEstimateInfo | null;
}) {
  // =================================
  //  RENDER
  // =================================
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <HardDrive size={16} className="text-amber-600 dark:text-amber-400" />
        Archiviazione locale
      </h2>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-700">
          <span className="block text-slate-500 dark:text-slate-400">
            Carte
          </span>
          <span className="text-lg font-bold">{stats?.cardsCount ?? 0}</span>
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-700">
          <span className="block text-slate-500 dark:text-slate-400">
            Collezioni
          </span>
          <span className="text-lg font-bold">
            {stats?.collectionsCount ?? 0}
          </span>
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-700">
          <span className="block text-slate-500 dark:text-slate-400">
            Spazio usato
          </span>
          <span className="text-sm font-bold">
            {estimate?.usageFormatted ?? "0 B"}
          </span>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Database size={12} />
        Database SQLite e immagini salvati in locale (OPFS) su questo
        dispositivo.
      </p>
    </section>
  );
}
