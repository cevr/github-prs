import "./popup.css"
import { render } from "solid-js/web"
import { Popup } from "./popup"

const root = document.getElementById("root")
if (root) render(() => <Popup />, root)
