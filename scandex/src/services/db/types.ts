/**
 * Tipi e interfacce per il database SQLite su OPFS.
 */

export interface CollectionRecord {
  id: number;
  name: string;
  created_at?: string;
}

export interface CardRecord {
  id: number;
  collection_id: number | null;
  pokewallet_id: string;
  name: string;
  clean_name: string | null;
  card_number: string | null;
  set_name: string | null;
  set_code: string | null;
  set_id: string | null; // Id univoco del set (a differenza di set_code, non condiviso tra set diversi)
  rarity: string | null;
  card_type: string | null;
  image_path: string | null; // Percorso del file in OPFS, es: "images/pk_xxx.jpg"
  favorite: number; // 0 o 1 (SQLite non ha un booleano nativo)
  raw_json: string | null; // Risposta grezza dell'API pokewallet per quel risultato
  created_at?: string;
}

export interface SetRecord {
  set_id: string;
  name: string;
  set_code: string;
  card_count: number;
  language: string;
  release_date: string | null;
  cached_at?: string;
}

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export type WorkerAction =
  | { type: "INIT" }
  | { type: "QUERY"; sql: string; params?: unknown[] }
  | { type: "EXEC"; sql: string; params?: unknown[] }
  | { type: "RUN"; sql: string; params?: unknown[] }
  | { type: "UPSERT_SETS"; sets: SetRecord[] }
  | { type: "CLEAR" }
  | { type: "GET_STATS" };

export interface WorkerRequestEnvelope {
  requestId: string;
  action: WorkerAction;
}

export interface WorkerResponseEnvelope<T = unknown> {
  requestId: string;
  success: boolean;
  data?: T;
  error?: string;
}

export interface DbStats {
  cardsCount: number;
  collectionsCount: number;
  favoritesCount: number;
  isOpfs: boolean;
  dbFilename: string;
  sqliteVersion: string;
}

export interface DbInitResult {
  isOpfs: boolean;
  sqliteVersion: string;
  dbFilename: string;
}
