import "../app.css"
import { render } from "solid-js/web"
import { Dashboard } from "./dashboard"

const root = document.getElementById("root")
if (root) render(() => <Dashboard />, root)
