/**
 * Client service per interagire con il Web Worker SQLite OPFS.
 * Utilizza pattern Request/Response con Promise e requestId univoci.
 */

import type {
  DbInitResult,
  DbStats,
  RunResult,
  SetRecord,
  WorkerAction,
  WorkerRequestEnvelope,
  WorkerResponseEnvelope,
} from "./types.ts";

class DbService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
    }
  >();
  private initPromise: Promise<DbInitResult> | null = null;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL("./db.worker.ts", import.meta.url), {
        type: "module",
      });

      this.worker.onmessage = (event: MessageEvent<WorkerResponseEnvelope>) => {
        const { requestId, success, data, error } = event.data;
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          this.pendingRequests.delete(requestId);
          if (success) {
            pending.resolve(data);
          } else {
            pending.reject(
              new Error(error || "Errore sconosciuto nel database"),
            );
          }
        }
      };

      this.worker.onerror = (event) => {
        console.error("[DbService] Errore critico nel worker:", event);
      };
    }
    return this.worker;
  }

  private sendAction<T>(action: WorkerAction): Promise<T> {
    const worker = this.getWorker();
    const requestId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      const envelope: WorkerRequestEnvelope = {
        requestId,
        action,
      };

      worker.postMessage(envelope);
    });
  }

  /**
   * Inizializza il database SQLite su OPFS.
   * Chiamate multiple condividono la stessa Promise di inizializzazione.
   */
  public async init(): Promise<DbInitResult> {
    if (!this.initPromise) {
      this.initPromise = this.sendAction<DbInitResult>({ type: "INIT" });
    }
    return this.initPromise;
  }

  /**
   * Esegue una query SQL SELECT e restituisce le righe tipizzate.
   */
  public async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]> {
    await this.init();
    return this.sendAction<T[]>({ type: "QUERY", sql, params });
  }

  /**
   * Esegue un comando SQL senza ritornare righe (es. UPDATE, DELETE).
   */
  public async exec(sql: string, params?: unknown[]): Promise<void> {
    await this.init();
    await this.sendAction<void>({ type: "EXEC", sql, params });
  }

  /**
   * Esegue un comando SQL (tipicamente INSERT) e restituisce l'id generato.
   */
  public async run(sql: string, params?: unknown[]): Promise<RunResult> {
    await this.init();
    return this.sendAction<RunResult>({ type: "RUN", sql, params });
  }

  /**
   * Inserisce o aggiorna in blocco l'elenco dei set (upsert per set_id), in un'unica
   * transazione lato worker per evitare centinaia di round-trip separati.
   */
  public async upsertSets(sets: SetRecord[]): Promise<number> {
    await this.init();
    return this.sendAction<number>({ type: "UPSERT_SETS", sets });
  }

  /**
   * Svuota tutte le tabelle del database (collezioni e carte).
   */
  public async clearAll(): Promise<void> {
    await this.init();
    await this.sendAction<void>({ type: "CLEAR" });
  }

  /**
   * Ottiene le statistiche del DB (conteggi, stato OPFS, versione SQLite).
   */
  public async getStats(): Promise<DbStats> {
    await this.init();
    return this.sendAction<DbStats>({ type: "GET_STATS" });
  }

  /**
   * Chiude il worker e resetta il servizio (se necessario).
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.initPromise = null;
      this.pendingRequests.clear();
    }
  }
}

// Singleton esportato per l'uso nell'app
export const dbService = new DbService();
