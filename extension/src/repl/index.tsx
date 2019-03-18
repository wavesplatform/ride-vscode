import * as React from "react"
import { render } from "react-dom"
import { Repl } from '@waves/waves-repl';
import { setupCommunication } from './communication'


render(
    <div id='repl'><Repl ref={(repl) => {if (repl) setupCommunication(repl)}} theme='dark' /></div>,
    document.getElementById("root")
)
