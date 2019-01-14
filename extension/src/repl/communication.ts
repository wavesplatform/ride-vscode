import { Repl } from 'waves-repl'

export function setupCommunication(){
    // Try to aquire vscode api and send command, asking for current settings
    try {
        const vscode = eval('acquireVsCodeApi()')
        vscode.postMessage({ command: 'GetDefaultSettings' })
    } catch (e) {

    }

    // Provide file function to REPL
    type TEditorsContent = {
        selectedEditor: number,
        editors: { label: string, code: string }[]
    }

    let editorsContent: TEditorsContent = {
        selectedEditor: -1,
        editors: []
    };

    function file(tabName?: string) {
        if (tabName == null) {
            return editorsContent.editors[editorsContent.selectedEditor]
        }
        else {
            return editorsContent.editors.find(editor => editor.label === tabName)
        }
    }
    Repl.updateEnv({ file })


    // Listen for vscode messages
    window.addEventListener('message', evt => {
        const message = evt.data
        if (message.command === 'ReplSettings') {
            console.log(message)
            Repl.updateEnv(message.value)
        }
        if (message.command === 'EditorsContent') {
            editorsContent = message.value
        }
    });
}