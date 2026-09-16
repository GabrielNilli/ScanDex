/**
 * Servizio per la gestione delle collezioni (CRUD) nel database SQLite OPFS.
 */

import { dbService } from "../db/index.ts";
import type { CollectionRecord } from "../db/types.ts";
import { deleteImage } from "../opfs/images.ts";

export interface CollectionWithCount extends CollectionRecord {
  cardCount: number;
}

/**
 * Crea una nuova collezione.
 */
export async function createCollection(
  name: string,
): Promise<CollectionRecord> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Il nome della collezione non può essere vuoto.");
  }
  const { lastInsertRowId } = await dbService.run(
    "INSERT INTO collections (name) VALUES (?)",
    [trimmed],
  );
  return { id: lastInsertRowId, name: trimmed };
}

/**
 * Elenca tutte le collezioni con il conteggio delle carte associate.
 */
export async function listCollections(): Promise<CollectionWithCount[]> {
  return dbService.query<CollectionWithCount>(`
    SELECT c.id, c.name, c.created_at,
           (SELECT COUNT(*) FROM cards WHERE cards.collection_id = c.id) as cardCount
    FROM collections c
    ORDER BY c.created_at DESC, c.id DESC
  `);
}

/**
 * Recupera una singola collezione per id.
 */
export async function getCollection(
  id: number,
): Promise<CollectionRecord | null> {
  const rows = await dbService.query<CollectionRecord>(
    "SELECT * FROM collections WHERE id = ?",
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Rinomina una collezione esistente.
 */
export async function renameCollection(
  id: number,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Il nome della collezione non può essere vuoto.");
  }
  await dbService.exec("UPDATE collections SET name = ? WHERE id = ?", [
    trimmed,
    id,
  ]);
}

/**
 * Elimina una collezione. Le carte al suo interno vengono eliminate insieme
 * alle relative immagini salvate in OPFS.
 */
export async function deleteCollection(id: number): Promise<void> {
  const cards = await dbService.query<{ image_path: string | null }>(
    "SELECT image_path FROM cards WHERE collection_id = ?",
    [id],
  );
  await dbService.exec("DELETE FROM cards WHERE collection_id = ?", [id]);
  await dbService.exec("DELETE FROM collections WHERE id = ?", [id]);

  await Promise.all(
    cards
      .filter((c) => c.image_path)
      .map((c) => deleteImage(c.image_path as string)),
  );
}
