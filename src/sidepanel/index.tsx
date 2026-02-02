import "../app.css"
import { render } from "solid-js/web"
import { SidePanel } from "./sidepanel"

const root = document.getElementById("root")
if (root) render(() => <SidePanel />, root)
