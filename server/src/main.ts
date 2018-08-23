'use strict';

import {
	createConnection,
	TextDocuments,
	TextDocument,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
    DidChangeConfigurationNotification,
    DidOpenTextDocumentParams,
    DidCloseTextDocumentParams,
    DidChangeTextDocumentParams,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
    IConnection,
    Files
} from 'vscode-languageserver';
import * as fs from 'fs'
import {suggestions} from './suggestions'
import {LspService} from './LspService'

class LspServer {
    private connection: IConnection
    private service: LspService
    private documents: {[uri: string]: TextDocument} = {}

    constructor(){
        this.connection = createConnection()
        this.service = new LspService()

        const connection = createConnection();
        const service = new LspService()
    
        // Bind connection events to server methods
        // Init
        connection.onInitialize(service.initialize.bind(service));
        connection.onInitialized(service.initialized.bind(service));
    
        // Document changes
        connection.onDidOpenTextDocument((didOpenTextDocumentParams: DidOpenTextDocumentParams): void => {
            let document = TextDocument.create(didOpenTextDocumentParams.textDocument.uri, didOpenTextDocumentParams.textDocument.languageId, didOpenTextDocumentParams.textDocument.version, didOpenTextDocumentParams.textDocument.text);
            this.documents[didOpenTextDocumentParams.textDocument.uri] = document;
            service.didChangeContent(document)
        });
        connection.onDidCloseTextDocument((didCloseTextDocumentParams: DidCloseTextDocumentParams): void => {
            delete this.documents[didCloseTextDocumentParams.textDocument.uri];
        });
        connection.onDidChangeTextDocument((didChangeTextDocumentParams: DidChangeTextDocumentParams): void => {
            const document = this.documents[didChangeTextDocumentParams.textDocument.uri];
            const changedDocument = this.applyChanges(document, didChangeTextDocumentParams)    
            this.documents[didChangeTextDocumentParams.textDocument.uri] = changedDocument;
            if (document.getText() !== changedDocument.getText()) {
                service.didChangeContent(document)
            }
        });
    
        // Lsp callbacks
        // connection.onCodeAction(service.codeAction.bind(service));
        // connection.onCompletion(service.completion.bind(service));
        // connection.onCompletionResolve(service.completionResolve.bind(service));
        // connection.onDefinition(service.definition.bind(service));
        // connection.onImplementation(service.implementation.bind(service));
        // connection.onTypeDefinition(service.typeDefinition.bind(service));
        // connection.onDocumentFormatting(service.documentFormatting.bind(service));
        // connection.onDocumentHighlight(service.documentHighlight.bind(service));
        // connection.onDocumentSymbol(service.documentSymbol.bind(service));
        // connection.onExecuteCommand(service.executeCommand.bind(service));
        // connection.onHover(service.hover.bind(service));
        // connection.onReferences(service.references.bind(service));
        // connection.onRenameRequest(service.rename.bind(service));
        // connection.onSignatureHelp(service.signatureHelp.bind(service));
        // connection.onWorkspaceSymbol(service.workspaceSymbol.bind(service));
        // connection.onFoldingRanges(service.foldingRanges.bind(service));
    
        // Listen
        connection.listen()
    }

    async getDocument(uri:string){
        let document = this.documents[uri]
        if (!document){
            const path = Files.uriToFilePath(uri)
            document = await new Promise<TextDocument>((resolve,reject)=>{
                fs.access(path, (err)=> {
                    if (err){
                        resolve(null)
                    }else{
                        fs.readFile(path, (err, data)=> {
                            resolve(TextDocument.create(uri, "ride", 1, data.toString()))
                        })
                    }
                })
            })
        } 
        return document
    }

    applyChanges(document: TextDocument, didChangeTextDocumentParams: DidChangeTextDocumentParams): TextDocument {
        let buffer = document.getText();
        let changes = didChangeTextDocumentParams.contentChanges;
        for (let i = 0; i < changes.length; i++) {
            if (!changes[i].range && !changes[i].rangeLength) {
                // no ranges defined, the text is the entire document then
                buffer = changes[i].text;
                break;
            }
    
            let offset = document.offsetAt(changes[i].range.start);
            let end = null;
            if (changes[i].range.end) {
                end = document.offsetAt(changes[i].range.end);
            } else {
                end = offset + changes[i].rangeLength;
            }
            buffer = buffer.substring(0, offset) + changes[i].text + buffer.substring(end);
        }
        const changedDocument = TextDocument.create(didChangeTextDocumentParams.textDocument.uri, document.languageId, didChangeTextDocumentParams.textDocument.version, buffer);
        return changedDocument
    }
}

new LspServer();