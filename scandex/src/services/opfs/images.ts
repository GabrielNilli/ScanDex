/**
 * Servizio per la gestione dello storage delle immagini in OPFS (Origin Private File System).
 * Le immagini vengono salvate come singoli file nella cartella OPFS /images.
 * Nel database SQLite viene salvato unicamente il percorso relativo (es. "images/prod_1.jpg").
 */

const IMAGES_DIR = "images";

export interface StoredImageInfo {
  name: string;
  path: string;
  size: number;
  lastModified: number;
}

export interface StorageEstimateInfo {
  usage: number;
  quota: number;
  usageFormatted: string;
  quotaFormatted: string;
  percentUsed: number;
}

/**
 * Verifica se l'Origin Private File System (OPFS) è supportato dal browser.
 */
export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage !== "undefined" &&
    typeof navigator.storage.getDirectory === "function"
  );
}

/**
 * Ottiene l'handle della directory radice di OPFS.
 */
export async function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
  if (!isOpfsSupported()) {
    throw new Error("OPFS non è supportato in questo browser.");
  }
  return await navigator.storage.getDirectory();
}

/**
 * Ottiene o crea la cartella 'images' in OPFS.
 */
export async function getImagesDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await getOpfsRoot();
  return await root.getDirectoryHandle(IMAGES_DIR, { create: true });
}

/**
 * Normalizza il nome file rimuovendo eventuali prefissi 'images/' o '/images/'.
 */
function extractFilename(pathOrFilename: string): string {
  const clean = pathOrFilename.replace(/^\/?(images\/)?/, "");
  return clean.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Salva un'immagine (Blob o ArrayBuffer) nella cartella OPFS /images.
 * Restituisce il percorso relativo memorizzato nel DB (es. "images/prod_1.jpg").
 */
export async function saveImage(
  filename: string,
  data: Blob | ArrayBuffer | Uint8Array,
): Promise<string> {
  const safeFilename = extractFilename(filename);
  const imagesDir = await getImagesDirectory();

  const fileHandle = await imagesDir.getFileHandle(safeFilename, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(data as unknown as FileSystemWriteChunkType);
  await writable.close();

  return `${IMAGES_DIR}/${safeFilename}`;
}

/**
 * Recupera un file immagine da OPFS come Blob.
 */
export async function getImageBlob(
  pathOrFilename: string,
): Promise<Blob | null> {
  try {
    const filename = extractFilename(pathOrFilename);
    const imagesDir = await getImagesDirectory();
    const fileHandle = await imagesDir.getFileHandle(filename);
    return await fileHandle.getFile();
  } catch (err) {
    console.warn(
      `Impossibile leggere l'immagine OPFS "${pathOrFilename}":`,
      err,
    );
    return null;
  }
}

/**
 * Crea un Object URL per visualizzare l'immagine OPFS in un tag <img>.
 * Ricorda di revocare l'URL quando non serve più per liberare memoria.
 */
export async function getImageUrl(
  pathOrFilename: string,
): Promise<string | null> {
  const blob = await getImageBlob(pathOrFilename);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

/**
 * Elimina una specifica immagine da OPFS.
 */
export async function deleteImage(pathOrFilename: string): Promise<boolean> {
  try {
    const filename = extractFilename(pathOrFilename);
    const imagesDir = await getImagesDirectory();
    await imagesDir.removeEntry(filename);
    return true;
  } catch (err) {
    console.warn(
      `Impossibile eliminare l'immagine OPFS "${pathOrFilename}":`,
      err,
    );
    return false;
  }
}

/**
 * Elenca tutte le immagini salvate nella cartella OPFS /images con dettagli di dimensione.
 */
export async function listStoredImages(): Promise<StoredImageInfo[]> {
  if (!isOpfsSupported()) return [];
  try {
    const imagesDir = await getImagesDirectory();
    const result: StoredImageInfo[] = [];

    // FileSystemDirectoryHandle async iterable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [name, handle] of (imagesDir as any).entries()) {
      if (handle.kind === "file") {
        const fileHandle = handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        result.push({
          name,
          path: `${IMAGES_DIR}/${name}`,
          size: file.size,
          lastModified: file.lastModified,
        });
      }
    }
    return result;
  } catch (err) {
    console.warn("Errore durante la scansione delle immagini OPFS:", err);
    return [];
  }
}

/**
 * Rimuove tutte le immagini presenti nella cartella OPFS /images.
 */
export async function clearAllImages(): Promise<void> {
  if (!isOpfsSupported()) return;
  try {
    const root = await getOpfsRoot();
    try {
      await root.removeEntry(IMAGES_DIR, { recursive: true });
    } catch {
      // Cartella già assente
    }
    await root.getDirectoryHandle(IMAGES_DIR, { create: true });
  } catch (err) {
    console.error("Errore durante la pulizia delle immagini OPFS:", err);
  }
}

/**
 * Elenca tutti i file presenti alla radice di OPFS (compreso il file SQLite .sqlite3).
 */
export async function listOpfsRootFiles(): Promise<
  { name: string; kind: "file" | "directory"; size?: number }[]
> {
  if (!isOpfsSupported()) return [];
  try {
    const root = await getOpfsRoot();
    const list: { name: string; kind: "file" | "directory"; size?: number }[] =
      [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [name, handle] of (root as any).entries()) {
      if (handle.kind === "file") {
        const file = await (handle as FileSystemFileHandle).getFile();
        list.push({ name, kind: "file", size: file.size });
      } else {
        list.push({ name, kind: "directory" });
      }
    }
    return list;
  } catch (err) {
    console.warn("Errore scansione radice OPFS:", err);
    return [];
  }
}

/**
 * Helper per formattare i byte in formato leggibile (KB, MB).
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Ottiene la stima dello spazio occupato e della quota del browser.
 */
export async function getStorageEstimate(): Promise<StorageEstimateInfo> {
  if (
    typeof navigator !== "undefined" &&
    navigator.storage &&
    navigator.storage.estimate
  ) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 1;
    const percentUsed = Math.min(100, (usage / quota) * 100);

    return {
      usage,
      quota,
      usageFormatted: formatBytes(usage),
      quotaFormatted: formatBytes(quota),
      percentUsed: Number(percentUsed.toFixed(2)),
    };
  }

  return {
    usage: 0,
    quota: 0,
    usageFormatted: "N/D",
    quotaFormatted: "N/D",
    percentUsed: 0,
  };
}
