import * as React from "react"
import { render } from "react-dom"
import { Repl } from 'waves-repl'


// Render REPL
render(<div id='repl'><Repl theme='dark' /></div>, document.getElementById("root"))


// Try to aquire vscode api and send command, asking for current settings
try {
    const vscode = eval('acquireVsCodeApi()')
    vscode.postMessage({ command: 'GetDefaultSettings' })
} catch (e) {

}
// Listen for vscode messages
window.addEventListener('message', evt => {
    const message = evt.data
    if (message.command === 'ReplSettings') {
        console.log(message)
        Repl.updateEnv(message.value)
    }

});
