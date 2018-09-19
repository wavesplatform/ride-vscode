import {
    TextDocument,
    Diagnostic, CompletionItem, Position, Range, DiagnosticSeverity
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
        let result: CompletionItem[] = []

        switch (character) {
            case '.':
                if (line.match(/\b(tx\.)/) !== null) {
                    result = txFieldsItems
                }
                break;
            case ':':
                if (line.match(/\bcase[ \t]+(.+):$/) !== null) {
                    result = txTypesItems
                }
                break;
            default:
                result = globalSuggestions;
        }
        return result
    }

    public completionResolve(item: CompletionItem) {
        return item
    }
}