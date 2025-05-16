import "./popup.css";
import { createRoot } from "react-dom/client";
import { startTransition } from "react";

import { PopupApp } from "./popup";

function start() {
  const root = createRoot(document.getElementById("root")!);
  startTransition(() => {
    root.render(<PopupApp />);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
