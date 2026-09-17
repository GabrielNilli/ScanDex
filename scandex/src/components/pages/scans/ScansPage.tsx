// =================================
//  IMPORTS
// =================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Wifi } from "lucide-react";
import {
  fetchCardImage,
  searchCard,
  type PokewalletSearchResult,
} from "../../../services/pokewallet/pokewalletApi.ts";
import { recognizeCard } from "../../../services/ocr/ocrService.ts";
import { saveScannedCard } from "../../../services/cards/cardsService.ts";
import {
  createCollection,
  listCollections,
  type CollectionWithCount,
} from "../../../services/collections/collectionsService.ts";
import {
  getStatus as getRemoteStatus,
  sendScan,
  subscribeStatus as subscribeRemoteStatus,
  type RemoteStatus,
} from "../../../services/remote/remoteService.ts";
import { canvasToBlob, computeCropRect } from "./lib/cropImage.ts";
import CameraStepSection from "./sections/CameraStepSection.tsx";
import LoadingStepSection from "./sections/LoadingStepSection.tsx";
import ReviewStepSection from "./sections/ReviewStepSection.tsx";
import ChooseResultStepSection from "./sections/ChooseResultStepSection.tsx";
import ConfirmStepSection from "./sections/ConfirmStepSection.tsx";
import DoneStepSection from "./sections/DoneStepSection.tsx";

// =================================
//  TYPES
// =================================
type Step =
  | "camera"
  | "ocr"
  | "review"
  | "searching"
  | "choose"
  | "confirm"
  | "saving"
  | "done";

