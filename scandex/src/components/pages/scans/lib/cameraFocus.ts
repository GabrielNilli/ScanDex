/**
 * Controllo del fuoco della fotocamera tramite le estensioni sperimentali di
 * MediaStreamTrack (focusMode / pointsOfInterest, parte della bozza Image
 * Capture API). Supportate solo su Chrome/Chromium per Android: su Safari/iOS
 * e sui browser desktop senza questo supporto le funzioni non fanno nulla,
 * lasciando l'autofocus nativo del dispositivo fare il suo lavoro.
 */

interface FocusCapabilities {
  focusMode?: string[];
}

interface FocusConstraintSet extends MediaTrackConstraintSet {
  focusMode?: string;
  pointsOfInterest?: { x: number; y: number }[];
}

function supportsFocusMode(track: MediaStreamTrack, mode: string): boolean {
  const caps = track.getCapabilities?.() as
    | (MediaTrackCapabilities & FocusCapabilities)
    | undefined;
  return Boolean(caps?.focusMode?.includes(mode));
}

/** Attiva la messa a fuoco automatica continua, se il dispositivo la supporta. */
export async function enableContinuousFocus(
  track: MediaStreamTrack,
): Promise<void> {
  if (!supportsFocusMode(track, "continuous")) return;
  try {
    const constraints: FocusConstraintSet = { focusMode: "continuous" };
    await track.applyConstraints({ advanced: [constraints] });
  } catch {
    // Non supportato o rifiutato dal browser: resta l'autofocus di default.
  }
}

/**
 * Sposta il punto di messa a fuoco nella posizione indicata (coordinate 0..1
 * relative al frame, es. 0.5/0.5 = centro), utile sia per il "tocca per
 * mettere a fuoco" manuale sia per rinfrescare il fuoco appena prima di uno
 * scatto.
 */
export async function focusAtPoint(
  track: MediaStreamTrack,
  x: number,
  y: number,
): Promise<void> {
  if (
    !supportsFocusMode(track, "continuous") &&
    !supportsFocusMode(track, "single-shot")
  ) {
    return;
  }
  try {
    const constraints: FocusConstraintSet = {
      pointsOfInterest: [{ x, y }],
    };
    await track.applyConstraints({ advanced: [constraints] });
  } catch {
    // Idem: se il browser non supporta i punti di interesse, si ignora.
  }
}
