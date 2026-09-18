// =================================
//  IMPORTS
// =================================
import { Folder, Layers, Wallet } from "lucide-react";
import { formatPrice } from "../../../../services/pokewallet/cardmarketPrices.ts";

// =================================
//  COMPONENT
// =================================
export default function PortfolioHeroSection({
  totalValue,
  cardCount,
  collectionCount,
}: {
  totalValue: number;
  cardCount: number;
  collectionCount: number;
}) {
  // =================================
  //  RENDER
  // =================================
  return (
    <div className="overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-900 p-6 text-white shadow-lg dark:border-amber-500/30 lg:p-7">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
        <Wallet size={13} />
        Valore stimato collezione
      </div>
      <p className="mt-2 font-headline text-3xl font-bold tracking-tight lg:text-4xl">
        {formatPrice(totalValue)}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3.5 py-3">
          <Layers size={16} className="text-amber-400" />
          <div>
            <p className="text-sm font-semibold leading-tight">{cardCount}</p>
            <p className="text-[10px] text-slate-400">
              {cardCount === 1 ? "carta" : "carte"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3.5 py-3">
          <Folder size={16} className="text-amber-400" />
          <div>
            <p className="text-sm font-semibold leading-tight">
              {collectionCount}
            </p>
            <p className="text-[10px] text-slate-400">
              {collectionCount === 1 ? "collezione" : "collezioni"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
