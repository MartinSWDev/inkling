import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ShareReplay from "./ShareReplay";
import Simulation from "./Simulation";
import AppMenu from "./Menu";
import "./styles.css";
import "./sim.css";

function BuiltSoon() {
  return (
    <div className="simpage">
      <header className="simhead"><AppMenu path="/built" /><h1>How it was built</h1></header>
      <main className="simmain"><section className="simcard">
        <h2>Coming soon</h2>
        <p className="note">This page is on its way. For now, play Inkling or watch the simulation.</p>
      </section></main>
    </div>
  );
}

function Root() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  const m = path.match(/^\/r\/([A-Za-z0-9_-]+)/);
  if (m) return <ShareReplay code={m[1]} />;
  if (path === "/simulation") return <Simulation />;
  if (path === "/built") return <BuiltSoon />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><Root /></React.StrictMode>);
