import React, { Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const ShareReplay = lazy(() => import("./ShareReplay"));
const Simulation = lazy(() => import("./Simulation"));
const Built = lazy(() => import("./Built"));
import "./styles.css";
import "./sim.css";
import "./built.css";

function Root() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  const m = path.match(/^\/r\/([A-Za-z0-9_-]+)/);
  if (m) return <Suspense fallback={null}><ShareReplay code={m[1]} /></Suspense>;
  if (path === "/simulation") return <Suspense fallback={null}><Simulation /></Suspense>;
  if (path === "/built") return <Suspense fallback={null}><Built /></Suspense>;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><Root /></React.StrictMode>);
