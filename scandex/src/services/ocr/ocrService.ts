/**
 * Servizio OCR basato su Tesseract.js per riconoscere nome e numero di una carta
 * a partire dall'immagine catturata dalla fotocamera.
 *
 * Invece di leggere l'intera carta (rumoroso: illustrazione, testo attacchi, ecc.),
 * si ritagliano solo le due fasce dove nome e numero si trovano nel layout standard
 * delle carte Pokémon TCG moderne (Scarlet & Violet / Sword & Shield), le si ingrandisce
 * e se ne aumenta il contrasto prima di passarle a Tesseract.
 */

import {
  createWorker,
  OEM,
  PSM,
  type Worker as TesseractWorker,
} from "tesseract.js";

export interface OcrGuess {
  rawText: string;
  guessedName: string | null;
  guessedNumber: string | null;
}

// Percentuali approssimative (x, y, larghezza, altezza) rispetto al riquadro della carta,
// con margine extra perché nell'uso reale l'allineamento carta/riquadro guida non è mai
// perfetto come in un ritaglio di riferimento. Il margine extra può includere qualche riga
// vicina (es. badge "BASIC" o la riga del copyright): per questo si usa PSM SINGLE_BLOCK
// (tollerante a più righe) invece di SINGLE_LINE, e si sceglie poi la riga migliore in post.
const NAME_REGION = { x: 0.1, y: 0.015, w: 0.68, h: 0.12 };
const NUMBER_REGION = { x: 0.0, y: 0.88, w: 0.55, h: 0.1 };

let workerPromise: Promise<TesseractWorker> | null = null;

function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    // OEM.LSTM_ONLY fa scaricare a tesseract.js il modello "best" (rete neurale),
    // che generalizza molto meglio sul font stilizzato dei nomi delle carte rispetto
    // al modello standard usato di default.
    workerPromise = createWorker("eng", OEM.LSTM_ONLY);
  }
  return workerPromise;
}

/**
 * Ritaglia una regione percentuale dall'immagine sorgente e la ingrandisce
 * disegnandola su un canvas più grande (più pixel = testo più leggibile per l'OCR).
 *
 * `blurPx` è opzionale: utile per il nome (attenua il rumore fine di riflessi/texture
 * del foil olografico, che altrimenti Tesseract prova a leggere come testo denso), ma
 * va evitato sul numero, dove i tratti delle cifre sono già sottili e la sfocatura
 * rischia di farli sparire (lì il rumore residuo è comunque filtrato dalla whitelist
 * di caratteri e dalla regex che cerca lo specifico pattern "cifre/cifre").
 */
function extractRegion(
  bitmap: ImageBitmap,
  region: { x: number; y: number; w: number; h: number },
  scale: number,
  blurPx = 0,
): HTMLCanvasElement {
  const sx = region.x * bitmap.width;
  const sy = region.y * bitmap.height;
  const sw = region.w * bitmap.width;
  const sh = region.h * bitmap.height;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : "none";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  ctx.filter = "none";
  applyGrayscaleContrast(ctx, canvas.width, canvas.height);
  return canvas;
}

/**
 * Scala di grigi + contrast stretch (min-max): separa meglio il testo dallo sfondo
 * colorato della carta. Non si usano percentili: il testo (l'informazione che
 * interessa) copre una minoranza di pixel così piccola rispetto allo sfondo che un
 * taglio al 2°/98° percentile lo esclude *completamente* dal calcolo, stirando invece
 * le minime variazioni dello sfondo in falso rumore. Gli outlier isolati (riflessi
 * puntiformi) sono già attenuati a monte dalla leggera sfocatura sul nome.
 */
function applyGrayscaleContrast(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const gray = new Uint8ClampedArray(width * height);

  let min = 255;
  let max = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }

  const range = Math.max(1, max - min);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const stretched = ((gray[p] - min) / range) * 255;
    data[i] = data[i + 1] = data[i + 2] = stretched;
  }

  ctx.putImageData(imageData, 0, 0);
}

// Il badge di stadio ("BASIC", "STAGE 1"/"STAGE 2", ecc.) sta sulla stessa riga del nome
// (a sinistra, non su una riga separata), quindi non lo si può scartare scegliendo la
// riga giusta: va rimosso esplicitamente se compare come prefisso del testo riconosciuto.
const STAGE_BADGE_PREFIX = /^(BASIC|STAGE\s*\d*|LV\.?\s*\d+)\s+/i;

