// =================================
//  IMPORTS
// =================================
import { NavLink } from "react-router-dom";
import { Layers, PlayingCardsFan, ScanLine, Settings } from "lucide-react";
import Logo from "./Logo.tsx";

// =================================
//  CONSTS
// =================================
const tabs = [
  { to: "/collections", icon: PlayingCardsFan, label: "Collezioni" },
  { to: "/sets", icon: Layers, label: "Set" },
  { to: "/scans", icon: ScanLine, label: "Scans" },
  { to: "/settings", icon: Settings, label: "Impostazioni" },
];

// =================================
//  COMPONENT
// =================================
/** Barra di navigazione laterale mostrata solo su schermi grandi (desktop). Su
 * mobile la navigazione resta la barra inferiore (BottomTabs). */
export default function SideNav() {
  // =================================
  //  RENDER
  // =================================
  return (
    <nav className="hidden w-56 shrink-0 border-r border-slate-200 bg-white px-3 py-6 dark:border-slate-700 dark:bg-slate-800 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
      <div className="mb-8 flex items-center gap-2 px-2">
        <Logo size={26} />
        <span className="font-headline text-lg font-bold tracking-tight">
          ScanDex
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
