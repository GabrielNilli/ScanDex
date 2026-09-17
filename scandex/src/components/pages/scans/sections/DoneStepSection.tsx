// =================================
//  IMPORTS
// =================================
import { Camera, CheckCircle2 } from "lucide-react";

// =================================
//  COMPONENT
// =================================
export default function DoneStepSection({
  onScanAnother,
  message = "Carta salvata nella tua collezione!",
}: {
  onScanAnother: () => void;
  message?: string;
}) {
  // =================================
  //  RENDER
  // =================================
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <CheckCircle2 className="text-emerald-500" size={40} />
      <p className="text-sm font-medium">{message}</p>
      <button
        onClick={onScanAnother}
        className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-500"
      >
        <Camera size={16} />
        Scansiona un&apos;altra carta
      </button>
    </div>
  );
}
