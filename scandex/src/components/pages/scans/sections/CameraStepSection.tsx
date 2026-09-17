// =================================
//  IMPORTS
// =================================
import type { RefObject } from "react";
import { AlertTriangle, Camera, Loader2 } from "lucide-react";

// =================================
//  COMPONENT
// =================================
export default function CameraStepSection({
  videoRef,
  guideRef,
  cameraError,
  cameraReady,
  onCapture,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  guideRef: RefObject<HTMLDivElement | null>;
  cameraError: string | null;
  cameraReady: boolean;
  onCapture: () => void;
}) {
  // =================================
  //  RENDER
  // =================================
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {/* Riquadro guida per il posizionamento della carta */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            ref={guideRef}
            className="relative aspect-[63/88] h-[78%] rounded-lg shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]"
          >
            <span className="absolute -left-0.5 -top-0.5 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-amber-400" />
            <span className="absolute -right-0.5 -top-0.5 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-amber-400" />
            <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-amber-400" />
            <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-amber-400" />
          </div>
        </div>
        <p className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-white drop-shadow">
          {cameraReady ? (
            "Posiziona la carta dentro il riquadro"
          ) : (
            <>
              <Loader2 size={12} className="animate-spin" />
              Messa a fuoco in corso...
            </>
          )}
        </p>
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-6 text-center text-sm text-white">
            <AlertTriangle className="text-amber-400" size={28} />
            {cameraError}
          </div>
        )}
      </div>

      <div className="flex w-full items-center gap-3">
        <button
          onClick={onCapture}
          disabled={Boolean(cameraError) || !cameraReady}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-amber-500 disabled:opacity-40"
        >
          <Camera size={18} />
          Scatta
        </button>
      </div>
    </div>
  );
}
