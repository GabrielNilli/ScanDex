// =================================
//  IMPORTS
// =================================
import { Heart, Layers, Plus, Trash2, X } from "lucide-react";
import type { CollectionWithCount } from "../../../../services/collections/collectionsService.ts";

// =================================
//  COMPONENT
// =================================
export default function CollectionsGridSection({
  collections,
  showNewCollectionForm,
  newCollectionName,
  onShowNewCollectionForm,
  onNewCollectionNameChange,
  onCreateCollection,
  onCancelNewCollection,
  onSelectCollection,
  onDeleteCollection,
  onOpenFavorites,
}: {
  collections: CollectionWithCount[];
  showNewCollectionForm: boolean;
  newCollectionName: string;
  onShowNewCollectionForm: () => void;
  onNewCollectionNameChange: (value: string) => void;
  onCreateCollection: () => void;
  onCancelNewCollection: () => void;
  onSelectCollection: (collection: CollectionWithCount) => void;
  onDeleteCollection: (collection: CollectionWithCount) => void;
  onOpenFavorites: () => void;
}) {
  // =================================
  //  RENDER
  // =================================
  return (
    <div className="space-y-4">
      <div className="flex gap-2 lg:max-w-md">
        <button
          onClick={onShowNewCollectionForm}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-500"
        >
          <Plus size={16} />
          Nuova collezione
        </button>
        <button
          onClick={onOpenFavorites}
          className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Heart size={16} />
          Preferiti
        </button>
      </div>

      {showNewCollectionForm && (
        <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:max-w-md">
          <input
            autoFocus
            type="text"
            value={newCollectionName}
            onChange={(e) => onNewCollectionNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCreateCollection()}
            placeholder="Nome della collezione..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
          />
          <button
            onClick={onCreateCollection}
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            Crea
          </button>
          <button
            onClick={onCancelNewCollection}
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {collections.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <Layers
            className="mx-auto mb-3 text-slate-300 dark:text-slate-600"
            size={32}
          />
          <h3 className="text-base font-semibold">Nessuna collezione ancora</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            Crea una collezione per iniziare a organizzare le carte che
            scannerizzi.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
            >
              <button
                onClick={() => onSelectCollection(collection)}
                className="flex flex-1 flex-col p-4 text-left"
              >
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                  <Layers size={22} />
                </div>
                <h4 className="line-clamp-1 text-sm font-semibold">
                  {collection.name}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {collection.cardCount}{" "}
                  {collection.cardCount === 1 ? "carta" : "carte"}
                </p>
              </button>
              <button
                onClick={() => onDeleteCollection(collection)}
                className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-slate-400 shadow-sm transition-colors hover:text-red-600 dark:bg-slate-700/90"
                title="Elimina collezione"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
