import * as React from "react"
import { createRoot } from "react-dom/client"
import { Repl } from "@waves/waves-repl";
import { setupCommunication } from './communication'

const rootElement = document.getElementById("root");

if (rootElement) {
    const root = createRoot(rootElement);

    root.render(
        <div id='repl'><Repl ref={(repl: Repl | null) => { if (repl) setupCommunication(repl) }} theme='dark' /></div>
    );
}
