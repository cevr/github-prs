import "./options.css"
import { render } from "solid-js/web"
import { Options } from "./options"

const root = document.getElementById("root")
if (root) render(() => <Options />, root)
