/**
 * Helper per estrarre e formattare i prezzi CardMarket salvati nel campo raw_json
 * di una carta (risposta grezza di /search al momento dello scan).
 */

import type { CardRecord } from "../db/types.ts";
import type { CardmarketData, PokewalletSearchResult } from "./pokewalletApi.ts";

/**
 * Recupera i dati CardMarket dal raw_json salvato per una carta, se presenti.
 */
export function getCardmarketData(card: CardRecord): CardmarketData | null {
  if (!card.raw_json) return null;
  try {
    const parsed: PokewalletSearchResult = JSON.parse(card.raw_json);
    return parsed.cardmarket ?? null;
  } catch {
    return null;
  }
}

/**
 * Prezzo rappresentativo di una singola variante (holo, normal, reverse, ecc.):
 * si preferisce il "trend" (prezzo di mercato CardMarket), altrimenti si ripiega
 * sulle medie disponibili.
 */
function representativePrice(
  entry: CardmarketData["prices"][number],
): number | null {
  return entry.trend ?? entry.avg ?? entry.avg7 ?? entry.avg30 ?? entry.low;
}

/**
 * Prezzo più alto tra tutte le varianti CardMarket disponibili per la carta.
 */
export function getHighestCardmarketPrice(
  cardmarket: CardmarketData | null,
): number | null {
  if (!cardmarket || cardmarket.prices.length === 0) return null;

  const values = cardmarket.prices
    .map(representativePrice)
    .filter((v): v is number => v !== null && v > 0);

  return values.length > 0 ? Math.max(...values) : null;
}

/**
 * Somma il prezzo più alto di ogni carta per stimare il valore totale della collezione
 * (carte senza prezzo disponibile non contribuiscono, invece di far fallire il calcolo).
 */
export function getTotalPortfolioValue(cards: CardRecord[]): number {
  return cards.reduce(
    (sum, card) => sum + (getHighestCardmarketPrice(getCardmarketData(card)) ?? 0),
    0,
  );
}

/**
 * Formatta un prezzo in Euro (CardMarket opera in EUR), o "N/D" se assente.
 */
export function formatPrice(value: number | null): string {
  if (value === null) return "N/D";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
