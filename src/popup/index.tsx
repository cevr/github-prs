import { createRoot } from "react-dom/client";
import { PopupApp } from "./popup";
import "./popup.css";

function start() {
  const root = createRoot(document.getElementById("root")!);
  root.render(<PopupApp />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
