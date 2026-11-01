import AppMenu from "./Menu";
export default function Simulation() {
  return (
    <div className="simpage">
      <header className="simhead"><AppMenu path="/simulation" /><h1>The simulation</h1></header>
      <main className="simmain"><p className="note">Loading…</p></main>
    </div>
  );
}
