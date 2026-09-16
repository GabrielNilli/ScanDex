// =================================
//  IMPORTS
// =================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Heart, Search } from "lucide-react";
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
  refreshCardPricing,
  setFavorite,
} from "../../../services/cards/cardsService.ts";
import type { CardRecord } from "../../../services/db/types.ts";
import { getTotalPortfolioValue } from "../../../services/pokewallet/cardmarketPrices.ts";
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
  | { name: "favorites" };

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
    <div className="min-h-dvh bg-slate-50 pb-24 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
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
          {view.name === "collections" && <Logo size={26} />}
          <h1 className="flex items-center gap-2 font-headline text-xl font-bold tracking-tight">
            {view.name === "collections" && "ScanDex"}
            {view.name === "collection" && view.collection.name}
            {view.name === "favorites" && (
              <>
                <Heart className="text-amber-500" size={22} />
                Preferiti
              </>
            )}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 pt-4">
        {view.name === "collections" && (
          <>
            <PortfolioHeroSection
              totalValue={totalValue}
              cardCount={allCards.length}
              collectionCount={collections.length}
            />
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
            />
          </>
        )}

        {(view.name === "collection" || view.name === "favorites") && (
          <div className="space-y-3">
            {cards.length > 0 && (
              <div className="relative">
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
            )}
            <CardGridSection
              cards={filteredCards}
              loading={loadingCards}
              emptyMessage={
                cardSearchQuery.trim()
                  ? "Nessuna carta trovata con questo nome."
                  : view.name === "favorites"
                    ? "Non hai ancora nessuna carta preferita. Aprine una e tocca il cuore."
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
          onClose={() => setDetailCard(null)}
          onToggleFavorite={handleToggleFavorite}
          onDelete={handleDeleteCard}
          onRefreshPrice={handleRefreshPrice}
        />
      )}
    </div>
  );
}
