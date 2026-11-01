import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ShareReplay from "./ShareReplay";
import "./styles.css";

const m = window.location.pathname.match(/^\/r\/([A-Za-z0-9_-]+)/);
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{m ? <ShareReplay code={m[1]} /> : <App />}</React.StrictMode>);
