import { useEffect, useState } from "react";
import { Menu as MenuIcon, X } from "lucide-react";
import { navigate } from "./nav";
import CountryPicker from "./CountryPicker";
import type { Country } from "./packs";

const ICON = { size: 20, strokeWidth: 2 } as const;
const ITEMS: { label: string; path: string }[] = [
  { label: "Play Inkling", path: "/" },
  { label: "The simulation", path: "/simulation" },
  { label: "How it was built", path: "/built" },
];

/** Hamburger + paper sheet sliding in from the left (prompts/14 A).
 *  Rendered only on the landing and simulation pages, never in game rounds. */
export default function AppMenu({ path, country, onCountry }: { path: string; country?: Country; onCountry?: (c: Country) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);
  return (
    <div className="appmenu">
      <button className="menubtn iconbtn" aria-label="Open menu" aria-expanded={open} aria-haspopup="dialog"
        onClick={() => setOpen(true)}><MenuIcon {...ICON} aria-hidden="true" /></button>
      {open && (
        <div className="menuscrimwrap">
          <button className="menuscrim" aria-label="Close menu" onClick={() => setOpen(false)} />
          <nav className="menusheet" role="dialog" aria-label="Menu">
            <div className="menuhead">
              <span className="menuword">Inkling</span>
              <button className="menubtn iconbtn" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X {...ICON} aria-hidden="true" /></button>
            </div>
            {ITEMS.map((it) => (
              <a key={it.path} className={"menuitem" + (path === it.path ? " on" : "")} href={it.path}
                aria-current={path === it.path ? "page" : undefined}
                onClick={(e) => { e.preventDefault(); setOpen(false); navigate(it.path); }}>{it.label}</a>
            ))}
            {country && onCountry && (<div className="menurow">
              <span className="menurowlabel">Country</span>
              <CountryPicker value={country} onChange={(c) => { setOpen(false); onCountry(c); }} />
            </div>)}
          </nav>
        </div>
      )}
    </div>
  );
}
