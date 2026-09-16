import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { getImageBlob } from "../../services/opfs/images.ts";

interface OpfsImageProps {
  path?: string | null;
  alt?: string;
  className?: string;
}

/**
 * Componente React per caricare e visualizzare un'immagine salvata in OPFS.
 * Crea un Object URL dal Blob e provvede al revoke automatico per liberare memoria.
 */
export default function OpfsImage({
  path,
  alt = "Immagine",
  className = "",
}: OpfsImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [error, setError] = useState<boolean>(!path);

  useEffect(() => {
    if (!path) return;

    let currentUrl: string | null = null;
    let isCancelled = false;

    async function load() {
      try {
        const blob = await getImageBlob(path!);
        if (isCancelled) return;

        if (blob) {
          currentUrl = URL.createObjectURL(blob);
          setObjectUrl(currentUrl);
          setLoading(false);
          setError(false);
        } else {
          setError(true);
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn(`Errore caricamento immagine OPFS (${path}):`, err);
          setError(true);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isCancelled = true;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [path]);

  if (!path || error || !objectUrl) {
    if (loading) {
      return (
        <div
          className={`flex items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800 ${className}`}
        >
          <Loader2 className="animate-spin text-amber-500" size={24} />
        </div>
      );
    }

    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800 ${className}`}
        title="Immagine non trovata in OPFS"
      >
        <ImageOff size={24} strokeWidth={1.5} />
        <span className="text-[10px] mt-1 text-slate-400">Non in OPFS</span>
      </div>
    );
  }

  return (
    <img
      src={objectUrl}
      alt={alt}
      className={`object-cover ${className}`}
      loading="lazy"
    />
  );
}
