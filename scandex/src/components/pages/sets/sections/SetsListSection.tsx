// =================================
//  IMPORTS
// =================================
import type { SetProgress } from "../../../../services/sets/setsService.ts";
import SetRow from "./SetRow.tsx";

// =================================
//  COMPONENT
// =================================
export default function SetsListSection({
  sets,
  loading,
  emptyMessage,
  onSelectSet,
}: {
  sets: SetProgress[];
  loading: boolean;
  emptyMessage: string;
  onSelectSet: (entry: SetProgress) => void;
}) {
  // =================================
  //  RENDER
  // =================================
  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        Caricamento set...
      </div>
    );
  }

  if (sets.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="mx-auto max-w-sm text-xs text-slate-500 dark:text-slate-400">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0 xl:grid-cols-3">
      {sets.map((entry) => (
        <SetRow
          key={entry.set.set_id}
          {...entry}
          onClick={() => onSelectSet(entry)}
        />
      ))}
    </div>
  );
}
