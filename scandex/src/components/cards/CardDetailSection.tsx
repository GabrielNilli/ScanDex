// =================================
//  IMPORTS
// =================================
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ExternalLink,
  RefreshCw,
  Star,
  StickyNote,
  Trash2,
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

/** "oggi" se è la data odierna, altrimenti gg/mm/aaaa. */
function formatUpdatedAt(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return isToday ? "oggi" : date.toLocaleDateString("it-IT");
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
  onUpdateNotes,
}: {
  card: CardRecord;
  onClose: () => void;
  onToggleFavorite: (card: CardRecord) => void;
  onDelete: (card: CardRecord) => void;
  onRefreshPrice: (card: CardRecord) => Promise<void>;
  onUpdateNotes: (card: CardRecord, notes: string) => Promise<void>;
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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-slate-50 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl dark:bg-slate-900 sm:rounded-2xl sm:pb-5"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800 sm:rounded-t-2xl">
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Dettaglio carta
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleFavorite(card)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Star
                size={18}
                className={
                  card.favorite ? "fill-amber-500 text-amber-500" : undefined
                }
              />
            </button>
            <button
              onClick={() => onDelete(card)}
              className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="relative rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
            {card.rarity && (
              <span className="absolute right-4 top-4 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                {card.rarity}
              </span>
            )}
            <h3 className="font-headline pr-16 text-2xl font-bold">
              {card.name}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {[card.card_number, card.set_name, card.card_type]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <div className="mt-4 flex justify-center">
              <OpfsImage
                path={card.image_path}
                alt={card.name}
                className="h-72 rounded-xl object-cover shadow-md"
              />
            </div>
          </div>

          <CardmarketPricesSection
            card={card}
            refreshing={refreshing}
            refreshError={refreshError}
            onRefresh={handleRefresh}
          />

          <CardNotesSection card={card} onUpdateNotes={onUpdateNotes} />
        </div>
      </div>
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
  const lastUpdatedAt = cardmarket?.prices
    .map((p) => p.updated_at)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  return (
    <div className="mt-3 rounded-2xl bg-white p-4 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-headline text-sm font-bold">Prezzi CardMarket</h4>
          {lastUpdatedAt && (
            <p className="text-[11px] text-slate-400">
              Ultimo aggiornamento: {formatUpdatedAt(lastUpdatedAt)}
            </p>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          title="Aggiorna prezzo da PokeWallet"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          Aggiorna
        </button>
      </div>

      {cardmarket?.product_url && (
        <a
          href={cardmarket.product_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
        >
          Vedi su CardMarket
          <ExternalLink size={11} />
        </a>
      )}

      {refreshError && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400">
          <AlertTriangle size={12} />
          {refreshError}
        </div>
      )}

      {!cardmarket || cardmarket.prices.length === 0 ? (
        <p className="mt-2 text-[11px] text-slate-400">
          Nessun prezzo disponibile.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {cardmarket.prices.map((p) => (
            <div
              key={p.variant_type}
              className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {variantLabel(p.variant_type)}
                </span>
                <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  {formatPrice(p.trend)}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5 text-center">
                <PriceStat label="Media" value={p.avg} />
                <PriceStat label="Minimo" value={p.low} />
                <PriceStat label="7gg" value={p.avg7} />
                <PriceStat label="30gg" value={p.avg30} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PriceStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <span className="block text-[9px] text-slate-400">{label}</span>
      <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
        {formatPrice(value)}
      </span>
    </div>
  );
}

function CardNotesSection({
  card,
  onUpdateNotes,
}: {
  card: CardRecord;
  onUpdateNotes: (card: CardRecord, notes: string) => Promise<void>;
}) {
  const [value, setValue] = useState(card.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Se si apre una carta diversa, riparte dal suo testo salvato.
  useEffect(() => {
    setValue(card.notes ?? "");
    setSaved(false);
  }, [card.id, card.notes]);

  const handleBlur = async () => {
    if (value === (card.notes ?? "")) return;
    setSaving(true);
    try {
      await onUpdateNotes(card, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl bg-white p-4 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-headline flex items-center gap-1.5 text-sm font-bold">
            <StickyNote size={14} className="text-slate-400" />
            Note personali
          </h4>
        </div>
        {saving && (
          <span className="text-[11px] text-slate-400">Salvataggio...</span>
        )}
        {!saving && saved && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
            <Check size={12} />
            Salvata
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Condizione, provenienza, prezzo pagato..."
        rows={3}
        className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
    </div>
  );
}
