import "../app.css"
import { render } from "@solidjs/web"
import { Options } from "./options"

const root = document.getElementById("root")
if (root) render(() => <Options />, root)