// Frammenti isolati di 1-3 lettere (con eventuale apostrofo) ai bordi della riga: quasi
// sempre rumore OCR (icone, simboli di evoluzione/energia letti come lettere), quasi mai
// parte reale del nome. Si rimuovono ripetutamente finché non ne restano più.
const STRAY_EDGE_TOKEN_START = /^[A-Za-z]{1,3}'?\s+/;
const STRAY_EDGE_TOKEN_END = /\s+'?[A-Za-z]{1,3}$/;

// Un nome "vero" somiglia a una o più parole in Maiuscola+minuscole (Ponyta, Minccino,
// Venusaur Lucente...). Il rumore OCR di icone/texture produce quasi sempre frammenti che
// non rispettano questo schema (tutto maiuscolo, minuscolo isolato, lettere sparse).
const TITLE_CASE_WORDS = /^[A-ZÀ-Ý][a-zà-ÿ']+(?:[\s-]+[A-ZÀ-Ý]?[a-zà-ÿ']+)*$/;

function stripStrayEdgeTokens(line: string): string {
  let result = line;
  let changed = true;
  while (changed) {
    changed = false;
    const withoutStart = result.replace(STRAY_EDGE_TOKEN_START, "");
    if (withoutStart !== result && withoutStart.length >= 2) {
      result = withoutStart;
      changed = true;
    }
    const withoutEnd = result.replace(STRAY_EDGE_TOKEN_END, "");
    if (withoutEnd !== result && withoutEnd.length >= 2) {
      result = withoutEnd;
      changed = true;
    }
  }
  return result.trim();
}

/**
 * Il blocco può contenere più righe (rumore sopra/sotto per via del margine extra della
 * regione, oppure frammenti di icone/texture letti come testo). Ogni riga viene ripulita
 * dal badge di stadio e dai frammenti isolati ai bordi, poi si sceglie la riga che più
 * somiglia a una vera parola (Maiuscola+minuscole); solo se nessuna riga rispetta lo
 * schema si ripiega sulla riga più lunga, per lasciare comunque qualcosa da correggere.
 */
function cleanName(text: string): string | null {
  const lines = text
    .split("\n")
    .map((line) =>
      line
        .replace(/[^a-zA-ZÀ-ÿ' -]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => line.length >= 2)
    .map((line) => line.replace(STAGE_BADGE_PREFIX, "").trim())
    .map(stripStrayEdgeTokens)
    .filter((line) => line.length >= 2);

  if (lines.length === 0) return null;

  const wordLike = lines.filter((line) => TITLE_CASE_WORDS.test(line));
  const candidates = wordLike.length > 0 ? wordLike : lines;

  return candidates.reduce((a, b) => (b.length > a.length ? b : a));
}

function extractNumber(text: string): string | null {
  const match = text.match(/(\d{1,4})\s*\/\s*\d{1,4}/);
  return match ? match[1] : null;
}

/**
 * Esegue il riconoscimento OCR mirato sulle fasce nome/numero di una carta catturata
 * e restituisce il testo grezzo di entrambe insieme alle stime derivate.
 *
 * Accetta sia un Blob (es. foto caricata da file) sia un HTMLCanvasElement: quando si
 * scansiona dal vivo si passa direttamente il canvas appena disegnato dal frame video,
 * evitando di ricomprimere in JPEG e ridecodificare prima dell'OCR (perdita di dettaglio
 * proprio sul testo minuscolo che ci interessa di più).
 */
export async function recognizeCard(
  image: Blob | HTMLCanvasElement,
): Promise<OcrGuess> {
  const worker = await getWorker();
  const bitmap = await createImageBitmap(image);

  try {
    const nameCanvas = extractRegion(bitmap, NAME_REGION, 5, 0.6);
    const numberCanvas = extractRegion(bitmap, NUMBER_REGION, 6);

    // Passata "nome": nessun vincolo sui caratteri, testo libero. SINGLE_BLOCK invece di
    // SINGLE_LINE perché il margine extra della regione può includere righe vicine.
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      tessedit_char_whitelist: "",
    });
    const nameResult = await worker.recognize(nameCanvas);

    // Passata "numero": si sa già che il formato è "cifre/cifre", quindi si
    // vincola il set di caratteri riconoscibili per eliminare le letture come lettere.
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789/",
    });
    const numberResult = await worker.recognize(numberCanvas);

    const guessedName = cleanName(nameResult.data.text);
    const guessedNumber = extractNumber(numberResult.data.text);
    const rawText = `Nome: ${nameResult.data.text.trim()}\nNumero: ${numberResult.data.text.trim()}`;

    return { rawText, guessedName, guessedNumber };
  } finally {
    bitmap.close();
  }
}

/**
 * Termina il worker Tesseract per liberare risorse (es. all'uscita dalla pagina di scan).
 */
export async function terminateOcrWorker(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
