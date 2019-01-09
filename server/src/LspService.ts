import {
    TextDocument,
    Diagnostic, CompletionItem, Position, Range, DiagnosticSeverity, CompletionList
} from "vscode-languageserver-types";
import { globalSuggestions, txFieldsItems, txTypesItems } from './suggestions'
import { safeCompile } from './safeCompile'

export class LspService {
    public validateTextDocument(document: TextDocument): Diagnostic[] {
        let diagnostics: Diagnostic[] = []
        let result = safeCompile(document.getText())
        const errorText = result.error
        if (errorText) {
            const errRangesRegxp = /\d+-\d+/gm
            const errorRanges:string[] = errRangesRegxp.exec(errorText) || []
            const errors = errorRanges.map(offsets => {
                const [start, end] = offsets.split('-').map(offset => document.positionAt(parseInt(offset)))
                const range = Range.create(start, end)
                return {
                    range,
                    severity: DiagnosticSeverity.Error,
                    message: errorText
                }
            })
            diagnostics.push(...errors)
        }
        return diagnostics
    }

    public completion(document: TextDocument, position: Position) {
        const offset = document.offsetAt(position)
        const character = document.getText().substring(offset - 1, offset)
        const line = document.getText({ start: { line: position.line, character: 0 }, end: position })
        const textBefore = document.getText({ start: { line: 0, character: 0 }, end: position })
        
        // Find variable declarations inside case statements and make regex that matches tx. or any case declaration.
        const caseDeclarations = this.findCaseDeclarations(textBefore)
        const txFieldRegex = new RegExp(`\\b(${['tx', ...caseDeclarations].join('|')}\\.)`)
        let result: CompletionItem[] = []

        switch (true) {
            case line.match(txFieldRegex) !== null:
                    result = txFieldsItems
                break;
            case line.match(/\bcase[ \t]+(.+):[a-zA-Z0-9_]*$/) !== null:
                    result = txTypesItems
                break;
            case line.split(' ')[line.split(' ').length -1].match(/\.|:/) !==null:
                break;   
            default:
                const letDeclarations = this.findLetDeclarations(textBefore).map(label => ({ label }))  
                result = globalSuggestions.concat(letDeclarations);
        }


        return {
            isIncomplete: false,
            items: result
        } as CompletionList
    }

    public completionResolve(item: CompletionItem) {
        return item
    }

    private findLetDeclarations(text: string): string[] {
        const re = /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm
        const declarations: string[] = []
        let myMatch;

        while ((myMatch = re.exec(text)) !== null) {
            declarations.push(myMatch[1])
        }

        return declarations
    }

    private findCaseDeclarations(text: string): string[] {
        const re = /\bcase[ \t]+([a-zA-z][a-zA-z0-9_]*):/gm
        const declarations: string[] = []
        let myMatch;

        while ((myMatch = re.exec(text)) !== null) {
            declarations.push(myMatch[1])
        }

        return declarations
    }
}