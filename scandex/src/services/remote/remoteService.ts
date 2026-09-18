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

import Peer, { type DataConnection, type MediaConnection } from "peerjs";
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

type WireCommandPayload =
  | { kind: "capture-request" }
  | { kind: "retake-request" }
  | { kind: "search-request" }
  | { kind: "fields-update"; cardName: string; cardNumber: string }
  | { kind: "review-request" }
  | { kind: "card-saved" }
  | { kind: "focus-request"; x: number; y: number };

const COMMAND_KINDS = [
  "capture-request",
  "retake-request",
  "search-request",
  "fields-update",
  "review-request",
  "card-saved",
  "focus-request",
] as const;

export type RemoteScanStep =
  | "camera"
  | "ocr"
  | "review"
  | "searching"
  | "choose"
  | "confirm"
  | "saving"
  | "done";

/** Istantanea di cosa sta facendo il telefono nel wizard di scansione, per mostrarla sul PC. */
export interface RemoteScanProgress {
  step: RemoteScanStep;
  previewImageBlob: Blob | null;
  cardName: string;
  cardNumber: string;
  ocrRawText: string;
  errorMessage: string | null;
  results: PokewalletSearchResult[];
  selectedResult: PokewalletSearchResult | null;
  resultImageBlob: Blob | null;
}

