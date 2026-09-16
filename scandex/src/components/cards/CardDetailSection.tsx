// =================================
//  IMPORTS
// =================================
import { useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type { CardRecord } from "../../services/db/types.ts";
import {
  formatPrice,
  getCardmarketData,
} from "../../services/pokewallet/cardmarketPrices.ts";
import OpfsImage from "../ui/OpfsImage.tsx";

const VARIANT_LABELS: Record<string, string> = {
  normal: "Normale",
  holo: "Olografica",
  reverse: "Reverse Holo",
  reverse_holo: "Reverse Holo",
  "1st_edition": "Prima Edizione",
};

function variantLabel(variantType: string): string {
  return (
    VARIANT_LABELS[variantType.toLowerCase()] ??
    variantType.charAt(0).toUpperCase() + variantType.slice(1)
  );
}

// =================================
//  COMPONENT
// =================================
export default function CardDetailSection({
  card,
  onClose,
  onToggleFavorite,
  onDelete,
  onRefreshPrice,
}: {
  card: CardRecord;
  onClose: () => void;
  onToggleFavorite: (card: CardRecord) => void;
  onDelete: (card: CardRecord) => void;
  onRefreshPrice: (card: CardRecord) => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await onRefreshPrice(card);
    } catch (err) {
      setRefreshError(
        err instanceof Error ? err.message : "Errore durante l'aggiornamento.",
      );
    } finally {
      setRefreshing(false);
    }
  };

  // =================================
  //  RENDER
  // =================================
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl dark:bg-slate-800 sm:rounded-2xl sm:pb-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-headline text-base font-bold">{card.name}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex justify-center">
          <OpfsImage
            path={card.image_path}
            alt={card.name}
            className="h-72 rounded-xl object-cover shadow-md"
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <DetailItem label="Numero" value={card.card_number} />
          <DetailItem label="Rarità" value={card.rarity} />
          <DetailItem label="Set" value={card.set_name} />
          <DetailItem label="Tipo" value={card.card_type} />
        </dl>

        <CardmarketPricesSection
          card={card}
          refreshing={refreshing}
          refreshError={refreshError}
          onRefresh={handleRefresh}
        />

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => onToggleFavorite(card)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              card.favorite
                ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Star
              size={16}
              className={card.favorite ? "fill-amber-500 text-amber-500" : ""}
            />
            {card.favorite ? "Nei preferiti" : "Aggiungi ai preferiti"}
          </button>
          <button
            onClick={() => onDelete(card)}
            className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-700">
      <span className="block text-[10px] font-semibold text-slate-400">
        {label}
      </span>
      <span className="text-slate-800 dark:text-slate-100">
        {value || "—"}
      </span>
    </div>
  );
}

function CardmarketPricesSection({
  card,
  refreshing,
  refreshError,
  onRefresh,
}: {
  card: CardRecord;
  refreshing: boolean;
  refreshError: string | null;
  onRefresh: () => void;
}) {
  const cardmarket = getCardmarketData(card);

  return (
    <div className="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-700">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-slate-400">
          Prezzi CardMarket
        </span>
        <div className="flex items-center gap-2">
          {cardmarket?.product_url && (
            <a
              href={cardmarket.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-medium text-amber-600 hover:underline dark:text-amber-400"
            >
              Vedi su CardMarket
              <ExternalLink size={10} />
            </a>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:opacity-50 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500"
            title="Aggiorna prezzo da PokeWallet"
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
            Aggiorna
          </button>
        </div>
      </div>

      {refreshError && (
        <div className="mb-2 flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400">
          <AlertTriangle size={11} />
          {refreshError}
        </div>
      )}

      {!cardmarket || cardmarket.prices.length === 0 ? (
        <p className="text-[11px] text-slate-400">Nessun prezzo disponibile.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[380px] text-left text-[11px]">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-1 font-medium">Variante</th>
                <th className="pb-1 font-medium">Trend</th>
                <th className="pb-1 font-medium">Media</th>
                <th className="pb-1 font-medium">Minimo</th>
                <th className="pb-1 font-medium">7gg</th>
                <th className="pb-1 font-medium">30gg</th>
              </tr>
            </thead>
            <tbody>
              {cardmarket.prices.map((p) => (
                <tr
                  key={p.variant_type}
                  className="border-t border-slate-200 dark:border-slate-600"
                >
                  <td className="py-1 pr-2 text-slate-800 dark:text-slate-100">
                    {variantLabel(p.variant_type)}
                  </td>
                  <td className="py-1 pr-2 font-semibold text-amber-600 dark:text-amber-400">
                    {formatPrice(p.trend)}
                  </td>
                  <td className="py-1 pr-2 text-slate-600 dark:text-slate-300">
                    {formatPrice(p.avg)}
                  </td>
                  <td className="py-1 pr-2 text-slate-600 dark:text-slate-300">
                    {formatPrice(p.low)}
                  </td>
                  <td className="py-1 pr-2 text-slate-600 dark:text-slate-300">
                    {formatPrice(p.avg7)}
                  </td>
                  <td className="py-1 text-slate-600 dark:text-slate-300">
                    {formatPrice(p.avg30)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
