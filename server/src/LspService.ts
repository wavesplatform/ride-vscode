import {
    TextDocument,
    Diagnostic, CompletionItem, Position
} from "vscode-languageserver-types";
import { globalSuggestions, txFieldsItems, txTypesItems } from './suggestions'

export class LspService {
    public validateTextDocument(document: TextDocument): Diagnostic[] {
        let diagnostics: Diagnostic[] = []
        return diagnostics
    }

    public completion(document: TextDocument, position: Position) {
        const offset = document.offsetAt(position)
        const character = document.getText().substring(offset - 1, offset)
        const line = document.getText({ start: { line: position.line, character: 0 }, end: position })
        let result: CompletionItem[] = []

        switch (character) {
            case '.':

                if (line.match(/\b(tx\.)/g) !== null) {
                    result = txFieldsItems
                }
                break;
            case ':':
                if (line.match(/\b(tx:)/g) !== null) {
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