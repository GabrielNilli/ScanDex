// =================================
//  IMPORTS
// =================================
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowUpNarrowWide,
  Heart,
  Layers,
  LayoutGrid,
  Search,
} from "lucide-react";
import {
  createCollection,
  deleteCollection,
  listCollections,
  type CollectionWithCount,
} from "../../../services/collections/collectionsService.ts";
import {
  deleteCard,
  listAllCards,
  listCardsByCollection,
  listFavoriteCards,
  moveCardToCollection,
  refreshCardPricing,
  setCardQuantity,
  setFavorite,
  updateCardNotes,
} from "../../../services/cards/cardsService.ts";
import type { CardRecord } from "../../../services/db/types.ts";
import {
  formatPrice,
  getCardmarketData,
  getHighestCardmarketPrice,
  getTotalPortfolioValue,
} from "../../../services/pokewallet/cardmarketPrices.ts";
import Logo from "../../ui/Logo.tsx";
import CardGridSection from "../../cards/CardGridSection.tsx";
import CardDetailSection from "../../cards/CardDetailSection.tsx";
import PortfolioHeroSection from "./sections/PortfolioHeroSection.tsx";
import CollectionsGridSection from "./sections/CollectionsGridSection.tsx";

// =================================
//  TYPES
// =================================
type View =
  | { name: "collections" }
  | { name: "collection"; collection: CollectionWithCount }
  | { name: "favorites" }
  | { name: "all" };

type SortKey = "date" | "number" | "price";
type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  date: "Data",
  number: "Numero",
  price: "Prezzo",
};

// Direzione più naturale per ciascun criterio quando lo si seleziona.
const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  date: "desc",
  number: "asc",
  price: "desc",
};

/** Chiave che identifica le copie della stessa carta nella stessa collezione. */
function copyKey(card: CardRecord): string {
  return `${card.pokewallet_id}|${card.collection_id ?? ""}`;
}

/**
 * Confronto per il criterio scelto, in ordine crescente. Numeri come "025/165",
 * "TG05" o "SWSH050" si confrontano in modo "naturale" (2 < 10). Le carte senza
 * valore finiscono sempre in fondo, indipendentemente dalla direzione.
 */
function compareCards(
  a: CardRecord,
  b: CardRecord,
  key: SortKey,
  dir: SortDir,
): number {
  const sign = dir === "asc" ? 1 : -1;
  if (key === "price") {
    const pa = getHighestCardmarketPrice(getCardmarketData(a));
    const pb = getHighestCardmarketPrice(getCardmarketData(b));
    if (pa === null || pb === null) return pa === pb ? 0 : pa === null ? 1 : -1;
    return (pa - pb) * sign;
  }
  if (key === "number") {
    if (!a.card_number || !b.card_number) {
      return a.card_number === b.card_number ? 0 : a.card_number ? -1 : 1;
    }
    const bySet = (a.set_name ?? "").localeCompare(b.set_name ?? "");
    if (bySet !== 0) return bySet;
    return (
      a.card_number.localeCompare(b.card_number, undefined, { numeric: true }) *
      sign
    );
  }
  const byDate = (a.created_at ?? "").localeCompare(b.created_at ?? "");
  return (byDate !== 0 ? byDate : a.id - b.id) * sign;
}

