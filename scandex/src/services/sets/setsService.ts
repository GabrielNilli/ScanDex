/**
 * Servizio per la sezione "Set": elenco di tutti i set pokewallet (salvati nel
 * database SQLite OPFS, come collezioni e carte), con conteggio delle carte
 * possedute e mancanti per ciascuno.
 */

import { dbService } from "../db/index.ts";
import type { SetRecord } from "../db/types.ts";
import { fetchAllSets } from "../pokewallet/pokewalletApi.ts";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 ore: i set cambiano raramente

export interface SetProgress {
  set: SetRecord;
  owned: number;
  missing: number;
}

/**
 * Recupera l'elenco di tutti i set dal database locale se salvato di recente
 * (24h), altrimenti lo riscarica da pokewallet e lo salva. Gli 863+ set esistenti
 * cambiano raramente: la cache evita di consumare il budget di 100 richieste/ora
 * dell'API ad ogni apertura della pagina, ed essendo nel DB (non in localStorage)
 * è consultabile con query SQL come le altre entità dell'app.
 */
export async function getAllSets(forceRefresh = false): Promise<SetRecord[]> {
  if (!forceRefresh) {
    const stored = await dbService.query<SetRecord>(
      "SELECT * FROM sets ORDER BY name ASC",
    );
    if (stored.length > 0) {
      const newest = await dbService.query<{ cached_at: string }>(
        "SELECT MAX(cached_at) as cached_at FROM sets",
      );
      const cachedAt = newest[0]?.cached_at;
      const cachedAtMs = cachedAt
        ? Date.parse(`${cachedAt.replace(" ", "T")}Z`)
        : NaN;
      if (!Number.isNaN(cachedAtMs) && Date.now() - cachedAtMs < CACHE_TTL_MS) {
        return stored;
      }
    }
  }

  const fresh = await fetchAllSets();
  await dbService.upsertSets(fresh);
  return dbService.query<SetRecord>("SELECT * FROM sets ORDER BY name ASC");
}

function toSetProgress(
  set: SetRecord,
  ownedCountBySetId: Map<string, number>,
): SetProgress {
  const owned = ownedCountBySetId.get(set.set_id) ?? 0;
  return { set, owned, missing: Math.max(0, set.card_count - owned) };
}

/**
 * Calcola l'avanzamento per TUTTI i set (anche quelli senza nessuna carta posseduta),
 * ordinati mettendo prima quelli iniziati (dal più completo) e poi tutti gli altri
 * in ordine alfabetico, così si vede sia il progresso sia l'elenco completo da esplorare.
 */
export function buildSetProgressList(
  sets: SetRecord[],
  ownedCountBySetId: Map<string, number>,
): SetProgress[] {
  return sets
    .map((set) => toSetProgress(set, ownedCountBySetId))
    .sort((a, b) => {
      const aOwned = a.owned > 0;
      const bOwned = b.owned > 0;
      if (aOwned !== bOwned) return aOwned ? -1 : 1;
      if (aOwned) {
        return b.owned / b.set.card_count - a.owned / a.set.card_count;
      }
      return a.set.name.localeCompare(b.set.name);
    });
}

/**
 * Filtra un elenco di set già calcolato per nome o codice.
 */
export function filterSetProgress(
  list: SetProgress[],
  query: string,
): SetProgress[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (entry) =>
      entry.set.name.toLowerCase().includes(q) ||
      entry.set.set_code.toLowerCase().includes(q),
  );
}
