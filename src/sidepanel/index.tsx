import "../app.css"
import { render } from "@solidjs/web"
import { SidePanel } from "./sidepanel"

const root = document.getElementById("root")
if (root) render(() => <SidePanel />, root)