interface WireProgressPayload {
  kind: "progress";
  step: RemoteScanStep;
  previewImageBytes: ArrayBuffer | null;
  previewImageMime: string | null;
  cardName: string;
  cardNumber: string;
  ocrRawText: string;
  errorMessage: string | null;
  results: PokewalletSearchResult[];
  selectedResult: PokewalletSearchResult | null;
  resultImageBytes: ArrayBuffer | null;
  resultImageMime: string | null;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PEER_ID_PREFIX = "scandex-";

let peer: Peer | null = null;
let connection: DataConnection | null = null;
let mediaConnection: MediaConnection | null = null;
let status: RemoteStatus = {
  role: null,
  connected: false,
  connecting: false,
  code: null,
  error: null,
};

const statusListeners = new Set<(status: RemoteStatus) => void>();
const scanListeners = new Set<(payload: RemoteScanRequest) => void>();
const captureListeners = new Set<() => void>();
const retakeListeners = new Set<() => void>();
const searchListeners = new Set<() => void>();
const fieldsListeners = new Set<
  (fields: { cardName: string; cardNumber: string }) => void
>();
const reviewListeners = new Set<() => void>();
const cardSavedListeners = new Set<() => void>();
const focusListeners = new Set<(point: { x: number; y: number }) => void>();
const videoListeners = new Set<(stream: MediaStream | null) => void>();
const progressListeners = new Set<(progress: RemoteScanProgress) => void>();

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

/** Solo lato "client" (telefono): notifica quando il PC chiede uno scatto. */
export function onCaptureRequested(cb: () => void): () => void {
  captureListeners.add(cb);
  return () => captureListeners.delete(cb);
}

/** Solo lato "client" (telefono): notifica quando il PC chiede di rifare la foto. */
export function onRetakeRequested(cb: () => void): () => void {
  retakeListeners.add(cb);
  return () => retakeListeners.delete(cb);
}

/** Solo lato "client" (telefono): notifica quando il PC chiede di avviare la ricerca. */
export function onSearchRequested(cb: () => void): () => void {
  searchListeners.add(cb);
  return () => searchListeners.delete(cb);
}

/** Solo lato "client" (telefono): notifica quando il PC modifica nome/numero carta durante la revisione. */
export function onFieldsUpdateRequested(
  cb: (fields: { cardName: string; cardNumber: string }) => void,
): () => void {
  fieldsListeners.add(cb);
  return () => fieldsListeners.delete(cb);
}

/** Solo lato "client" (telefono): notifica quando il PC annulla la conferma e torna alla revisione. */
export function onReviewRequested(cb: () => void): () => void {
  reviewListeners.add(cb);
  return () => reviewListeners.delete(cb);
}

/** Solo lato "client" (telefono): notifica quando il PC ha salvato la carta confermata da lì. */
export function onCardSaved(cb: () => void): () => void {
  cardSavedListeners.add(cb);
  return () => cardSavedListeners.delete(cb);
}

/** Solo lato "client" (telefono): notifica quando il PC chiede di mettere a fuoco un punto. */
export function onFocusRequested(
  cb: (point: { x: number; y: number }) => void,
): () => void {
  focusListeners.add(cb);
  return () => focusListeners.delete(cb);
}

/**
 * Solo lato "host" (PC): notifica il flusso video live della fotocamera del
 * telefono collegato (null quando il telefono smette di condividerlo).
 */
export function onRemoteVideoStream(
  cb: (stream: MediaStream | null) => void,
): () => void {
  videoListeners.add(cb);
  return () => videoListeners.delete(cb);
}

/**
 * Solo lato "host" (PC): notifica a che punto del wizard di scansione è
 * arrivato il telefono collegato (foto, OCR, ricerca, conferma, ecc.), così
 * la stessa pagina sul PC può mostrare gli stessi dettagli in tempo reale.
 */
export function onScanProgress(
  cb: (progress: RemoteScanProgress) => void,
): () => void {
  progressListeners.add(cb);
  return () => progressListeners.delete(cb);
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

function isWireCommandPayload(data: unknown): data is WireCommandPayload {
  return Boolean(
    data &&
      typeof data === "object" &&
      COMMAND_KINDS.includes(
        (data as { kind?: string }).kind as (typeof COMMAND_KINDS)[number],
      ),
  );
}

function isWireProgressPayload(data: unknown): data is WireProgressPayload {
  return Boolean(
    data &&
      typeof data === "object" &&
      (data as { kind?: string }).kind === "progress",
  );
}

function attachConnectionHandlers(conn: DataConnection, role: RemoteRole): void {
  connection = conn;
  conn.on("open", () => {
    setStatus({ connected: true, connecting: false, error: null });
  });
  conn.on("data", (data: unknown) => {
    if (role === "host" && isWireScanPayload(data)) {
      scanListeners.forEach((cb) =>
        cb({
          result: data.result,
          imageBlob: new Blob([data.imageBytes], { type: data.imageMime }),
          collectionName: data.collectionName,
        }),
      );
    } else if (role === "client" && isWireCommandPayload(data)) {
      switch (data.kind) {
        case "capture-request":
          captureListeners.forEach((cb) => cb());
          break;
        case "retake-request":
          retakeListeners.forEach((cb) => cb());
          break;
        case "search-request":
          searchListeners.forEach((cb) => cb());
          break;
        case "fields-update":
          fieldsListeners.forEach((cb) =>
            cb({ cardName: data.cardName, cardNumber: data.cardNumber }),
          );
          break;
        case "review-request":
          reviewListeners.forEach((cb) => cb());
          break;
        case "card-saved":
          cardSavedListeners.forEach((cb) => cb());
          break;
        case "focus-request":
          focusListeners.forEach((cb) => cb({ x: data.x, y: data.y }));
          break;
      }
    } else if (role === "host" && isWireProgressPayload(data)) {
      progressListeners.forEach((cb) =>
        cb({
          step: data.step,
          previewImageBlob: data.previewImageBytes
            ? new Blob([data.previewImageBytes], {
                type: data.previewImageMime ?? "image/jpeg",
              })
            : null,
          cardName: data.cardName,
          cardNumber: data.cardNumber,
          ocrRawText: data.ocrRawText,
          errorMessage: data.errorMessage,
          results: data.results,
          selectedResult: data.selectedResult,
          resultImageBlob: data.resultImageBytes
            ? new Blob([data.resultImageBytes], {
                type: data.resultImageMime ?? "image/jpeg",
              })
            : null,
        }),
      );
    }
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
    p.on("call", (call) => {
      if (mediaConnection) {
        call.close();
        return;
      }
      mediaConnection = call;
      call.on("stream", (remoteStream) => {
        videoListeners.forEach((cb) => cb(remoteStream));
      });
      call.on("close", () => {
        if (mediaConnection === call) mediaConnection = null;
        videoListeners.forEach((cb) => cb(null));
      });
      call.answer();
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

/**
 * Solo lato "client" (telefono): manda al PC un'istantanea del wizard di
 * scansione in corso. È "best effort": se l'invio fallisce non blocca né
 * fa fallire la scansione sul telefono, che resta l'unica fonte di verità.
 */
export async function sendScanProgress(
  progress: RemoteScanProgress,
): Promise<void> {
  if (!connection || !connection.open) return;
  try {
    const [previewImageBytes, resultImageBytes] = await Promise.all([
      progress.previewImageBlob?.arrayBuffer() ?? Promise.resolve(null),
      progress.resultImageBlob?.arrayBuffer() ?? Promise.resolve(null),
    ]);
    const payload: WireProgressPayload = {
      kind: "progress",
      step: progress.step,
      previewImageBytes,
      previewImageMime: progress.previewImageBlob?.type ?? null,
      cardName: progress.cardName,
      cardNumber: progress.cardNumber,
      ocrRawText: progress.ocrRawText,
      errorMessage: progress.errorMessage,
      results: progress.results,
      selectedResult: progress.selectedResult,
      resultImageBytes,
      resultImageMime: progress.resultImageBlob?.type ?? null,
    };
    connection.send(payload);
  } catch (err) {
    console.warn("Invio stato scansione al PC fallito:", err);
  }
}

/**
 * Solo lato "client" (telefono): inizia a condividere col PC il flusso live
 * della fotocamera, così chi guarda il PC vede in anteprima cosa inquadra il
 * telefono prima di chiedere lo scatto.
 */
export function startVideoCall(stream: MediaStream): void {
  if (!peer || !status.code || status.role !== "client") return;
  if (mediaConnection) {
    mediaConnection.close();
    mediaConnection = null;
  }
  const call = peer.call(peerIdFromCode(status.code), stream);
  mediaConnection = call;
  call.on("close", () => {
    if (mediaConnection === call) mediaConnection = null;
  });
}

/** Solo lato "client" (telefono): interrompe la condivisione del flusso video. */
export function stopVideoCall(): void {
  mediaConnection?.close();
  mediaConnection = null;
}

/** Solo lato "host" (PC): chiede al telefono collegato di scattare subito. */
export function requestCapture(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!connection || !connection.open) {
      reject(new Error("Nessun telefono collegato."));
      return;
    }
    const payload: WireCommandPayload = { kind: "capture-request" };
    connection.send(payload);
    resolve();
  });
}

/** Solo lato "host" (PC): chiede al telefono collegato di rifare la foto. */
export function requestRetake(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!connection || !connection.open) {
      reject(new Error("Nessun telefono collegato."));
      return;
    }
    const payload: WireCommandPayload = { kind: "retake-request" };
    connection.send(payload);
    resolve();
  });
}

/** Solo lato "host" (PC): chiede al telefono collegato di avviare la ricerca su PokeWallet. */
export function requestSearch(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!connection || !connection.open) {
      reject(new Error("Nessun telefono collegato."));
      return;
    }
    const payload: WireCommandPayload = { kind: "search-request" };
    connection.send(payload);
    resolve();
  });
}

