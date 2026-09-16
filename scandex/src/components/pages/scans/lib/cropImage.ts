/**
 * Calcola il rettangolo (in pixel nativi del video) corrispondente al riquadro guida
 * mostrato a schermo, tenendo conto dello scaling "object-fit: cover" del video.
 */
export function computeCropRect(
  video: HTMLVideoElement,
  guideEl: HTMLDivElement,
) {
  const videoRect = video.getBoundingClientRect();
  const guideRect = guideEl.getBoundingClientRect();

  const nativeW = video.videoWidth;
  const nativeH = video.videoHeight;

  const scale = Math.max(
    videoRect.width / nativeW,
    videoRect.height / nativeH,
  );
  const renderedW = nativeW * scale;
  const renderedH = nativeH * scale;
  const offsetX = (videoRect.width - renderedW) / 2;
  const offsetY = (videoRect.height - renderedH) / 2;

  const guideXInVideo = guideRect.left - videoRect.left;
  const guideYInVideo = guideRect.top - videoRect.top;

  const contentX = guideXInVideo - offsetX;
  const contentY = guideYInVideo - offsetY;

  const sx = Math.max(0, contentX / scale);
  const sy = Math.max(0, contentY / scale);
  const sw = Math.min(guideRect.width / scale, nativeW - sx);
  const sh = Math.min(guideRect.height / scale, nativeH - sy);

  return { sx, sy, sw, sh };
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Cattura fallita"))),
      "image/jpeg",
      0.92,
    );
  });
}
