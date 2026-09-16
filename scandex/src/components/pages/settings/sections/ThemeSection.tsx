// =================================
//  IMPORTS
// =================================
import { Laptop, Moon, Sun } from "lucide-react";
import type { ThemeMode } from "../../../../services/settings/settingsService.ts";

// =================================
//  CONSTS
// =================================
const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "dark", label: "Scuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Laptop },
];

// =================================
//  COMPONENT
// =================================
export default function ThemeSection({
  theme,
  onChange,
}: {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}) {
  // =================================
  //  RENDER
  // =================================
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-3 text-sm font-semibold">Tema</h2>
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-colors ${
              theme === value
                ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
