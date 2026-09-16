// =================================
//  IMPORTS
// =================================
import { CheckCircle2 } from "lucide-react";
import type { SetProgress } from "../../../../services/sets/setsService.ts";

// =================================
//  COMPONENT
// =================================
export default function SetRow({
  set,
  owned,
  missing,
  onClick,
}: SetProgress & { onClick: () => void }) {
  // =================================
  //  RENDER
  // =================================
  const percent = set.card_count > 0 ? (owned / set.card_count) * 100 : 0;
  const complete = missing === 0 && owned > 0;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="line-clamp-1 text-sm font-semibold">{set.name}</h4>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            {set.set_code} &bull; {set.language}
          </p>
        </div>
        {complete ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={11} />
            Completo
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            {missing === 1 ? "manca 1 carta" : `mancano ${missing} carte`}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-amber-500"
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {owned}/{set.card_count}
        </span>
      </div>
    </button>
  );
}
