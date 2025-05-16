import "./popup.css";
import { createRoot } from "react-dom/client";
import { startTransition } from "react";

import { Popup } from "./popup";

const root = createRoot(document.getElementById("root")!);
function start() {
  root.render(<Popup />);
}

startTransition(() => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
});
