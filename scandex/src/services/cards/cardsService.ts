/**
 * Servizio per la gestione delle carte scannerizzate (CRUD) nel database SQLite OPFS.
 */

import { dbService } from "../db/index.ts";
import type { CardRecord } from "../db/types.ts";
import { deleteImage, saveImage } from "../opfs/images.ts";
import {
  fetchCardById,
  type PokewalletSearchResult,
} from "../pokewallet/pokewalletApi.ts";

export interface NewCardInput {
  collectionId: number | null;
  result: PokewalletSearchResult;
  imageBlob: Blob;
}

/**
 * Salva una nuova carta: scrive l'immagine in OPFS (/images) e il record in SQLite.
 */
export async function saveScannedCard({
  collectionId,
  result,
  imageBlob,
}: NewCardInput): Promise<CardRecord> {
  const extension = imageBlob.type === "image/webp" ? "webp" : "jpg";
  const filename = `${result.id}.${extension}`;
  const imagePath = await saveImage(filename, imageBlob);

  const info = result.card_info;
  const { lastInsertRowId } = await dbService.run(
    `INSERT INTO cards
      (collection_id, pokewallet_id, name, clean_name, card_number, set_name, set_code, set_id, rarity, card_type, image_path, favorite, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      collectionId,
      result.id,
      info.name,
      info.clean_name ?? null,
      info.card_number ?? null,
      info.set_name ?? null,
      info.set_code ?? null,
      info.set_id ?? null,
      info.rarity ?? null,
      info.card_type ?? null,
      imagePath,
      JSON.stringify(result),
    ],
  );

  const rows = await dbService.query<CardRecord>(
    "SELECT * FROM cards WHERE id = ?",
    [lastInsertRowId],
  );
  return rows[0];
}

/**
 * Elenca le carte di una collezione specifica (o tutte se collectionId è null).
 */
export async function listCardsByCollection(
  collectionId: number,
): Promise<CardRecord[]> {
  return dbService.query<CardRecord>(
    "SELECT * FROM cards WHERE collection_id = ? ORDER BY created_at DESC, id DESC",
    [collectionId],
  );
}

/**
 * Elenca tutte le carte salvate, indipendentemente dalla collezione. Usato per calcolare
 * statistiche complessive (es. valore totale della collezione).
 */
export async function listAllCards(): Promise<CardRecord[]> {
  return dbService.query<CardRecord>(
    "SELECT * FROM cards ORDER BY created_at DESC, id DESC",
  );
}

/**
 * Elenca le carte possedute di un determinato set (per set_id).
 */
export async function listCardsBySetId(setId: string): Promise<CardRecord[]> {
  return dbService.query<CardRecord>(
    "SELECT * FROM cards WHERE set_id = ? ORDER BY card_number ASC, id DESC",
    [setId],
  );
}

/**
 * Conta quante carte possedute appartengono a ciascun set (per set_id), con
 * un'unica aggregazione SQL invece di caricare tutte le carte in memoria.
 */
export async function getCardCountsBySetId(): Promise<Map<string, number>> {
  const rows = await dbService.query<{ set_id: string; count: number }>(
    "SELECT set_id, COUNT(*) as count FROM cards WHERE set_id IS NOT NULL GROUP BY set_id",
  );
  return new Map(rows.map((r) => [r.set_id, Number(r.count)]));
}

/**
 * Backfill una tantum di set_id per le carte salvate prima che questa colonna
 * esistesse: lo ricava dal raw_json già presente, senza richiamare l'API.
 */
export async function migrateMissingSetIds(): Promise<void> {
  const rows = await dbService.query<{ id: number; raw_json: string }>(
    "SELECT id, raw_json FROM cards WHERE set_id IS NULL AND raw_json IS NOT NULL",
  );
  if (rows.length === 0) return;

  for (const row of rows) {
    try {
      const parsed: PokewalletSearchResult = JSON.parse(row.raw_json);
      const setId = parsed.card_info?.set_id;
      if (setId) {
        await dbService.exec("UPDATE cards SET set_id = ? WHERE id = ?", [
          setId,
          row.id,
        ]);
      }
    } catch {
      // raw_json non valido per questa riga, si ignora
    }
  }
}

/**
 * Elenca tutte le carte contrassegnate come preferite, indipendentemente dalla collezione.
 */
export async function listFavoriteCards(): Promise<CardRecord[]> {
  return dbService.query<CardRecord>(
    "SELECT * FROM cards WHERE favorite = 1 ORDER BY created_at DESC, id DESC",
  );
}

/**
 * Recupera una singola carta per id.
 */
export async function getCard(id: number): Promise<CardRecord | null> {
  const rows = await dbService.query<CardRecord>(
    "SELECT * FROM cards WHERE id = ?",
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Imposta o rimuove lo stato di preferito per una carta.
 */
export async function setFavorite(
  id: number,
  favorite: boolean,
): Promise<void> {
  await dbService.exec("UPDATE cards SET favorite = ? WHERE id = ?", [
    favorite ? 1 : 0,
    id,
  ]);
}

/**
 * Ricarica dati e prezzi aggiornati di una carta da pokewallet e li salva nel raw_json,
 * senza toccare l'immagine o gli altri campi già salvati (nome, numero, ecc. restano
 * quelli scelti al momento dello scan anche se pokewallet li avesse nel frattempo
 * corretti, per non stupire l'utente con un cambio di identità della carta).
 */
export async function refreshCardPricing(id: number): Promise<CardRecord> {
  const card = await getCard(id);
  if (!card) {
    throw new Error("Carta non trovata.");
  }

  const fresh = await fetchCardById(card.pokewallet_id);
  await dbService.exec(
    "UPDATE cards SET raw_json = ?, set_id = ? WHERE id = ?",
    [JSON.stringify(fresh), fresh.card_info.set_id ?? null, id],
  );

  const updated = await getCard(id);
  return updated ?? card;
}

/**
 * Elimina una carta e la relativa immagine salvata in OPFS.
 */
export async function deleteCard(id: number): Promise<void> {
  const card = await getCard(id);
  await dbService.exec("DELETE FROM cards WHERE id = ?", [id]);
  if (card?.image_path) {
    await deleteImage(card.image_path);
  }
}
