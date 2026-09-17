/// <reference lib="webworker" />

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import sqlite3WasmUrl from "@sqlite.org/sqlite-wasm/sqlite3.wasm?url";
import type {
  DbInitResult,
  DbStats,
  SetRecord,
  WorkerAction,
  WorkerRequestEnvelope,
  WorkerResponseEnvelope,
} from "./types.ts";

const DB_FILENAME = "/scandex.sqlite3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
let isOpfs = false;
let sqliteVersion = "";

/**
 * Inizializza SQLite WASM e apre il database su OPFS (con fallback a transient se non supportato).
 */
async function initDb(): Promise<DbInitResult> {
  if (db) {
    return { isOpfs, sqliteVersion, dbFilename: DB_FILENAME };
  }

  const sqlite3 = await sqlite3InitModule({
    locateFile: (file: string) => {
      if (file === "sqlite3.wasm") {
        return sqlite3WasmUrl;
      }
      return file;
    },
  });

  sqliteVersion = sqlite3.version.libVersion;

  if (sqlite3.oo1.OpfsDb) {
    try {
      db = new sqlite3.oo1.OpfsDb(DB_FILENAME, "c");
      isOpfs = true;
      console.log(
        `[SQLite Worker] DB OPFS aperto con successo: ${DB_FILENAME}`,
      );
    } catch (err) {
      console.warn(
        "[SQLite Worker] Errore apertura OpfsDb, fallback a transient DB:",
        err,
      );
      db = new sqlite3.oo1.DB(DB_FILENAME, "c");
      isOpfs = false;
    }
  } else {
    console.warn(
      "[SQLite Worker] OPFS VFS non disponibile in questo worker, uso DB transient.",
    );
    db = new sqlite3.oo1.DB(DB_FILENAME, "c");
    isOpfs = false;
  }

  // Creazione tabelle e indici
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
      pokewallet_id TEXT NOT NULL,
      name TEXT NOT NULL,
      clean_name TEXT,
      card_number TEXT,
      set_name TEXT,
      set_code TEXT,
      set_id TEXT,
      rarity TEXT,
      card_type TEXT,
      image_path TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      raw_json TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sets (
      set_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      set_code TEXT,
      card_count INTEGER NOT NULL DEFAULT 0,
      language TEXT,
      release_date TEXT,
      cached_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_cards_collection ON cards(collection_id);
    CREATE INDEX IF NOT EXISTS idx_cards_favorite ON cards(favorite);
  `);

  // Migrazione: i database creati prima dell'introduzione di queste colonne non le hanno.
  // set_id va verificato ed eventualmente aggiunto PRIMA di creare l'indice su quella
  // colonna, altrimenti su un DB preesistente l'indice fallirebbe con "no such column".
  const cardColumns = db.selectObjects("PRAGMA table_info(cards);");
  const columnNames = new Set(
    cardColumns.map((c: { name: string }) => c.name),
  );
  if (!columnNames.has("set_id")) {
    db.exec("ALTER TABLE cards ADD COLUMN set_id TEXT;");
  }
  if (!columnNames.has("notes")) {
    db.exec("ALTER TABLE cards ADD COLUMN notes TEXT;");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_cards_set_id ON cards(set_id);");

  return { isOpfs, sqliteVersion, dbFilename: DB_FILENAME };
}

/**
 * Esegue un'azione sul DB e restituisce il risultato.
 */
async function handleAction(action: WorkerAction): Promise<unknown> {
  if (action.type === "INIT") {
    return await initDb();
  }

  // Per tutte le altre azioni, assicurarsi che il DB sia inizializzato
  if (!db) {
    await initDb();
  }

  switch (action.type) {
    case "QUERY": {
      const rows = db.selectObjects(action.sql, action.params ?? []);
      return rows;
    }

    case "EXEC": {
      db.exec({
        sql: action.sql,
        bind: action.params ?? [],
      });
      return true;
    }

    case "RUN": {
      db.exec({
        sql: action.sql,
        bind: action.params ?? [],
      });
      const changes = db.changes();
      const lastInsertRowId = Number(
        db.selectValue("SELECT last_insert_rowid();"),
      );
      return { changes, lastInsertRowId };
    }

    case "UPSERT_SETS": {
      const sets: SetRecord[] = action.sets;
      if (!sets || sets.length === 0) return 0;

      db.exec("BEGIN TRANSACTION;");
      try {
        const stmt = db.prepare(`
          INSERT INTO sets (set_id, name, set_code, card_count, language, release_date, cached_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(set_id) DO UPDATE SET
            name = excluded.name,
            set_code = excluded.set_code,
            card_count = excluded.card_count,
            language = excluded.language,
            release_date = excluded.release_date,
            cached_at = excluded.cached_at
        `);
        try {
          for (const s of sets) {
            stmt.bind([
              s.set_id,
              s.name,
              s.set_code,
              s.card_count,
              s.language,
              s.release_date,
            ]);
            stmt.step();
            stmt.reset();
          }
        } finally {
          stmt.finalize();
        }
        db.exec("COMMIT;");
        return sets.length;
      } catch (err) {
        db.exec("ROLLBACK;");
        throw err;
      }
    }

    case "CLEAR": {
      db.exec("DELETE FROM cards; DELETE FROM collections; DELETE FROM sets;");
      return true;
    }

    case "GET_STATS": {
      const cardsRow = db.selectObjects("SELECT COUNT(*) as count FROM cards;");
      const collectionsRow = db.selectObjects(
        "SELECT COUNT(*) as count FROM collections;",
      );
      const favoritesRow = db.selectObjects(
        "SELECT COUNT(*) as count FROM cards WHERE favorite = 1;",
      );
      const stats: DbStats = {
        cardsCount: Number(cardsRow[0]?.count ?? 0),
        collectionsCount: Number(collectionsRow[0]?.count ?? 0),
        favoritesCount: Number(favoritesRow[0]?.count ?? 0),
        isOpfs,
        dbFilename: DB_FILENAME,
        sqliteVersion,
      };
      return stats;
    }

    default:
      throw new Error(
        `Azione non riconosciuta: ${(action as { type: string }).type}`,
      );
  }
}

// Ascolto messaggi dal thread principale
self.onmessage = async (event: MessageEvent<WorkerRequestEnvelope>) => {
  const { requestId, action } = event.data;

  try {
    const result = await handleAction(action);
    const response: WorkerResponseEnvelope = {
      requestId,
      success: true,
      data: result,
    };
    self.postMessage(response);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[SQLite Worker Error]:", err);
    const response: WorkerResponseEnvelope = {
      requestId,
      success: false,
      error: errorMsg,
    };
    self.postMessage(response);
  }
};
