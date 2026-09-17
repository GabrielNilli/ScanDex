/**
 * Client per la PokeWallet API (https://pokewallet.io/api-docs).
 * - GET /search?q=<nome> <numero>  -> elenco carte corrispondenti
 * - GET /images/:id                -> immagine binaria (JPEG/WebP) della carta
 * - GET /sets                      -> elenco di tutti i set esistenti
 *
 * La chiave API viene letta da .env (VITE_POKEWALLET_API_KEY), mai committato.
 * Nota: essendo una PWA client-only senza backend, Vite la inietta comunque nel
 * bundle JS: .env la tiene fuori dal repo Git, ma non la nasconde a chi ispeziona
 * l'app nel browser. Nascondere davvero la chiave richiederebbe un proxy server-side.
 */

import { recordApiCall } from "./rateLimitTracker.ts";

const API_BASE = "https://api.pokewallet.io";
const API_KEY = import.meta.env.VITE_POKEWALLET_API_KEY;

export interface PokewalletCardInfo {
  name: string;
  clean_name: string | null;
  set_name: string | null;
  set_code: string | null;
  set_id: string | null;
  card_number: string | null;
  rarity: string | null;
  card_type: string | null;
  hp: string | null;
  stage: string | null;
  card_text: string | null;
  attacks: string[] | null;
  weakness: string | null;
  resistance: string | null;
  retreat_cost: string | null;
}

export interface PokewalletPriceInfo {
  market_price?: number;
  low_price?: number;
  mid_price?: number;
  high_price?: number;
  sub_type_name?: string;
}

export interface CardmarketPriceEntry {
  avg: number | null;
  low: number | null;
  avg1: number | null;
  avg7: number | null;
  avg30: number | null;
  trend: number | null;
  updated_at?: string;
  variant_type: string;
}

export interface CardmarketData {
  product_name?: string;
  prices: CardmarketPriceEntry[];
  product_url?: string;
}

export interface PokewalletSearchResult {
  id: string;
  card_info: PokewalletCardInfo;
  images: { languages: string[] };
  tcgplayer?: { prices: PokewalletPriceInfo[]; url?: string };
  cardmarket?: CardmarketData;
}

interface PokewalletSearchResponse {
  query: string;
  results: PokewalletSearchResult[];
  error?: string;
  message?: string;
}

export interface PokewalletSet {
  name: string;
  set_code: string;
  set_id: string;
  card_count: number;
  language: string;
  release_date: string | null;
}

interface PokewalletSetsResponse {
  success: boolean;
  data: PokewalletSet[];
  total: number;
}

async function pokewalletFetch(path: string): Promise<Response> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "X-API-Key": API_KEY },
  });
  recordApiCall();
  if (!response.ok) {
    let message = `Richiesta pokewallet fallita (HTTP ${response.status})`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // corpo non JSON, si mantiene il messaggio generico
    }
    throw new Error(message);
  }
  return response;
}

/**
 * Verifica se il numero stampato su una carta (es. "065/167") corrisponde al numero
 * cercato, tollerando la differenza di zeri iniziali (es. "65" == "065").
 */
function cardNumberMatches(
  cardNumber: string | null,
  searched: string,
): boolean {
  const printed = cardNumber?.split("/")[0]?.trim();
  if (!printed) return false;

  if (/^\d+$/.test(printed) && /^\d+$/.test(searched)) {
    return parseInt(printed, 10) === parseInt(searched, 10);
  }
  return printed.toLowerCase() === searched.toLowerCase();
}

/**
 * Cerca una carta su pokewallet a partire da nome e numero riconosciuti dall'OCR.
 * Il numero deve essere passato così come letto sulla carta (es. "065"), senza rimuovere gli zeri iniziali.
 *
 * Se viene fornito un numero, si scartano i risultati il cui numero stampato non
 * corrisponde esattamente: la ricerca per nome dell'API è spesso approssimativa e
 * restituisce carte omonime di set diversi, questo restringe il campo ai casi reali.
 * Se il filtro eliminasse tutti i risultati (formato numero inatteso), si ripiega
 * sull'elenco completo per non nascondere carte valide per un problema di parsing.
 */
export async function searchCard(
  name: string,
  number?: string,
): Promise<PokewalletSearchResult[]> {
  const query = number ? `${name} ${number}` : name;
  const response = await pokewalletFetch(
    `/search?q=${encodeURIComponent(query)}`,
  );
  const data: PokewalletSearchResponse = await response.json();
  const results = data.results ?? [];

  const trimmedNumber = number?.trim();
  if (!trimmedNumber) return results;

  const filtered = results.filter((r) =>
    cardNumberMatches(r.card_info.card_number, trimmedNumber),
  );
  return filtered.length > 0 ? filtered : results;
}

/**
 * Scarica l'immagine binaria di una carta a partire dal suo id pokewallet.
 */
export async function fetchCardImage(id: string): Promise<Blob> {
  const response = await pokewalletFetch(
    `/images/${encodeURIComponent(id)}?size=high`,
  );
  return response.blob();
}

/**
 * Recupera i dati aggiornati (prezzi inclusi) di una singola carta dal suo id pokewallet.
 * Usato per il pulsante "aggiorna prezzo" nel dettaglio di una carta già salvata.
 */
export async function fetchCardById(id: string): Promise<PokewalletSearchResult> {
  const response = await pokewalletFetch(`/cards/${encodeURIComponent(id)}`);
  return response.json();
}

/**
 * Recupera l'elenco di tutti i set esistenti (usato per la sezione "Set" e per
 * calcolare quante carte mancano per completare ciascun set).
 */
export async function fetchAllSets(): Promise<PokewalletSet[]> {
  const response = await pokewalletFetch("/sets");
  const data: PokewalletSetsResponse = await response.json();
  return data.data ?? [];
}
