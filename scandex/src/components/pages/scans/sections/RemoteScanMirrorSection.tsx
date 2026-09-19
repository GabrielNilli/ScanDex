// =================================
//  IMPORTS
// =================================
import { CheckCircle2 } from "lucide-react";
import type { RemoteScanProgress } from "../../../../services/remote/remoteService.ts";
import LoadingStepSection from "./LoadingStepSection.tsx";

// =================================
//  COMPONENT
// =================================
/**
 * Rispecchia sul PC, in sola lettura, il punto del wizard di scansione in cui
 * si trova il telefono collegato. Gli step "review", "choose" e "confirm"
 * (dove si può agire anche dal PC) sono gestiti a parte in ScansPage con le
 * vere ReviewStepSection/ChooseResultStepSection/ConfirmStepSection: qui
 * restano solo gli step in cui il telefono resta l'unico a poter agire.
 */
export default function RemoteScanMirrorSection({
  progress,
  previewUrl,
  resultUrl,
}: {
  progress: RemoteScanProgress;
  previewUrl: string | null;
  resultUrl: string | null;
}) {
  // =================================
  //  RENDER
  // =================================
  if (progress.step === "ocr") {
    return (
      <LoadingStepSection
        message="Il telefono sta riconoscendo il testo..."
        imageUrl={previewUrl}
      />
    );
  }

  if (progress.step === "searching") {
    return (
      <LoadingStepSection
        message="Il telefono sta cercando la carta su PokeWallet..."
        imageUrl={previewUrl}
      />
    );
  }

  if (progress.step === "saving") {
    return (
      <LoadingStepSection
        message="Il telefono sta inviando la carta..."
        imageUrl={resultUrl ?? previewUrl}
      />
    );
  }

  if (progress.step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="text-emerald-500" size={40} />
        <p className="text-sm font-medium">Carta salvata!</p>
      </div>
    );
  }

  return null;
}
