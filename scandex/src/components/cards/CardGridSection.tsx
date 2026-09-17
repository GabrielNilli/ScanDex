// =================================
//  IMPORTS
// =================================
import { Star } from "lucide-react";
import type { CardRecord } from "../../services/db/types.ts";
import {
  formatPrice,
  getCardmarketData,
  getHighestCardmarketPrice,
} from "../../services/pokewallet/cardmarketPrices.ts";
import OpfsImage from "../ui/OpfsImage.tsx";

// =================================
//  COMPONENT
// =================================
export default function CardGridSection({
  cards,
  loading,
  emptyMessage,
  onSelect,
}: {
  cards: CardRecord[];
  loading: boolean;
  emptyMessage: string;
  onSelect: (card: CardRecord) => void;
}) {
  // =================================
  //  RENDER
  // =================================
  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        Caricamento carte...
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="mx-auto max-w-sm text-xs text-slate-500 dark:text-slate-400">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {cards.map((card) => {
        const highestPrice = getHighestCardmarketPrice(getCardmarketData(card));
        return (
          <button
            key={card.id}
            onClick={() => onSelect(card)}
            className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="relative aspect-[63/88] bg-slate-100 dark:bg-slate-900">
              <OpfsImage
                path={card.image_path}
                alt={card.name}
                className="h-full w-full object-cover"
              />
              {card.card_number && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                  #{card.card_number}
                </span>
              )}
              {Boolean(card.favorite) && (
                <div className="absolute right-1.5 top-1.5 rounded-full bg-slate-900/70 p-1">
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                </div>
              )}
            </div>
            <div className="p-2">
              <h4 className="line-clamp-1 text-xs font-semibold">
                {card.name}
              </h4>
              <div className="flex items-center justify-between gap-1">
                <p className="line-clamp-1 text-[10px] text-slate-500 dark:text-slate-400">
                  {card.set_name}
                </p>
                {highestPrice !== null && (
                  <p className="shrink-0 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    {formatPrice(highestPrice)}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