/**
 * Solo lato "host" (PC): sincronizza sul telefono nome/numero carta modificati
 * durante la revisione. È "best effort" (niente reject): viene chiamata ad
 * ogni tocco di tastiera e non deve interrompere la digitazione sul PC.
 */
export function updateRemoteFields(cardName: string, cardNumber: string): void {
  if (!connection || !connection.open) return;
  const payload: WireCommandPayload = {
    kind: "fields-update",
    cardName,
    cardNumber,
  };
  connection.send(payload);
}

/** Solo lato "host" (PC): annulla la conferma sul telefono e torna alla revisione. */
export function requestReview(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!connection || !connection.open) {
      reject(new Error("Nessun telefono collegato."));
      return;
    }
    const payload: WireCommandPayload = { kind: "review-request" };
    connection.send(payload);
    resolve();
  });
}

/**
 * Solo lato "host" (PC): avvisa il telefono che la carta confermata è stata
 * salvata direttamente qui (senza passare dal canale "scan"), così il
 * telefono può chiudere il wizard come se l'avesse inviata lui stesso.
 */
export function notifyCardSaved(): void {
  if (!connection || !connection.open) return;
  const payload: WireCommandPayload = { kind: "card-saved" };
  connection.send(payload);
}

/**
 * Solo lato "host" (PC): chiede al telefono collegato di mettere a fuoco il
 * punto indicato (coordinate 0..1 relative al frame, come toccando lo schermo
 * del telefono). "Best effort": non deve interrompere l'anteprima sul PC se
 * la connessione è appena caduta.
 */
export function requestFocus(x: number, y: number): void {
  if (!connection || !connection.open) return;
  const payload: WireCommandPayload = { kind: "focus-request", x, y };
  connection.send(payload);
}

export function disconnect(): void {
  connection?.close();
  connection = null;
  mediaConnection?.close();
  mediaConnection = null;
  videoListeners.forEach((cb) => cb(null));
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
