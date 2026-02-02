import "./popup.css";
import { render } from "solid-js/web";
import { Popup } from "./popup";

const root = document.getElementById("root")!;

render(() => <Popup />, root);
