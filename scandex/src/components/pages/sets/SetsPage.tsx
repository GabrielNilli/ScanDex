// =================================
//  IMPORTS
// =================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import {
  deleteCard,
  getCardCountsBySetId,
  listCardsBySetId,
  refreshCardPricing,
  setFavorite,
  updateCardNotes,
} from "../../../services/cards/cardsService.ts";
import type { CardRecord, SetRecord } from "../../../services/db/types.ts";
import {
  buildSetProgressList,
  filterSetProgress,
  getAllSets,
  type SetProgress,
} from "../../../services/sets/setsService.ts";
import Logo from "../../ui/Logo.tsx";
import CardDetailSection from "../../cards/CardDetailSection.tsx";
import SetsListSection from "./sections/SetsListSection.tsx";
import SetDetailSection from "./sections/SetDetailSection.tsx";

// =================================
//  COMPONENT
// =================================
export default function SetsPage() {
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [ownedCountBySetId, setOwnedCountBySetId] = useState<
    Map<string, number>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedSet, setSelectedSet] = useState<SetProgress | null>(null);
  const [setCards, setSetCards] = useState<CardRecord[]>([]);
  const [loadingSetCards, setLoadingSetCards] = useState(false);
  const [detailCard, setDetailCard] = useState<CardRecord | null>(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    setErrorMessage(null);
    try {
      const [setsList, countsMap] = await Promise.all([
        getAllSets(forceRefresh),
        getCardCountsBySetId(),
      ]);
      setSets(setsList);
      setOwnedCountBySetId(countsMap);
    } catch (err) {
      console.error("Errore caricamento set:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Errore durante il caricamento dei set.",
      );
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  const allProgress = useMemo(
    () => buildSetProgressList(sets, ownedCountBySetId),
    [sets, ownedCountBySetId],
  );

  const visibleSets = useMemo(
    () => filterSetProgress(allProgress, searchQuery),
    [allProgress, searchQuery],
  );

  const handleSelectSet = async (entry: SetProgress) => {
    setSelectedSet(entry);
    setLoadingSetCards(true);
    try {
      setSetCards(await listCardsBySetId(entry.set.set_id));
    } finally {
      setLoadingSetCards(false);
    }
  };

  const handleToggleFavorite = async (card: CardRecord) => {
    const next = card.favorite ? 0 : 1;
    await setFavorite(card.id, Boolean(next));
    setSetCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, favorite: next } : c)),
    );
    setDetailCard((prev) =>
      prev && prev.id === card.id ? { ...prev, favorite: next } : prev,
    );
  };

  const handleRefreshPrice = async (card: CardRecord) => {
    const updated = await refreshCardPricing(card.id);
    setSetCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setDetailCard((prev) => (prev && prev.id === updated.id ? updated : prev));
  };

  const handleUpdateNotes = async (card: CardRecord, notes: string) => {
    await updateCardNotes(card.id, notes);
    const trimmed = notes.trim() || null;
    setSetCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, notes: trimmed } : c)),
    );
    setDetailCard((prev) =>
      prev && prev.id === card.id ? { ...prev, notes: trimmed } : prev,
    );
  };

  const handleDeleteCard = async (card: CardRecord) => {
    if (!window.confirm(`Eliminare "${card.name}" dalla collezione?`)) return;
    await deleteCard(card.id);
    setSetCards((prev) => prev.filter((c) => c.id !== card.id));
    setDetailCard(null);
    await loadData();
  };

  // =================================
  //  RENDER
  // =================================
  return (
    <div className="min-h-dvh bg-slate-50 pb-24 text-slate-900 dark:bg-slate-900 dark:text-slate-100 lg:pb-6">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white px-4 pt-6 pb-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Logo size={26} className="lg:hidden" />
            <h1 className="font-headline text-xl font-bold tracking-tight">
              Set
            </h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-700"
            title="Aggiorna elenco set da PokeWallet"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Aggiorna
          </button>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Avanzamento dei set in base alle carte scannerizzate.
        </p>
      </header>

      <main className="mx-auto max-w-6xl space-y-3 px-4 pt-4">
        <div className="relative lg:max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca un set per nome o codice..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {errorMessage}
          </div>
        )}

        <SetsListSection
          sets={visibleSets}
          loading={loading}
          emptyMessage="Nessun set trovato con questo nome o codice."
          onSelectSet={handleSelectSet}
        />
      </main>

      {selectedSet && (
        <SetDetailSection
          entry={selectedSet}
          cards={setCards}
          loading={loadingSetCards}
          onClose={() => setSelectedSet(null)}
          onSelectCard={setDetailCard}
        />
      )}

      {detailCard && (
        <CardDetailSection
          card={detailCard}
          onClose={() => setDetailCard(null)}
          onToggleFavorite={handleToggleFavorite}
          onDelete={handleDeleteCard}
          onRefreshPrice={handleRefreshPrice}
          onUpdateNotes={handleUpdateNotes}
        />
      )}
    </div>
  );
}
