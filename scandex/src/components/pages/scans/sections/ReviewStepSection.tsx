// =================================
//  IMPORTS
// =================================
import { AlertTriangle, RefreshCw, Search } from "lucide-react";

// =================================
//  COMPONENT
// =================================
export default function ReviewStepSection({
  capturedUrl,
  cardName,
  cardNumber,
  ocrRawText,
  errorMessage,
  onCardNameChange,
  onCardNumberChange,
  onRetake,
  onSearch,
}: {
  capturedUrl: string | null;
  cardName: string;
  cardNumber: string;
  ocrRawText: string;
  errorMessage: string | null;
  onCardNameChange: (value: string) => void;
  onCardNumberChange: (value: string) => void;
  onRetake: () => void;
  onSearch: () => void;
}) {
  // =================================
  //  RENDER
  // =================================
  return (
    <div className="flex flex-col gap-4">
      {capturedUrl && (
        <img
          src={capturedUrl}
          alt="Carta catturata"
          className="mx-auto h-48 rounded-xl object-cover shadow-sm"
        />
      )}

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {errorMessage}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
          Nome carta
        </label>
        <input
          type="text"
          value={cardName}
          onChange={(e) => onCardNameChange(e.target.value)}
          placeholder="Es. Zapdos"
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-700"
        />
        <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
          Numero carta (solo la parte prima della barra, es. 065)
        </label>
        <input
          type="text"
          value={cardNumber}
          onChange={(e) => onCardNumberChange(e.target.value)}
          placeholder="Es. 065"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-700"
        />

        {ocrRawText && (
          <details className="mt-3 text-xs text-slate-400">
            <summary className="cursor-pointer select-none">
              Testo grezzo riconosciuto
            </summary>
            <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-slate-500">
              {ocrRawText}
            </pre>
          </details>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onRetake}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <RefreshCw size={16} />
          Rifai foto
        </button>
        <button
          onClick={onSearch}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500"
        >
          <Search size={16} />
          Cerca carta
        </button>
      </div>
    </div>
  );
}
