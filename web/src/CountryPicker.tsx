import { COUNTRIES, PACKS, type Country } from "./packs";

/** Three small pills: UK · USA · Other. Used on the "Before we start" card
 * and in the menu. */
export default function CountryPicker({ value, onChange, label = "Country" }: { value: Country; onChange: (c: Country) => void; label?: string }) {
  return (
    <div className="countrypick" role="group" aria-label={label}>
      {COUNTRIES.map((c) => (
        <button key={c} type="button" className={"countrypill" + (value === c ? " on" : "")} aria-pressed={value === c} onClick={() => onChange(c)}>
          <span aria-hidden="true">{PACKS[c].flag}</span> {PACKS[c].label}
        </button>
      ))}
    </div>
  );
}
