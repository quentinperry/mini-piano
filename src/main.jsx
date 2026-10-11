import React from "react";
import { createRoot } from "react-dom/client";
import PianoApp from "./PianoApp";
import "./styles.css";

createRoot(document.getElementById("root")).render(<PianoApp />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}