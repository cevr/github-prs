import { createRoot } from "react-dom/client";
import { OptionsApp } from "./options";
import "./options.css";

function start() {
  const root = createRoot(document.getElementById("root")!);
  root.render(<OptionsApp />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
