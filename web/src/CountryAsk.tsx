import { useState } from "react";
import { countryPayload, sendFeedback } from "./feedback";
import { countryAsked, markCountryAsked } from "./packs";

/** Shown on the explore page for the "Other" pack instead of course links:
 * one text box asking which country to build a pack for. Asked once per browser. */
export default function CountryAsk({ gameId }: { gameId: string }) {
  const [done, setDone] = useState(countryAsked);
  const [value, setValue] = useState("");
  if (done) return <p className="note countryask">Thanks — courses and apprenticeships are UK-only for now.</p>;
  const send = () => {
    const v = value.trim();
    if (!v) return;
    void sendFeedback(countryPayload(gameId, v));
    markCountryAsked();
    setDone(true);
  };
  return (
    <div className="countryask">
      <p className="note">Courses and apprenticeships are UK-only for now. Tell us your country and we'll build a pack:</p>
      <div className="countryrow">
        <input value={value} maxLength={80} placeholder="Your country" aria-label="Your country" autoComplete="country-name"
          onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
        <button type="button" className="btn" disabled={!value.trim()} onClick={send}>Send</button>
      </div>
    </div>
  );
}