// =================================
//  COMPONENT
// =================================
export default function ScansPage() {
  // --- Camera ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // --- Wizard ---
  const [step, setStep] = useState<Step>("camera");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [ocrRawText, setOcrRawText] = useState<string>("");
  const [cardName, setCardName] = useState<string>("");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [searchResults, setSearchResults] = useState<PokewalletSearchResult[]>(
    [],
  );
  const [selectedResult, setSelectedResult] =
    useState<PokewalletSearchResult | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [resultImageBlob, setResultImageBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Collezione di destinazione ---
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [targetCollectionId, setTargetCollectionId] = useState<number | "">("");
  const [newCollectionName, setNewCollectionName] = useState<string>("");
  const [creatingCollection, setCreatingCollection] = useState(false);

  // --- Collegamento remoto (questo telefono collegato a un PC, vedi Impostazioni) ---
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>(() =>
    getRemoteStatus(),
  );
  const [remoteCollectionName, setRemoteCollectionName] = useState<string>("");
  const isRemoteClient = remoteStatus.role === "client" && remoteStatus.connected;
  // Congela l'esito al momento del salvataggio: se la connessione cade subito dopo
  // un invio riuscito, la schermata finale non deve cambiare messaggio a posteriori.
  const [lastSaveWasRemote, setLastSaveWasRemote] = useState(false);

  useEffect(() => subscribeRemoteStatus(setRemoteStatus), []);

  // Avvio/stop della fotocamera in base allo step corrente
  useEffect(() => {
    if (step !== "camera") return;
    let cancelled = false;

    async function startCamera() {
      setCameraError(null);
      setCameraReady(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        // Piccola attesa per lasciare che la messa a fuoco/esposizione automatica
        // si stabilizzi prima di permettere lo scatto (altrimenti la prima foto è spesso mossa/sfocata).
        await new Promise((resolve) => setTimeout(resolve, 700));
        if (!cancelled) setCameraReady(true);
      } catch (err) {
        console.warn("Errore accesso fotocamera:", err);
        setCameraError(
          "Impossibile accedere alla fotocamera. Controlla i permessi del browser e riprova.",
        );
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [step]);

  // Pulizia degli Object URL creati
  useEffect(() => {
    return () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      if (resultImageUrl) URL.revokeObjectURL(resultImageUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carica l'elenco delle collezioni quando si entra nello step di conferma
  useEffect(() => {
    if (step !== "confirm") return;
    listCollections()
      .then((list) => {
        setCollections(list);
        setTargetCollectionId((prev) =>
          prev === "" && list[0] ? list[0].id : prev,
        );
      })
      .catch((err) => console.warn("Errore caricamento collezioni:", err));
  }, [step]);

  const runOcr = useCallback(async (source: Blob | HTMLCanvasElement) => {
    setStep("ocr");
    setErrorMessage(null);
    try {
      const guess = await recognizeCard(source);
      setOcrRawText(guess.rawText);
      setCardName(guess.guessedName ?? "");
      setCardNumber(guess.guessedNumber ?? "");
      setStep("review");
    } catch (err) {
      console.error("Errore OCR:", err);
      setErrorMessage(
        "Il riconoscimento automatico del testo non è riuscito. Inserisci nome e numero manualmente.",
      );
      setCardName("");
      setCardNumber("");
      setStep("review");
    }
  }, []);

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    const guide = guideRef.current;
    const canvas = canvasRef.current;
    if (!video || !guide || !canvas || video.videoWidth === 0) return;

    const { sx, sy, sw, sh } = computeCropRect(video, guide);
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

    // L'anteprima usa il JPEG (più leggero), ma l'OCR legge direttamente i pixel
    // del canvas per evitare la perdita di dettaglio di una ricompressione JPEG.
    const blob = await canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    setCapturedUrl(url);

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    await runOcr(canvas);
  }, [runOcr]);

  const handleRetake = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setErrorMessage(null);
    setStep("camera");
  };

  const handleSearch = async () => {
    if (!cardName.trim()) {
      setErrorMessage("Inserisci almeno il nome della carta.");
      return;
    }
    setErrorMessage(null);
    setStep("searching");
    try {
      const results = await searchCard(cardName.trim(), cardNumber.trim());
      setSearchResults(results);
      if (results.length === 0) {
        setErrorMessage(
          "Nessuna carta trovata su PokeWallet. Prova a correggere nome o numero.",
        );
        setStep("review");
      } else if (results.length === 1) {
        await selectResult(results[0]);
      } else {
        setStep("choose");
      }
    } catch (err) {
      console.error("Errore ricerca pokewallet:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Errore durante la ricerca.",
      );
      setStep("review");
    }
  };

  const selectResult = async (result: PokewalletSearchResult) => {
    setSelectedResult(result);
    setStep("confirm");
    setErrorMessage(null);
    try {
      const imageBlob = await fetchCardImage(result.id);
      const url = URL.createObjectURL(imageBlob);
      setResultImageBlob(imageBlob);
      setResultImageUrl(url);
    } catch (err) {
      console.error("Errore recupero immagine carta:", err);
      setErrorMessage(
        "Impossibile scaricare l'immagine ufficiale della carta.",
      );
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    setCreatingCollection(true);
    try {
      const created = await createCollection(newCollectionName.trim());
      setCollections((prev) => [{ ...created, cardCount: 0 }, ...prev]);
      setTargetCollectionId(created.id);
      setNewCollectionName("");
    } catch (err) {
      console.error("Errore creazione collezione:", err);
    } finally {
      setCreatingCollection(false);
    }
  };

  const handleSave = async () => {
    if (!selectedResult || !resultImageBlob) return;
    const sendingRemotely = isRemoteClient;
    setStep("saving");
    try {
      if (sendingRemotely) {
        await sendScan({
          result: selectedResult,
          imageBlob: resultImageBlob,
          collectionName: remoteCollectionName.trim() || null,
        });
      } else {
        await saveScannedCard({
          collectionId: targetCollectionId === "" ? null : targetCollectionId,
          result: selectedResult,
          imageBlob: resultImageBlob,
        });
      }
      setLastSaveWasRemote(sendingRemotely);
      setStep("done");
    } catch (err) {
      console.error("Errore salvataggio carta:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Errore durante il salvataggio.",
      );
      setStep("confirm");
    }
  };

  const handleScanAnother = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    if (resultImageUrl) URL.revokeObjectURL(resultImageUrl);
    setCapturedUrl(null);
    setOcrRawText("");
    setCardName("");
    setCardNumber("");
    setSearchResults([]);
    setSelectedResult(null);
    setResultImageUrl(null);
    setResultImageBlob(null);
    setErrorMessage(null);
    setRemoteCollectionName("");
    setLastSaveWasRemote(false);
    setStep("camera");
  };

  // =================================
  //  RENDER
  // =================================
  return (
    <div className="min-h-dvh bg-slate-50 pb-24 text-slate-900 dark:bg-slate-900 dark:text-slate-100 lg:pb-6">
      <canvas ref={canvasRef} className="hidden" />

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white px-4 pt-6 pb-4 dark:border-slate-700 dark:bg-slate-800">
        <h1 className="flex items-center gap-2 font-headline text-xl font-bold tracking-tight">
          <Camera className="text-amber-600 dark:text-amber-400" size={22} />
          Scansiona carta
        </h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Inquadra la carta nel riquadro, verrà riconosciuta tramite OCR e
          cercata su PokeWallet.
        </p>
        {isRemoteClient && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Wifi size={12} />
            Collegato al PC: le carte verranno inviate lì
          </p>
        )}
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4">
        {step === "camera" && (
          <CameraStepSection
            videoRef={videoRef}
            guideRef={guideRef}
            cameraError={cameraError}
            cameraReady={cameraReady}
            onCapture={handleCapture}
          />
        )}

        {step === "ocr" && (
          <LoadingStepSection
            message="Riconoscimento del testo in corso..."
            imageUrl={capturedUrl}
          />
        )}

        {step === "review" && (
          <ReviewStepSection
            capturedUrl={capturedUrl}
            cardName={cardName}
            cardNumber={cardNumber}
            ocrRawText={ocrRawText}
            errorMessage={errorMessage}
            onCardNameChange={setCardName}
            onCardNumberChange={setCardNumber}
            onRetake={handleRetake}
            onSearch={handleSearch}
          />
        )}

        {step === "searching" && (
          <LoadingStepSection message="Ricerca su PokeWallet..." />
        )}

        {step === "choose" && (
          <ChooseResultStepSection
            results={searchResults}
            onSelect={selectResult}
            onBack={() => setStep("review")}
          />
        )}

        {step === "confirm" && selectedResult && (
          <ConfirmStepSection
            result={selectedResult}
            imageUrl={resultImageUrl}
            imageReady={Boolean(resultImageBlob)}
            errorMessage={errorMessage}
            collections={collections}
            targetCollectionId={targetCollectionId}
            newCollectionName={newCollectionName}
            creatingCollection={creatingCollection}
            onTargetCollectionChange={setTargetCollectionId}
            onNewCollectionNameChange={setNewCollectionName}
            onCreateCollection={handleCreateCollection}
            onCancel={() => setStep("review")}
            onSave={handleSave}
            remoteMode={isRemoteClient}
            remoteCollectionName={remoteCollectionName}
            onRemoteCollectionNameChange={setRemoteCollectionName}
          />
        )}

        {step === "saving" && (
          <LoadingStepSection
            message={
              isRemoteClient
                ? "Invio al PC in corso..."
                : "Salvataggio in corso..."
            }
          />
        )}

        {step === "done" && (
          <DoneStepSection
            onScanAnother={handleScanAnother}
            message={
              lastSaveWasRemote
                ? "Carta inviata al PC!"
                : "Carta salvata nella tua collezione!"
            }
          />
        )}
      </main>
    </div>
  );
}
