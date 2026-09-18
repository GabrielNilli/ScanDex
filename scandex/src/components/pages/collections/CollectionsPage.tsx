// =================================
//  IMPORTS
// =================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Heart, Layers, LayoutGrid, Search } from "lucide-react";
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
  setFavorite,
  updateCardNotes,
} from "../../../services/cards/cardsService.ts";
import type { CardRecord } from "../../../services/db/types.ts";
import {
  formatPrice,
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

// =================================
//  COMPONENT
// =================================
export default function CollectionsPage() {
  // Di default si apre direttamente sull'elenco di tutti gli scan, non sulla
  // griglia delle collezioni: è la vista più utile appena entrati nella pagina.
  const [view, setView] = useState<View>({ name: "all" });
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [allCards, setAllCards] = useState<CardRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [detailCard, setDetailCard] = useState<CardRecord | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [cardSearchQuery, setCardSearchQuery] = useState("");

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
    if (!query) return cards;
    return cards.filter((c) => c.name.toLowerCase().includes(query));
  }, [cards, cardSearchQuery]);

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
                <div className="relative sm:w-64">
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
        />
      )}
    </div>
  );
}
