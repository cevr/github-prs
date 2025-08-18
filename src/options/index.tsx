import { createRoot } from "react-dom/client";
import { Options } from "./options";
import "./options.css";

function start() {
  const root = createRoot(document.getElementById("root")!);
  root.render(<Options />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
