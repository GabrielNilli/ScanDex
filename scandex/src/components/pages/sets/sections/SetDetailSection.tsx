// =================================
//  IMPORTS
// =================================
import { X } from "lucide-react";
import type { CardRecord } from "../../../../services/db/types.ts";
import type { SetProgress } from "../../../../services/sets/setsService.ts";
import CardGridSection from "../../../cards/CardGridSection.tsx";

// =================================
//  COMPONENT
// =================================
export default function SetDetailSection({
  entry,
  cards,
  loading,
  onClose,
  onSelectCard,
}: {
  entry: SetProgress;
  cards: CardRecord[];
  loading: boolean;
  onClose: () => void;
  onSelectCard: (card: CardRecord) => void;
}) {
  // =================================
  //  RENDER
  // =================================
  const { set, owned, missing } = entry;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl dark:bg-slate-800 sm:rounded-2xl sm:pb-5"
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <div>
            <h3 className="font-headline text-base font-bold">{set.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {set.set_code} &bull; {owned}/{set.card_count} possedute
              {missing > 0 && ` • mancano ${missing}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4">
          <CardGridSection
            cards={cards}
            loading={loading}
            emptyMessage="Non hai ancora nessuna carta di questo set."
            onSelect={onSelectCard}
          />
        </div>
      </div>
    </div>
  );
}
