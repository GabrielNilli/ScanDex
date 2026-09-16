// =================================
//  IMPORTS
// =================================
import { NavLink } from "react-router-dom";
import { Layers, PlayingCardsFan, ScanLine, Settings } from "lucide-react";

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
export default function BottomTabs() {
  // =================================
  //  RENDER
  // =================================
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] pt-2 dark:border-slate-700 dark:bg-slate-800">
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] transition-colors ${
              isActive ? "text-amber-600 dark:text-amber-400" : "text-slate-400"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