// =================================
//  COMPONENT
// =================================
export default function CollectionsPage() {
  const [view, setView] = useState<View>({ name: "collections" });
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [allCards, setAllCards] = useState<CardRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [detailCard, setDetailCard] = useState<CardRecord | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [cardSearchQuery, setCardSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT_DIR.date);

  const loadOverview = useCallback(async () => {
    const [collectionsList, cardsList] = await Promise.all([
      listCollections(),
      listAllCards(),
    ]);
    setCollections(collectionsList);
    setAllCards(cardsList);
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const loadCardsForView = useCallback(async () => {
    setLoadingCards(true);
    try {
      if (view.name === "collection") {
        setCards(await listCardsByCollection(view.collection.id));
      } else if (view.name === "favorites") {
        setCards(await listFavoriteCards());
      } else if (view.name === "all") {
        setCards(await listAllCards());
      }
    } finally {
      setLoadingCards(false);
    }
  }, [view]);

  useEffect(() => {
    setCardSearchQuery("");
    if (view.name !== "collections") {
      loadCardsForView();
    }
  }, [view, loadCardsForView]);

  const filteredCards = useMemo(() => {
    const query = cardSearchQuery.trim().toLowerCase();
    const matching = query
      ? cards.filter((c) => c.name.toLowerCase().includes(query))
      : cards;
    return [...matching].sort((a, b) => compareCards(a, b, sortKey, sortDir));
  }, [cards, cardSearchQuery, sortKey, sortDir]);

  // Numero di copie di ogni carta nella sua collezione, calcolato su tutte le
  // carte (non solo quelle della vista, es. nei preferiti non tutte le copie lo sono).
  const quantityByCopyKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of allCards) map.set(copyKey(c), (map.get(copyKey(c)) ?? 0) + 1);
    return map;
  }, [allCards]);

  const handleSortKeyChange = (key: SortKey) => {
    setSortKey(key);
    setSortDir(DEFAULT_SORT_DIR[key]);
  };

  const totalValue = useMemo(() => getTotalPortfolioValue(allCards), [allCards]);
  const viewValue = useMemo(() => getTotalPortfolioValue(cards), [cards]);

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    await createCollection(newCollectionName.trim());
    setNewCollectionName("");
    setShowNewCollection(false);
    await loadOverview();
  };

  const handleDeleteCollection = async (collection: CollectionWithCount) => {
    if (
      !window.confirm(
        `Eliminare la collezione "${collection.name}" e tutte le ${collection.cardCount} carte al suo interno?`,
      )
    ) {
      return;
    }
    await deleteCollection(collection.id);
    setView({ name: "collections" });
    await loadOverview();
  };

  const handleToggleFavorite = async (card: CardRecord) => {
    const next = card.favorite ? 0 : 1;
    await setFavorite(card.id, Boolean(next));
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, favorite: next } : c)),
    );
    setDetailCard((prev) =>
      prev && prev.id === card.id ? { ...prev, favorite: next } : prev,
    );
    if (view.name === "favorites" && next === 0) {
      setCards((prev) => prev.filter((c) => c.id !== card.id));
    }
  };

  const handleRefreshPrice = async (card: CardRecord) => {
    const updated = await refreshCardPricing(card.id);
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setAllCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setDetailCard((prev) => (prev && prev.id === updated.id ? updated : prev));
  };

  const handleUpdateNotes = async (card: CardRecord, notes: string) => {
    await updateCardNotes(card.id, notes);
    const trimmed = notes.trim() || null;
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, notes: trimmed } : c)),
    );
    setAllCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, notes: trimmed } : c)),
    );
    setDetailCard((prev) =>
      prev && prev.id === card.id ? { ...prev, notes: trimmed } : prev,
    );
  };

  const handleMoveToCollection = async (
    card: CardRecord,
    collectionId: number | null,
  ) => {
    await moveCardToCollection(card.id, collectionId);
    setCards((prev) =>
      view.name === "collection" && collectionId !== view.collection.id
        ? prev.filter((c) => c.id !== card.id)
        : prev.map((c) =>
            c.id === card.id ? { ...c, collection_id: collectionId } : c,
          ),
    );
    setAllCards((prev) =>
      prev.map((c) =>
        c.id === card.id ? { ...c, collection_id: collectionId } : c,
      ),
    );
    setDetailCard((prev) =>
      prev && prev.id === card.id
        ? { ...prev, collection_id: collectionId }
        : prev,
    );
    // Aggiorna il conteggio carte delle collezioni coinvolte.
    await loadOverview();
  };

  const handleChangeQuantity = async (card: CardRecord, quantity: number) => {
    await setCardQuantity(card, quantity);
    await Promise.all([loadOverview(), loadCardsForView()]);
  };

  const handleDeleteCard = async (card: CardRecord) => {
    if (!window.confirm(`Eliminare "${card.name}" dalla collezione?`)) return;
    await deleteCard(card.id);
    setCards((prev) => prev.filter((c) => c.id !== card.id));
    setAllCards((prev) => prev.filter((c) => c.id !== card.id));
    setDetailCard(null);
    if (view.name === "collection") await loadOverview();
  };

  // =================================
  //  RENDER
  // =================================
  return (
    <div className="min-h-dvh bg-slate-50 pb-24 text-slate-900 dark:bg-slate-900 dark:text-slate-100 lg:pb-6">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white px-4 pt-6 pb-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-2">
          {view.name !== "collections" && (
            <button
              onClick={() => setView({ name: "collections" })}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          {view.name === "collections" && <Logo size={26} className="lg:hidden" />}
          <h1 className="flex items-center gap-2 font-headline text-xl font-bold tracking-tight">
            {view.name === "collections" && (
              <span className="lg:hidden">ScanDex</span>
            )}
            {view.name === "collections" && (
              <span className="hidden lg:inline">Collezioni</span>
            )}
            {view.name === "collection" && (
              <>
                <Layers className="text-amber-500" size={22} />
                {view.collection.name}
              </>
            )}
            {view.name === "favorites" && (
              <>
                <Heart className="text-amber-500" size={22} />
                Preferiti
              </>
            )}
            {view.name === "all" && (
              <>
                <LayoutGrid className="text-amber-500" size={22} />
                Tutti gli scans
              </>
            )}
          </h1>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {view.name === "collections" &&
            "Organizza le carte scansionate in collezioni."}
          {view.name === "collection" && "Le carte salvate in questa collezione."}
          {view.name === "favorites" &&
            "Le carte che hai contrassegnato con una stella."}
          {view.name === "all" && "Tutte le carte scansionate, in un'unica vista."}
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-5 lg:pt-8">
        {view.name === "collections" && (
          <div className="lg:grid lg:grid-cols-[300px_1fr] lg:items-start lg:gap-10">
            <div className="lg:sticky lg:top-24">
              <PortfolioHeroSection
                totalValue={totalValue}
                cardCount={allCards.length}
                collectionCount={collections.length}
              />
            </div>
            <div className="mt-6 lg:mt-0">
              <CollectionsGridSection
                collections={collections}
                showNewCollectionForm={showNewCollection}
                newCollectionName={newCollectionName}
                onShowNewCollectionForm={() => setShowNewCollection(true)}
                onNewCollectionNameChange={setNewCollectionName}
                onCreateCollection={handleCreateCollection}
                onCancelNewCollection={() => {
                  setShowNewCollection(false);
                  setNewCollectionName("");
                }}
                onSelectCollection={(collection) =>
                  setView({ name: "collection", collection })
                }
                onDeleteCollection={handleDeleteCollection}
                onOpenFavorites={() => setView({ name: "favorites" })}
                onOpenAll={() => setView({ name: "all" })}
              />
            </div>
          </div>
        )}

        {(view.name === "collection" ||
          view.name === "favorites" ||
          view.name === "all") && (
          <div className="space-y-5">
            {cards.length > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {cards.length} {cards.length === 1 ? "carta" : "carte"}
                  </span>
                  {viewValue > 0 && (
                    <span>
                      Valore stimato:{" "}
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {formatPrice(viewValue)}
                      </span>
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                <div className="flex shrink-0 items-center gap-1">
                  <select
                    value={sortKey}
                    onChange={(e) => handleSortKeyChange(e.target.value as SortKey)}
                    className="rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800"
                    title="Ordina per"
                  >
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                      <option key={key} value={key}>
                        {SORT_LABELS[key]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                    }
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    title={sortDir === "asc" ? "Crescente" : "Decrescente"}
                  >
                    {sortDir === "asc" ? (
                      <ArrowUpNarrowWide size={16} />
                    ) : (
                      <ArrowDownWideNarrow size={16} />
                    )}
                  </button>
                </div>
                <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={cardSearchQuery}
                    onChange={(e) => setCardSearchQuery(e.target.value)}
                    placeholder="Cerca per nome carta..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                </div>
              </div>
            )}
            <CardGridSection
              cards={filteredCards}
              loading={loadingCards}
              emptyMessage={
                cardSearchQuery.trim()
                  ? "Nessuna carta trovata con questo nome."
                  : view.name === "favorites"
                    ? "Non hai ancora nessuna carta preferita. Aprine una e tocca il cuore."
                    : view.name === "all"
                      ? "Non hai ancora scansionato nessuna carta. Vai su \"Scansiona carta\" per iniziare."
                      : "Questa collezione è vuota. Scansiona una carta per aggiungerla qui."
              }
              onSelect={setDetailCard}
              quantityOf={(card) => quantityByCopyKey.get(copyKey(card)) ?? 1}
            />
          </div>
        )}
      </main>

      {detailCard && (
        <CardDetailSection
          card={detailCard}
          collections={collections}
          onClose={() => setDetailCard(null)}
          onToggleFavorite={handleToggleFavorite}
          onDelete={handleDeleteCard}
          onRefreshPrice={handleRefreshPrice}
          onUpdateNotes={handleUpdateNotes}
          onMoveToCollection={handleMoveToCollection}
          onChangeQuantity={handleChangeQuantity}
        />
      )}
    </div>
  );
}
