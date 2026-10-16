import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { PlatformProvider } from "./context";
import "./styles.css";

const official = document.createElement("link");
official.rel = "stylesheet";
official.href = "https://sports.ap.gov.in/styles.2f220c2a42a1d190.css";
official.onload = () => {
  const fix = document.createElement("link");
  fix.rel = "stylesheet";
  fix.href = "/saap-fix.css?v=47";
  fix.onload = () => {
    const arena = document.createElement("link");
    arena.rel = "stylesheet";
    arena.href = "/arena.css?v=35";
    document.head.appendChild(arena);
  };
  document.head.appendChild(fix);
};
official.onerror = () => {
  const arena = document.createElement("link");
  arena.rel = "stylesheet";
  arena.href = "/arena.css?v=33";
  document.head.appendChild(arena);
};
document.head.appendChild(official);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PlatformProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PlatformProvider>
  </React.StrictMode>
);
