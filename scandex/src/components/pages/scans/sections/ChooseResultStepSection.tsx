// =================================
//  IMPORTS
// =================================
import type { PokewalletSearchResult } from "../../../../services/pokewallet/pokewalletApi.ts";

// =================================
//  COMPONENT
// =================================
export default function ChooseResultStepSection({
  results,
  onSelect,
  onBack,
}: {
  results: PokewalletSearchResult[];
  onSelect: (result: PokewalletSearchResult) => void;
  onBack: () => void;
}) {
  // =================================
  //  RENDER
  // =================================
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Sono state trovate {results.length} carte corrispondenti. Seleziona
        quella corretta:
      </p>
      {results.map((result) => (
        <button
          key={result.id}
          onClick={() => onSelect(result)}
          className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-amber-500 dark:border-slate-700 dark:bg-slate-800"
        >
          <span className="text-sm font-semibold">
            {result.card_info.name}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {result.card_info.set_name} &bull; #{result.card_info.card_number}{" "}
            &bull; {result.card_info.rarity}
          </span>
        </button>
      ))}
      <button
        onClick={onBack}
        className="mt-1 text-center text-xs text-slate-500 underline dark:text-slate-400"
      >
        Torna indietro e modifica la ricerca
      </button>
    </div>
  );
}
