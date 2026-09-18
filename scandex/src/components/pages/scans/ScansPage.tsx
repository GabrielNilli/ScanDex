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
  notifyCardSaved,
  onCaptureRequested,
  onCardSaved,
  onFieldsUpdateRequested,
  onFocusRequested,
  onRemoteVideoStream,
  onRetakeRequested,
  onReviewRequested,
  onScanProgress,
  onSearchRequested,
  requestCapture,
  requestFocus,
  requestRetake,
  requestReview,
  requestSearch,
  sendScan,
  sendScanProgress,
  startVideoCall,
  stopVideoCall,
  subscribeStatus as subscribeRemoteStatus,
  updateRemoteFields,
  type RemoteScanProgress,
  type RemoteStatus,
} from "../../../services/remote/remoteService.ts";
import { enableContinuousFocus, focusAtPoint } from "./lib/cameraFocus.ts";
import { canvasToBlob, computeCropRect } from "./lib/cropImage.ts";
import CameraStepSection from "./sections/CameraStepSection.tsx";
import RemoteCameraStepSection from "./sections/RemoteCameraStepSection.tsx";
import RemoteScanMirrorSection from "./sections/RemoteScanMirrorSection.tsx";
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
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
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
  const isRemoteHost = remoteStatus.role === "host" && remoteStatus.connected;
  // Congela l'esito al momento del salvataggio: se la connessione cade subito dopo
  // un invio riuscito, la schermata finale non deve cambiare messaggio a posteriori.
  const [lastSaveWasRemote, setLastSaveWasRemote] = useState(false);

  // --- Anteprima remota (questo PC collegato a un telefono, vedi Impostazioni) ---
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [remoteProgress, setRemoteProgress] = useState<RemoteScanProgress | null>(
    null,
  );
  const [remotePreviewUrl, setRemotePreviewUrl] = useState<string | null>(null);
  const [remoteResultUrl, setRemoteResultUrl] = useState<string | null>(null);
  // Copia locale di nome/numero editabile dal PC durante lo step "review" del
  // telefono: si aggiorna sia qui che sul telefono ad ogni modifica.
  const [hostCardName, setHostCardName] = useState("");
  const [hostCardNumber, setHostCardNumber] = useState("");
  const [hostSaveError, setHostSaveError] = useState<string | null>(null);
  const [hostSaving, setHostSaving] = useState(false);

  useEffect(() => subscribeRemoteStatus(setRemoteStatus), []);

  useEffect(
    () =>
      onRemoteVideoStream((stream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        setHasRemoteVideo(Boolean(stream));
      }),
    [],
  );

  // Rispecchia sul PC i dettagli del wizard di scansione in corso sul telefono.
  useEffect(
    () =>
      onScanProgress((progress) => {
        setRemoteProgress(progress);
        setRemotePreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return progress.previewImageBlob
            ? URL.createObjectURL(progress.previewImageBlob)
            : null;
        });
        setRemoteResultUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return progress.resultImageBlob
            ? URL.createObjectURL(progress.resultImageBlob)
            : null;
        });
      }),
    [],
  );

  // Quando il telefono entra nello step "review", inizializza i campi
  // editabili sul PC con la lettura OCR del telefono.
  useEffect(() => {
    if (remoteProgress?.step === "review") {
      setHostCardName(remoteProgress.cardName);
      setHostCardNumber(remoteProgress.cardNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteProgress?.step]);

  // Ad ogni cambio di step del telefono, l'eventuale stato di salvataggio
  // precedente sul PC (errore o "in corso") non è più valido.
  useEffect(() => {
    setHostSaveError(null);
    setHostSaving(false);
  }, [remoteProgress?.step]);

  // Tenuto aggiornato senza essere una dipendenza dell'effetto della fotocamera
  // qui sotto: collegarsi/scollegarsi dal PC non deve riavviare lo stream locale.
  const isRemoteClientRef = useRef(isRemoteClient);
  useEffect(() => {
    isRemoteClientRef.current = isRemoteClient;
  }, [isRemoteClient]);

  // Avvio/stop della fotocamera in base allo step corrente. Se il PC è
  // collegato a un telefono, si usa l'anteprima remota di lui: non ha senso
  // aprire anche la webcam del PC.
  useEffect(() => {
    if (step !== "camera" || isRemoteHost) return;
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
        // Se siamo collegati a un PC, condividi anche a lui l'anteprima live,
        // così può vedere cosa inquadra il telefono prima di chiedere lo scatto.
        if (isRemoteClientRef.current) {
          startVideoCall(stream);
        }
        // Dove supportato (Chrome/Android), forza il fuoco automatico continuo
        // invece di lasciare al browser una modalità qualunque scelta di default.
        const track = stream.getVideoTracks()[0];
        if (track) void enableContinuousFocus(track);
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
      stopVideoCall();
    };
  }, [step, isRemoteHost]);

  // Pulizia degli Object URL creati
  useEffect(() => {
    return () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      if (resultImageUrl) URL.revokeObjectURL(resultImageUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carica l'elenco delle collezioni quando si entra nello step di conferma,
  // sia in locale che quando il PC mostra la conferma di un telefono collegato.
  useEffect(() => {
    if (step !== "confirm" && remoteProgress?.step !== "confirm") return;
    listCollections()
      .then((list) => {
        setCollections(list);
        setTargetCollectionId((prev) =>
          prev === "" && list[0] ? list[0].id : prev,
        );
      })
      .catch((err) => console.warn("Errore caricamento collezioni:", err));
  }, [step, remoteProgress?.step]);

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

    // Rinfresca il fuoco esattamente sul centro del riquadro guida appena
    // prima di scattare: se l'autofocus continuo avesse "vagato" nel
    // frattempo, la foto risulta comunque a fuoco sulla carta.
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      await focusAtPoint(
        track,
        (sx + sw / 2) / video.videoWidth,
        (sy + sh / 2) / video.videoHeight,
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

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
    setCapturedBlob(blob);

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    await runOcr(canvas);
  }, [runOcr]);

  // "Tocca per mettere a fuoco": ridà il controllo del punto di fuoco
  // all'utente quando l'autofocus non converge da solo sulla carta.
  const handleFocusTap = (xFraction: number, yFraction: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) void focusAtPoint(track, xFraction, yFraction);
  };

  // Scatto richiesto dal PC collegato (vedi RemoteSection): riusa lo stesso
  // scatto manuale, ma solo se siamo effettivamente pronti a fotografare.
  useEffect(() => {
    if (!isRemoteClient) return;
    return onCaptureRequested(() => {
      if (step === "camera" && cameraReady && !cameraError) {
        handleCapture();
      }
    });
  }, [isRemoteClient, step, cameraReady, cameraError, handleCapture]);

  // Manda al PC collegato un'istantanea di questo step del wizard, così può
  // mostrare gli stessi dettagli. Si aggancia ai cambi di step (non ad ogni
  // modifica di un campo) perché ogni handler aggiorna già tutti i dati
  // rilevanti prima di cambiare step, quindi un invio per step basta ed evita
  // di rimandare le immagini ad ogni tocco sulla tastiera.
  useEffect(() => {
    if (!isRemoteClient) return;
    sendScanProgress({
      step,
      previewImageBlob: capturedBlob,
      cardName,
      cardNumber,
      ocrRawText,
      errorMessage,
      results: searchResults,
      selectedResult,
      resultImageBlob,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRemoteClient, step, resultImageBlob]);

  // Solo lato "host" (PC): chiede al telefono collegato di scattare ora.
  const handleRequestCapture = () => {
    requestCapture().catch(() => {
      // Connessione caduta proprio ora: lo stato si aggiornerà da solo
      // tramite l'evento "close" della connessione.
    });
  };

  // Solo lato "host" (PC): chiede al telefono di mettere a fuoco il punto
  // toccato sull'anteprima live.
  const handleRequestFocus = (xFraction: number, yFraction: number) => {
    requestFocus(xFraction, yFraction);
  };

  // Solo lato "host" (PC): controlli della revisione mostrata "come sul
  // telefono", che sincronizzano le modifiche sul telefono collegato.
  const handleHostCardNameChange = (value: string) => {
    setHostCardName(value);
    updateRemoteFields(value, hostCardNumber);
  };

  const handleHostCardNumberChange = (value: string) => {
    setHostCardNumber(value);
    updateRemoteFields(hostCardName, value);
  };

  const handleRequestRetake = () => {
    requestRetake().catch(() => {
      // Connessione caduta proprio ora: lo stato si aggiornerà da solo.
    });
  };

  const handleRequestSearch = () => {
    requestSearch().catch(() => {
      // Connessione caduta proprio ora: lo stato si aggiornerà da solo.
    });
  };

  const handleHostCancelConfirm = () => {
    requestReview().catch(() => {
      // Connessione caduta proprio ora: lo stato si aggiornerà da solo.
    });
  };

  // Solo lato "host" (PC): salva direttamente nel proprio database locale la
  // carta confermata dal telefono (foto e dati sono già arrivati con
  // l'istantanea di progresso), poi avvisa il telefono che è fatta.
  const handleHostSaveConfirmedCard = async () => {
    if (
      hostSaving ||
      !remoteProgress?.selectedResult ||
      !remoteProgress.resultImageBlob
    ) {
      return;
    }
    setHostSaveError(null);
    setHostSaving(true);
    try {
      await saveScannedCard({
        collectionId: targetCollectionId === "" ? null : targetCollectionId,
        result: remoteProgress.selectedResult,
        imageBlob: remoteProgress.resultImageBlob,
      });
      notifyCardSaved();
    } catch (err) {
      console.error("Errore salvataggio carta remota:", err);
      setHostSaveError(
        err instanceof Error ? err.message : "Errore durante il salvataggio.",
      );
      setHostSaving(false);
    }
  };

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

  // Rifai foto / avvia ricerca / modifica campi / annulla conferma / conferma
  // salvata, tutti richiesti dal PC collegato: ognuno agisce solo nello step
  // in cui ha senso, per evitare comandi fuori tempo massimo per via della
  // latenza di rete.
  useEffect(() => {
    if (!isRemoteClient) return;
    const offRetake = onRetakeRequested(() => {
      if (step === "review") handleRetake();
    });
    const offSearch = onSearchRequested(() => {
      if (step === "review") handleSearch();
    });
    const offFields = onFieldsUpdateRequested((fields) => {
      if (step === "review") {
        setCardName(fields.cardName);
        setCardNumber(fields.cardNumber);
      }
    });
    const offReview = onReviewRequested(() => {
      if (step === "confirm") setStep("review");
    });
    const offSaved = onCardSaved(() => {
      if (step === "confirm") {
        setLastSaveWasRemote(true);
        setStep("done");
      }
    });
    const offFocus = onFocusRequested(({ x, y }) => {
      if (step !== "camera") return;
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) void focusAtPoint(track, x, y);
    });
    return () => {
      offRetake();
      offSearch();
      offFields();
      offReview();
      offSaved();
      offFocus();
    };
    // handleRetake/handleSearch non sono memoizzate: si riaggancia la
    // sottoscrizione ad ogni render, costo trascurabile per un Set locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRemoteClient, step, handleRetake, handleSearch]);

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
        {isRemoteHost && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Wifi size={12} />
            Telefono collegato: qui sotto vedi la sua anteprima
          </p>
        )}
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4">
        {step === "camera" &&
          (isRemoteHost ? (
            remoteProgress && remoteProgress.step === "review" ? (
              <ReviewStepSection
                capturedUrl={remotePreviewUrl}
                cardName={hostCardName}
                cardNumber={hostCardNumber}
                ocrRawText={remoteProgress.ocrRawText}
                errorMessage={remoteProgress.errorMessage}
                onCardNameChange={handleHostCardNameChange}
                onCardNumberChange={handleHostCardNumberChange}
                onRetake={handleRequestRetake}
                onSearch={handleRequestSearch}
              />
            ) : remoteProgress &&
              remoteProgress.step === "confirm" &&
              remoteProgress.selectedResult ? (
              <ConfirmStepSection
                result={remoteProgress.selectedResult}
                imageUrl={remoteResultUrl}
                imageReady={Boolean(remoteProgress.resultImageBlob) && !hostSaving}
                errorMessage={hostSaveError ?? remoteProgress.errorMessage}
                collections={collections}
                targetCollectionId={targetCollectionId}
                newCollectionName={newCollectionName}
                creatingCollection={creatingCollection}
                onTargetCollectionChange={setTargetCollectionId}
                onNewCollectionNameChange={setNewCollectionName}
                onCreateCollection={handleCreateCollection}
                onCancel={handleHostCancelConfirm}
                onSave={handleHostSaveConfirmedCard}
              />
            ) : remoteProgress && remoteProgress.step !== "camera" ? (
              <RemoteScanMirrorSection
                progress={remoteProgress}
                previewUrl={remotePreviewUrl}
                resultUrl={remoteResultUrl}
              />
            ) : (
              <RemoteCameraStepSection
                videoRef={remoteVideoRef}
                hasStream={hasRemoteVideo}
                onRequestCapture={handleRequestCapture}
                onFocusTap={handleRequestFocus}
              />
            )
          ) : (
            <CameraStepSection
              videoRef={videoRef}
              guideRef={guideRef}
              cameraError={cameraError}
              cameraReady={cameraReady}
              onCapture={handleCapture}
              onFocusTap={handleFocusTap}
            />
          ))}

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
