// =================================
//  IMPORTS
// =================================
import { useState, type MouseEvent, type RefObject } from "react";
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
  onFocusTap,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  guideRef: RefObject<HTMLDivElement | null>;
  cameraError: string | null;
  cameraReady: boolean;
  onCapture: () => void;
  onFocusTap: (xFraction: number, yFraction: number) => void;
}) {
  const [focusMark, setFocusMark] = useState<{ x: number; y: number } | null>(
    null,
  );

  const handleTap = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onFocusTap(x, y);
    setFocusMark({ x: x * 100, y: y * 100 });
    setTimeout(() => setFocusMark(null), 700);
  };

  // =================================
  //  RENDER
  // =================================
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        onClick={handleTap}
        className="relative aspect-[3/4] w-full cursor-crosshair overflow-hidden rounded-2xl bg-black"
      >
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
        {focusMark && (
          <div
            className="pointer-events-none absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-amber-400"
            style={{ left: `${focusMark.x}%`, top: `${focusMark.y}%` }}
          />
        )}
        <p className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-white drop-shadow">
          {cameraReady ? (
            "Posiziona la carta dentro il riquadro. Tocca per mettere a fuoco."
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
