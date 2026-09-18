// =================================
//  IMPORTS
// =================================
import { useState } from "react";
import { ExternalLink, Gauge, RefreshCw } from "lucide-react";
import type { RateLimitStatus } from "../../../../services/pokewallet/rateLimitTracker.ts";

// =================================
//  COMPONENT
// =================================
export default function ApiUsageSection({
  status,
  onCalibrate,
}: {
  status: RateLimitStatus;
  onCalibrate: (remainingHour: number, remainingDay: number) => void;
}) {
  const [showCalibrate, setShowCalibrate] = useState(false);
  const [hourInput, setHourInput] = useState("");
  const [dayInput, setDayInput] = useState("");

  const handleCalibrate = () => {
    const hour = Number(hourInput);
    const day = Number(dayInput);
    if (!Number.isFinite(hour) || !Number.isFinite(day)) return;
    onCalibrate(hour, day);
    setShowCalibrate(false);
    setHourInput("");
    setDayInput("");
  };

  // =================================
  //  RENDER
  // =================================
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Gauge size={16} className="text-amber-600 dark:text-amber-400" />
        Chiamate API PokeWallet
      </h2>

      <div className="space-y-3">
        <UsageBar
          label="Questa ora"
          remaining={status.remainingHour}
          limit={status.limitHour}
        />
        <UsageBar
          label="Oggi"
          remaining={status.remainingDay}
          limit={status.limitDay}
        />
      </div>

      <div className="mt-3 space-y-2">
        <a
          href="https://pokewallet.io/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 hover:underline dark:text-amber-400"
        >
          <ExternalLink size={11} />
          Vedi le rimanenze sul dashboard PokeWallet
        </a>

        {!showCalibrate ? (
          <button
            onClick={() => setShowCalibrate(true)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 hover:underline dark:text-amber-400"
          >
            <RefreshCw size={11} />
            Risincronizza manualmente
          </button>
        ) : (
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700">
            <div className="flex gap-2">
              <input
                type="number"
                value={hourInput}
                onChange={(e) => setHourInput(e.target.value)}
                placeholder="Rimaste ora"
                className="w-1/2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <input
                type="number"
                value={dayInput}
                onChange={(e) => setDayInput(e.target.value)}
                placeholder="Rimaste oggi"
                className="w-1/2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleCalibrate}
                disabled={hourInput === "" || dayInput === ""}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-40"
              >
                Sincronizza
              </button>
              <button
                onClick={() => setShowCalibrate(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function UsageBar({
  label,
  remaining,
  limit,
}: {
  label: string;
  remaining: number;
  limit: number;
}) {
  const used = Math.max(0, limit - remaining);
  const percentUsed = limit > 0 ? (used / limit) * 100 : 0;
  const low = remaining <= limit * 0.1;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span
          className={`font-semibold ${
            low
              ? "text-red-600 dark:text-red-400"
              : "text-slate-700 dark:text-slate-200"
          }`}
        >
          {remaining}/{limit} rimaste
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={`h-full rounded-full ${low ? "bg-red-500" : "bg-amber-500"}`}
          style={{ width: `${Math.min(100, percentUsed)}%` }}
        />
      </div>
    </div>
  );
}
