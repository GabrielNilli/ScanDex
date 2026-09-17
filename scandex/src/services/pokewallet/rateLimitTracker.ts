/**
 * Traccia il rate limit della PokeWallet API (100 chiamate/ora, 1000/giorno).
 *
 * Gli header di risposta x-ratelimit-* NON sono leggibili da JavaScript nel browser:
 * l'API non include "Access-Control-Expose-Headers" nella risposta CORS, quindi per
 * la Fetch spec response.headers.get("x-ratelimit-...") restituisce sempre null lato
 * client (sono visibili solo nella scheda Network delle DevTools, che ha accesso
 * completo agli header per debug, un privilegio che il codice JS non ha).
 *
 * Si tiene quindi un log locale dei timestamp di ogni chiamata fatta da questa app e
 * si calcola il rimanente contando quelle nell'ultima ora/giorno rispetto ai limiti
 * noti. È accurato finché questa è l'unica app/dispositivo a usare questa chiave API:
 * non vede chiamate fatte altrove con la stessa chiave.
 */

const STORAGE_KEY = "scandex:pokewallet-call-log";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const LIMIT_HOUR = 100;
const LIMIT_DAY = 1000;

export interface RateLimitStatus {
  limitHour: number;
  remainingHour: number;
  limitDay: number;
  remainingDay: number;
  updatedAt: number;
}

function getCallLog(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCallLog(log: number[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // storage non disponibile: si ignora, non è critico
  }
}

/**
 * Registra una chiamata API appena effettuata (va chiamata per ogni richiesta reale
 * verso pokewallet, indipendentemente dall'esito).
 */
export function recordApiCall(): void {
  const now = Date.now();
  const log = getCallLog().filter((t) => now - t < DAY_MS);
  log.push(now);
  saveCallLog(log);
}

/**
 * Calcola lo stato corrente del rate limit in base al log locale delle chiamate.
 */
export function getRateLimitStatus(): RateLimitStatus {
  const now = Date.now();
  const log = getCallLog().filter((t) => now - t < DAY_MS);

  const callsLastHour = log.filter((t) => now - t < HOUR_MS).length;
  const callsLastDay = log.length;

  return {
    limitHour: LIMIT_HOUR,
    remainingHour: Math.max(0, LIMIT_HOUR - callsLastHour),
    limitDay: LIMIT_DAY,
    remainingDay: Math.max(0, LIMIT_DAY - callsLastDay),
    updatedAt: now,
  };
}

/**
 * Risincronizza manualmente il conteggio locale con i valori reali (visibili solo
 * nella scheda Network delle DevTools, non leggibili dal codice JS). Serve quando il
 * conteggio va "indietro" rispetto al vero, tipicamente perché la stessa chiave API è
 * stata usata anche fuori dall'app (altro dispositivo, test diretti, ecc.), quindi il
 * log locale non ha visto quelle chiamate.
 *
 * Si ricostruisce il log con timestamp sintetici: quelli "usati nell'ultima ora" a
 * "adesso" (per la finestra oraria), quelli usati solo oggi appena fuori da quella
 * finestra (contano ancora per il giorno ma non per l'ora corrente).
 */
export function calibrateRateLimit(
  actualRemainingHour: number,
  actualRemainingDay: number,
): void {
  const now = Date.now();
  const usedHour = Math.max(0, Math.min(LIMIT_HOUR, LIMIT_HOUR - actualRemainingHour));
  const usedDay = Math.max(0, Math.min(LIMIT_DAY, LIMIT_DAY - actualRemainingDay));
  const usedDayOnly = Math.max(0, usedDay - usedHour);

  const log: number[] = [];
  for (let i = 0; i < usedHour; i++) log.push(now);
  for (let i = 0; i < usedDayOnly; i++) log.push(now - HOUR_MS - 60_000);

  saveCallLog(log);
}
