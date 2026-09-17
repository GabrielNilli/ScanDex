/**
 * Esportazione/importazione di un backup completo (collezioni, carte e immagini)
 * in un unico file JSON, per spostare i dati su un altro dispositivo o browser.
 *
 * Essendo tutto salvato in OPFS (privato all'origine del browser), non c'è altro
 * modo per trasferire i dati: questo file JSON include le immagini codificate in
 * base64 al suo interno, così un solo file basta per il trasferimento completo.
 */

import { dbService } from "../db/index.ts";
import type { CardRecord } from "../db/types.ts";
import { getImageBlob, saveImage } from "../opfs/images.ts";
import {
  createCollection,
  listCollections,
} from "../collections/collectionsService.ts";
import { listAllCards } from "../cards/cardsService.ts";

const BACKUP_APP_ID = "ScanDex";
const BACKUP_VERSION = 1;

interface BackupCollection {
  name: string;
}

interface BackupCard {
  pokewallet_id: string;
  name: string;
  clean_name: string | null;
  card_number: string | null;
  set_name: string | null;
  set_code: string | null;
  set_id: string | null;
  rarity: string | null;
  card_type: string | null;
  favorite: number;
  raw_json: string | null;
  notes: string | null;
  created_at?: string;
  collectionName: string | null;
  imageDataUrl: string | null;
}

interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  collections: BackupCollection[];
  cards: BackupCard[];
}

export interface ImportResult {
  importedCards: number;
  skippedCards: number;
  importedCollections: number;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(header)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Esporta tutte le collezioni e le carte (immagini incluse) in un file JSON e
 * ne avvia il download nel browser.
 */
export async function exportBackup(): Promise<{ cardCount: number }> {
  const [collections, cards] = await Promise.all([
    listCollections(),
    listAllCards(),
  ]);
  const collectionNameById = new Map(collections.map((c) => [c.id, c.name]));

  const backupCards: BackupCard[] = [];
  for (const card of cards) {
    let imageDataUrl: string | null = null;
    if (card.image_path) {
      const blob = await getImageBlob(card.image_path);
      if (blob) imageDataUrl = await blobToDataUrl(blob);
    }
    backupCards.push({
      pokewallet_id: card.pokewallet_id,
      name: card.name,
      clean_name: card.clean_name,
      card_number: card.card_number,
      set_name: card.set_name,
      set_code: card.set_code,
      set_id: card.set_id,
      rarity: card.rarity,
      card_type: card.card_type,
      favorite: card.favorite,
      raw_json: card.raw_json,
      notes: card.notes,
      created_at: card.created_at,
      collectionName: card.collection_id
        ? (collectionNameById.get(card.collection_id) ?? null)
        : null,
      imageDataUrl,
    });
  }

  const backup: BackupFile = {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    collections: collections.map((c) => ({ name: c.name })),
    cards: backupCards,
  };

  const blob = new Blob([JSON.stringify(backup)], {
    type: "application/json",
  });
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `scandex-backup-${dateStamp}.json`);

  return { cardCount: backupCards.length };
}

/**
 * Importa un file di backup: crea le collezioni mancanti (per nome, non per id,
 * dato che gli id locali possono differire tra dispositivi) e le carte non ancora
 * presenti (deduplicate per pokewallet_id, per poter importare più volte lo stesso
 * file senza creare doppioni).
 */
export async function importBackup(file: File): Promise<ImportResult> {
  const text = await file.text();
  let backup: BackupFile;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("Il file selezionato non è un JSON valido.");
  }

  if (backup.app !== BACKUP_APP_ID || backup.version !== BACKUP_VERSION) {
    throw new Error("Questo file non è un backup di ScanDex compatibile.");
  }

  const existingCollections = await listCollections();
  const collectionIdByName = new Map(
    existingCollections.map((c) => [c.name, c.id]),
  );

  let importedCollections = 0;
  for (const bc of backup.collections ?? []) {
    if (!collectionIdByName.has(bc.name)) {
      const created = await createCollection(bc.name);
      collectionIdByName.set(bc.name, created.id);
      importedCollections++;
    }
  }

  const existingCards = await listAllCards();
  const existingPokewalletIds = new Set(
    existingCards.map((c: CardRecord) => c.pokewallet_id),
  );

  let importedCards = 0;
  let skippedCards = 0;

  for (const card of backup.cards ?? []) {
    if (existingPokewalletIds.has(card.pokewallet_id)) {
      skippedCards++;
      continue;
    }

    let imagePath: string | null = null;
    if (card.imageDataUrl) {
      const blob = dataUrlToBlob(card.imageDataUrl);
      const extension = blob.type === "image/webp" ? "webp" : "jpg";
      imagePath = await saveImage(`${card.pokewallet_id}.${extension}`, blob);
    }

    const collectionId = card.collectionName
      ? (collectionIdByName.get(card.collectionName) ?? null)
      : null;

    await dbService.run(
      `INSERT INTO cards
        (collection_id, pokewallet_id, name, clean_name, card_number, set_name, set_code, set_id, rarity, card_type, image_path, favorite, raw_json, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        collectionId,
        card.pokewallet_id,
        card.name,
        card.clean_name,
        card.card_number,
        card.set_name,
        card.set_code,
        card.set_id,
        card.rarity,
        card.card_type,
        imagePath,
        card.favorite,
        card.raw_json,
        card.notes ?? null,
      ],
    );

    existingPokewalletIds.add(card.pokewallet_id);
    importedCards++;
  }

  return { importedCards, skippedCards, importedCollections };
}
