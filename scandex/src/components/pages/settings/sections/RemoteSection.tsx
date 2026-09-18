// =================================
//  IMPORTS
// =================================
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Smartphone,
  Unlink,
  Wifi,
} from "lucide-react";
import {
  disconnect,
  getStatus,
  hostSession,
  joinSession,
  subscribeStatus,
  type RemoteStatus,
} from "../../../../services/remote/remoteService.ts";

// =================================
//  COMPONENT
// =================================
export default function RemoteSection() {
  const [status, setStatus] = useState<RemoteStatus>(() => getStatus());
  const [codeInput, setCodeInput] = useState("");
  const [mode, setMode] = useState<"idle" | "host" | "join">("idle");

  useEffect(() => subscribeStatus(setStatus), []);

  const handleHost = async () => {
    setMode("host");
    try {
      await hostSession();
    } catch {
      // l'errore è già riflesso in status.error
    }
  };

  const handleJoin = async () => {
    if (!codeInput.trim()) return;
    try {
      await joinSession(codeInput);
    } catch {
      // l'errore è già riflesso in status.error
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setMode("idle");
    setCodeInput("");
  };

  // =================================
  //  RENDER
  // =================================
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Smartphone size={16} className="text-amber-600 dark:text-amber-400" />
        Scansione da telefono
      </h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Collega telefono e PC: scansiona le carte dal telefono e vedile
        comparire automaticamente qui, senza passarle a mano.
      </p>

      {status.role && (status.connected || status.connecting) ? (
        <div className="space-y-3">
          <div
            className={`flex items-center gap-2 rounded-xl p-3 text-sm ${
              status.connected
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-slate-50 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {status.connected ? (
              <Wifi size={16} className="shrink-0" />
            ) : (
              <Loader2 size={16} className="shrink-0 animate-spin" />
            )}
            <span>
              {status.role === "host"
                ? status.connected
                  ? "Telefono collegato: le scansioni arriveranno qui."
                  : `In attesa del telefono. Codice: ${status.code}`
                : status.connected
                  ? "Collegato al PC: le scansioni verranno inviate lì."
                  : "Collegamento al PC in corso..."}
            </span>
          </div>

          {status.role === "host" && status.connected && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Vai alla pagina "Scansiona carta" per vedere l'anteprima del
              telefono e scattare da qui.
            </p>
          )}

          {status.role === "host" && status.code && (
            <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-700">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Inserisci questo codice nel telefono, sezione Impostazioni
              </p>
              <p className="font-headline mt-1 text-2xl font-bold tracking-[0.3em] text-amber-600 dark:text-amber-400">
                {status.code}
              </p>
            </div>
          )}

          <button
            onClick={handleDisconnect}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Unlink size={13} />
            Disconnetti
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("host")}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                mode === "host"
                  ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                  : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              Sono il PC
            </button>
            <button
              onClick={() => setMode("join")}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                mode === "join"
                  ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                  : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              Sono il telefono
            </button>
          </div>

          {mode === "host" && (
            <button
              onClick={handleHost}
              className="w-full rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500"
            >
              Genera codice sessione
            </button>
          )}

          {mode === "join" && (
            <div className="flex gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="Codice dal PC"
                maxLength={5}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase tracking-widest dark:border-slate-600 dark:bg-slate-700"
              />
              <button
                onClick={handleJoin}
                disabled={!codeInput.trim()}
                className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
              >
                Collega
              </button>
            </div>
          )}

          {status.error && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {status.error}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
