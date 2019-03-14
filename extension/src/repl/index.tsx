import * as React from "react"
import { render } from "react-dom"
import { Repl } from '@waves/waves-repl';
import { setupCommunication } from './communication'

setupCommunication()

render(<div id='repl'><Repl theme='dark' /></div>, document.getElementById("root"))
