// =================================
//  IMPORTS
// =================================
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import OpfsImage from "../ui/OpfsImage.tsx";

// =================================
//  COMPONENT
// =================================
/**
 * Immagine della carta nel dettaglio con una leggera inclinazione 3D e un
 * riflesso che segue il puntatore, tipo effetto "olografica". I Pointer
 * Events unificano mouse e touch: su desktop segue il cursore al passaggio,
 * su telefono segue il dito mentre si trascina sulla carta.
 */
export default function HoloCardImage({
  path,
  alt,
  className = "",
}: {
  path?: string | null;
  alt?: string;
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomed]);

  const updateTilt = (e: PointerEvent<HTMLDivElement>) => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * 18;
    const rotateX = (0.5 - y) * 18;
    el.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`;
    el.style.setProperty("--holo-x", `${x * 100}%`);
    el.style.setProperty("--holo-y", `${y * 100}%`);
    el.style.setProperty("--holo-opacity", "1");
  };

  const resetTilt = () => {
    const el = wrapperRef.current;
    if (!el) return;
    el.style.transform = "";
    el.style.setProperty("--holo-opacity", "0");
  };

  // =================================
  //  RENDER
  // =================================
  return (
    <>
      <div
        ref={wrapperRef}
        onPointerMove={updateTilt}
        onPointerDown={updateTilt}
        onPointerLeave={resetTilt}
        onPointerUp={resetTilt}
        onPointerCancel={resetTilt}
        onClick={() => setZoomed(true)}
        className={`relative cursor-zoom-in touch-none transition-transform duration-200 ease-out will-change-transform ${className}`}
      >
        <OpfsImage path={path} alt={alt} className="h-full w-full rounded-[inherit]" />
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-overlay"
          style={{
            background:
              "radial-gradient(circle at var(--holo-x, 50%) var(--holo-y, 50%), rgba(255,255,255,0.85), rgba(255,255,255,0) 45%)",
            opacity: "var(--holo-opacity, 0)",
            transition: "opacity 300ms ease-out",
          }}
        />
      </div>

      {zoomed &&
        createPortal(
          // Renderizzato direttamente su document.body: essendo annidato dentro
          // il dettaglio carta, un semplice z-index più alto non basta a
          // garantire che stia sopra a tutto (l'antenato con will-change
          // dell'effetto tilt crea un proprio contesto di stacking).
          <div
            onClick={() => setZoomed(false)}
            className="fixed inset-0 z-[80] flex cursor-zoom-out items-center justify-center bg-black/90 p-6"
          >
            <button
              onClick={() => setZoomed(false)}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <X size={20} />
            </button>
            <OpfsImage
              path={path}
              alt={alt}
              className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
