// =================================
//  IMPORTS
// =================================
import type { CollectionWithCount } from "../../../../services/collections/collectionsService.ts";

// =================================
//  COMPONENT
// =================================
export default function GeneralSection({
  collections,
  defaultCollectionId,
  onDefaultCollectionChange,
}: {
  collections: CollectionWithCount[];
  defaultCollectionId: number | "";
  onDefaultCollectionChange: (value: number | "") => void;
}) {
  // =================================
  //  RENDER
  // =================================
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-3 text-sm font-semibold">Generali</h2>
      <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
        Collezione predefinita per i nuovi scan
      </label>
      <select
        value={defaultCollectionId}
        onChange={(e) =>
          onDefaultCollectionChange(
            e.target.value === "" ? "" : Number(e.target.value),
          )
        }
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
      >
        <option value="">Chiedi ogni volta</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.cardCount})
          </option>
        ))}
      </select>
    </section>
  );
}
