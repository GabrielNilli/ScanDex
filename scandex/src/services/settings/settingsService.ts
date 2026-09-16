/**
 * Servizio per le impostazioni generali dell'app (tema, collezione predefinita, ecc.).
 * Persistito in localStorage: non è un dato "di collezione" e non richiede OPFS/SQLite.
 */

export type ThemeMode = "light" | "dark" | "system";

export interface AppSettings {
  theme: ThemeMode;
  defaultCollectionId: number | null;
}

const STORAGE_KEY = "scandex:settings";

const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  defaultCollectionId: null,
};

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch };
  saveSettings(next);
  return next;
}

/**
 * Applica il tema al documento aggiungendo/rimuovendo la classe "dark" su <html>,
 * usata da Tailwind (darkMode: "class").
 */
export function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;

  const shouldBeDark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", Boolean(shouldBeDark));
}
