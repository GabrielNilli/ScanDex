// =================================
//  IMPORTS
// =================================
import { Loader2 } from "lucide-react";

// =================================
//  COMPONENT
// =================================
export default function LoadingStepSection({
  message,
  imageUrl,
}: {
  message: string;
  imageUrl?: string | null;
}) {
  // =================================
  //  RENDER
  // =================================
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Carta catturata"
          className="h-48 rounded-xl object-cover shadow-sm"
        />
      )}
      <Loader2 className="animate-spin text-amber-500" size={28} />
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}
