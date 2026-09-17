/**
 * Collegamento diretto telefono <-> desktop via WebRTC (libreria PeerJS), usato per
 * scansionare le carte dal telefono e vederle comparire automaticamente nel PC.
 *
 * ScanDex non ha un backend proprio (è una PWA client-only), quindi per lo scambio
 * dei dati usiamo il broker pubblico e gratuito di PeerJS solo per l'aggancio iniziale
 * (signaling): una volta stabilita la connessione, immagine e dati della carta viaggiano
 * peer-to-peer direttamente tra i due dispositivi, senza passare da nessun server nostro.
 * Il codice sessione non è altro che l'id del "peer" del PC, scelto a caso e leggibile.
 */

import Peer, { type DataConnection } from "peerjs";
import type { PokewalletSearchResult } from "../pokewallet/pokewalletApi.ts";

export type RemoteRole = "host" | "client";

export interface RemoteScanRequest {
  result: PokewalletSearchResult;
  imageBlob: Blob;
  collectionName: string | null;
}

export interface RemoteStatus {
  role: RemoteRole | null;
  connected: boolean;
  connecting: boolean;
  code: string | null;
  error: string | null;
}

interface WireScanPayload {
  kind: "scan";
  result: PokewalletSearchResult;
  imageBytes: ArrayBuffer;
  imageMime: string;
  collectionName: string | null;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PEER_ID_PREFIX = "scandex-";

let peer: Peer | null = null;
let connection: DataConnection | null = null;
let status: RemoteStatus = {
  role: null,
  connected: false,
  connecting: false,
  code: null,
  error: null,
};

const statusListeners = new Set<(status: RemoteStatus) => void>();
const scanListeners = new Set<(payload: RemoteScanRequest) => void>();

function setStatus(patch: Partial<RemoteStatus>): void {
  status = { ...status, ...patch };
  statusListeners.forEach((cb) => cb(status));
}

export function getStatus(): RemoteStatus {
  return status;
}

export function subscribeStatus(
  cb: (status: RemoteStatus) => void,
): () => void {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

/** Solo lato "host" (PC): notifica quando arriva una carta scansionata dal telefono. */
export function onScanReceived(
  cb: (payload: RemoteScanRequest) => void,
): () => void {
  scanListeners.add(cb);
  return () => scanListeners.delete(cb);
}

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function peerIdFromCode(code: string): string {
  return `${PEER_ID_PREFIX}${code.toLowerCase()}`;
}

function describePeerError(err: { type?: string; message?: string }): string {
  if (err.type === "peer-unavailable") {
    return "Codice non trovato: controlla che sul PC sia stata generata una sessione e riprova.";
  }
  if (err.type === "unavailable-id") {
    return "Codice già in uso, riprova per generarne uno nuovo.";
  }
  if (err.type === "network" || err.type === "server-error") {
    return "Impossibile raggiungere il servizio di aggancio: controlla la connessione a internet.";
  }
  return err.message ?? "Errore di connessione.";
}

function isWireScanPayload(data: unknown): data is WireScanPayload {
  return Boolean(
    data &&
      typeof data === "object" &&
      (data as { kind?: string }).kind === "scan",
  );
}

function attachConnectionHandlers(conn: DataConnection, role: RemoteRole): void {
  connection = conn;
  conn.on("open", () => {
    setStatus({ connected: true, connecting: false, error: null });
  });
  conn.on("data", (data: unknown) => {
    if (role !== "host" || !isWireScanPayload(data)) return;
    scanListeners.forEach((cb) =>
      cb({
        result: data.result,
        imageBlob: new Blob([data.imageBytes], { type: data.imageMime }),
        collectionName: data.collectionName,
      }),
    );
  });
  conn.on("close", () => {
    if (connection === conn) connection = null;
    setStatus({ connected: false });
  });
  conn.on("error", (err) => {
    setStatus({ error: describePeerError(err) });
  });
}

/** Diventa "host": genera un codice sessione e resta in attesa che il telefono si colleghi. */
export function hostSession(): Promise<string> {
  disconnect();
  const code = generateCode();
  setStatus({
    role: "host",
    connecting: true,
    connected: false,
    code,
    error: null,
  });

  return new Promise((resolve, reject) => {
    const p = new Peer(peerIdFromCode(code));
    peer = p;
    p.on("open", () => resolve(code));
    p.on("connection", (conn) => {
      if (connection) {
        conn.close();
        return;
      }
      attachConnectionHandlers(conn, "host");
    });
    p.on("error", (err) => {
      setStatus({ error: describePeerError(err), connecting: false });
      reject(err);
    });
  });
}

/** Diventa "client" (telefono): si collega alla sessione del PC dato il codice. */
export function joinSession(code: string): Promise<void> {
  disconnect();
  const trimmedCode = code.trim().toUpperCase();
  setStatus({
    role: "client",
    connecting: true,
    connected: false,
    code: trimmedCode,
    error: null,
  });

  return new Promise((resolve, reject) => {
    const p = new Peer();
    peer = p;
    p.on("open", () => {
      const conn = p.connect(peerIdFromCode(trimmedCode), {
        reliable: true,
      });
      // Va registrato subito: se aspettiamo il primo "open" per agganciare
      // attachConnectionHandlers, l'evento è già passato e non si ripete.
      attachConnectionHandlers(conn, "client");
      conn.on("open", () => resolve());
      conn.on("error", (err) => {
        setStatus({ error: describePeerError(err), connecting: false });
        reject(err);
      });
    });
    p.on("error", (err) => {
      setStatus({ error: describePeerError(err), connecting: false });
      reject(err);
    });
  });
}

/** Solo lato "client" (telefono): invia una carta scansionata al PC collegato. */
export function sendScan(request: RemoteScanRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!connection || !connection.open) {
      reject(new Error("Nessuna connessione attiva col PC."));
      return;
    }
    request.imageBlob
      .arrayBuffer()
      .then((imageBytes) => {
        const payload: WireScanPayload = {
          kind: "scan",
          result: request.result,
          imageBytes,
          imageMime: request.imageBlob.type || "image/jpeg",
          collectionName: request.collectionName,
        };
        connection!.send(payload);
        resolve();
      })
      .catch((err) =>
        reject(err instanceof Error ? err : new Error("Invio fallito.")),
      );
  });
}

export function disconnect(): void {
  connection?.close();
  connection = null;
  peer?.destroy();
  peer = null;
  setStatus({
    role: null,
    connected: false,
    connecting: false,
    code: null,
    error: null,
  });
}
