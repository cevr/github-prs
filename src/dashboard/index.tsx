import "../app.css"
import { render } from "@solidjs/web"
import { Dashboard } from "./dashboard"

const root = document.getElementById("root")
if (root) render(() => <Dashboard />, root)
