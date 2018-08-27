import { TextDocument, InitializeParams, Diagnostic, TextDocumentPositionParams, CompletionItem } from "vscode-languageserver";

export class LspService {
    public validateTextDocument(document: TextDocument): Diagnostic[] {
        let diagnostics: Diagnostic[] = []
        return diagnostics
    }

    public completion(document: TextDocument, params: TextDocumentPositionParams){
        return [] as CompletionItem[]
    }
}