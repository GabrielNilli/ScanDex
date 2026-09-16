// =================================
//  IMPORTS
// =================================
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import type { PokewalletSearchResult } from "../../../../services/pokewallet/pokewalletApi.ts";
import type { CollectionWithCount } from "../../../../services/collections/collectionsService.ts";

// =================================
//  COMPONENT
// =================================
export default function ConfirmStepSection({
  result,
  imageUrl,
  imageReady,
  errorMessage,
  collections,
  targetCollectionId,
  newCollectionName,
  creatingCollection,
  onTargetCollectionChange,
  onNewCollectionNameChange,
  onCreateCollection,
  onCancel,
  onSave,
}: {
  result: PokewalletSearchResult;
  imageUrl: string | null;
  imageReady: boolean;
  errorMessage: string | null;
  collections: CollectionWithCount[];
  targetCollectionId: number | "";
  newCollectionName: string;
  creatingCollection: boolean;
  onTargetCollectionChange: (value: number | "") => void;
  onNewCollectionNameChange: (value: string) => void;
  onCreateCollection: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  // =================================
  //  RENDER
  // =================================
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={result.card_info.name}
            className="h-64 rounded-xl object-cover shadow-md"
          />
        ) : (
          <div className="flex h-64 w-48 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <Loader2 className="animate-spin text-amber-500" size={24} />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h3 className="font-headline font-semibold">{result.card_info.name}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {result.card_info.set_name} &bull; #{result.card_info.card_number}{" "}
          &bull; {result.card_info.rarity}
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {errorMessage}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
          Salva nella collezione
        </label>
        <select
          value={targetCollectionId}
          onChange={(e) =>
            onTargetCollectionChange(
              e.target.value === "" ? "" : Number(e.target.value),
            )
          }
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
        >
          <option value="">Nessuna collezione</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.cardCount})
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => onNewCollectionNameChange(e.target.value)}
            placeholder="Nuova collezione..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
          />
          <button
            onClick={onCreateCollection}
            disabled={!newCollectionName.trim() || creatingCollection}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Crea
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <X size={16} />
          Annulla
        </button>
        <button
          onClick={onSave}
          disabled={!imageReady}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
        >
          <CheckCircle2 size={16} />
          Salva carta
        </button>
      </div>
    </div>
  );
}
