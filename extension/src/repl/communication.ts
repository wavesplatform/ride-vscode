import { Repl } from '@waves/waves-repl';

export function setupCommunication(repl: Repl){
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
            const file = editorsContent.editors[editorsContent.selectedEditor]
            return file && file.code
        }
        else {
            const file = editorsContent.editors.find(editor => editor.label === tabName)
            return file && file.code
        }
    }
    repl.updateEnv({ file })


    // Listen for vscode messages
    window.addEventListener('message', evt => {
        const message = evt.data
        if (message.command === 'ReplSettings') {
            console.log(message)
            repl.updateEnv(message.value)
        }
        if (message.command === 'EditorsContent') {
            editorsContent = message.value
        }
    });
}