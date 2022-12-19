'use strict';

import {
    CompletionItem,
    CompletionList,
    Diagnostic,
    DidChangeConfigurationNotification,
    DidChangeTextDocumentParams,
    DidCloseTextDocumentParams,
    DidOpenTextDocumentParams,
    Files,
    Hover,
    IConnection,
    InitializeParams,
    SignatureHelp,
    TextDocument,
    TextDocumentPositionParams,
    TextDocumentSyncKind
} from 'vscode-languageserver';
import * as fs from 'fs';
import {LspService} from './LspService';
import {getLibURI} from "./utils/getLibURI";
import {scriptInfo} from '@waves/ride-js';

export class LspServer {
    private hasConfigurationCapability: boolean = false;
    private hasWorkspaceFolderCapability: boolean = false;
    private hasDiagnosticRelatedInformationCapability: boolean = false;

    private service: LspService;
    private documents: { [uri: string]: TextDocument } = {};

    constructor(private connection: IConnection) {
        this.service = new LspService();

        // Bind connection events to server methods
        // Init
        this.bindInit(connection);
        this.bindCallbacks(connection);

        // Listen
        this.connection.listen();
    }

    private async getDocument(uri: string, libPath?: string) {
        let document = this.documents[uri];
        if (!document) {
            const path = Files.uriToFilePath(uri) || './';
            document = await new Promise<TextDocument>((resolve) => {
                fs.access(path, (err) => {
                    if (err) {
                        resolve(undefined)
                    } else {
                        fs.readFile(path, (_, data) => {
                            resolve(TextDocument.create(uri, "ride", 1, data.toString()))
                        })
                    }
                })
            })
        }
        return document
    }

    private async getLibsContent(document: TextDocument) {
        let libs = {} as Record<string, string>
        try {
            const info = scriptInfo(document.getText());
            if ('imports' in info) {
                const {imports} = info;
                for (const libPath of imports) {
                    // console.log('getLibURI(document.uri, libPath)', getLibURI(document.uri, libPath))
                    console.log('document.uri', document.uri)
                    console.log('decodeURI(document.uri', decodeURI(document.uri))
                    console.log('libPath', libPath)
                    const file = await this.getDocument(getLibURI(decodeURI(document.uri), libPath))
                    // console.log('file', file)
                    libs[libPath] = file.getText();
                }
            }
        } catch (e) {
            console.error(e)
        }
        return libs
    }

    private applyChanges(document: TextDocument, didChangeTextDocumentParams: DidChangeTextDocumentParams): TextDocument {
        let buffer = document.getText();
        let changes = didChangeTextDocumentParams.contentChanges;

        for (let i = 0; i < changes.length; i++) {
            if (!changes[i].range && !changes[i].rangeLength) {
                // no ranges defined, the text is the entire document then
                buffer = changes[i].text;
                break;
            }
            let offset, end, range = changes[i].range;
            if (range !== undefined) {
                offset = document.offsetAt(range.start);
                end = null;
                if (range.end) {
                    end = document.offsetAt(range.end);
                } else {
                    end = offset + (changes[i].rangeLength || 0);
                }
            }

            buffer = buffer.substring(0, offset) + changes[i].text + buffer.substring(end || 0);
        }
        const changedDocument = TextDocument.create(didChangeTextDocumentParams.textDocument.uri, document.languageId, didChangeTextDocumentParams.textDocument.version || 0, buffer);
        return changedDocument
    }

    private bindInit(connection: IConnection = this.connection, service: LspService = this.service) {
        connection.onInitialize((params: InitializeParams) => {
            let capabilities = params.capabilities;

            // Does the client support the `workspace/configuration` request?
            // If not, we will fall back using global settings
            this.hasConfigurationCapability =
                !!capabilities.workspace && !!capabilities.workspace.configuration;
            this.hasWorkspaceFolderCapability =
                !!capabilities.workspace && !!capabilities.workspace.workspaceFolders;
            this.hasDiagnosticRelatedInformationCapability =
                !!capabilities.textDocument &&
                !!capabilities.textDocument.publishDiagnostics &&
                !!capabilities.textDocument.publishDiagnostics.relatedInformation;

            return {
                capabilities: {
                    textDocumentSync: TextDocumentSyncKind.Incremental,
                    // Tell the client that the server supports code completion
                    completionProvider: {
                        resolveProvider: true,
                        triggerCharacters: ['.', ':', '|', '@']
                    },
                    hoverProvider: true,
                    signatureHelpProvider: {
                        "triggerCharacters": ['(']
                    },
                    definitionProvider: true
                }
            }
        });
        connection.onInitialized(() => {
            if (this.hasConfigurationCapability) {
                // Register for all configuration changes.
                connection.client.register(
                    DidChangeConfigurationNotification.type,
                    undefined
                );
            }
            if (this.hasWorkspaceFolderCapability) {
                connection.workspace.onDidChangeWorkspaceFolders(_event => {
                    connection.console.log('Workspace folder change event received.');
                });
            }
        });
    }

    private async bindCallbacks(connection: IConnection = this.connection, service: LspService = this.service) {
        // Document changes
        connection.onDidOpenTextDocument(async (didOpenTextDocumentParams: DidOpenTextDocumentParams): Promise<void> => {
            let document = TextDocument.create(didOpenTextDocumentParams.textDocument.uri, didOpenTextDocumentParams.textDocument.languageId, didOpenTextDocumentParams.textDocument.version, didOpenTextDocumentParams.textDocument.text);
            this.documents[didOpenTextDocumentParams.textDocument.uri] = document;
            const libs = (await this.getLibsContent(document))
            const diagnostics = await service.validateTextDocument(document, libs);
            this.sendDiagnostics(document.uri, diagnostics);
        });

        connection.onDidCloseTextDocument((didCloseTextDocumentParams: DidCloseTextDocumentParams): void => {
            delete this.documents[didCloseTextDocumentParams.textDocument.uri];
        });

        connection.onDidChangeTextDocument(async (didChangeTextDocumentParams: DidChangeTextDocumentParams): Promise<void> => {
            const document = this.documents[didChangeTextDocumentParams.textDocument.uri];
            const changedDocument = this.applyChanges(document, didChangeTextDocumentParams);
            this.documents[didChangeTextDocumentParams.textDocument.uri] = changedDocument;
            if (document.getText() !== changedDocument.getText()) {
                const libs = await this.getLibsContent(document);
                const diagnostics = await service.validateTextDocument(changedDocument, libs);
                this.sendDiagnostics(document.uri, diagnostics);
            }
        });

        // Lsp callbacks
        // connection.onCodeAction(service.codeAction.bind(service));
        connection.onCompletion(async (textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[] | CompletionList> => {
            const document = await this.getDocument(textDocumentPosition.textDocument.uri);
            const libs = await this.getLibsContent(document)
            return service.completion(document, textDocumentPosition.position)
        });
        connection.onHover(async (textDocumentPosition: TextDocumentPositionParams): Promise<Hover> => {
            const document = await this.getDocument(textDocumentPosition.textDocument.uri);
            const libs = await this.getLibsContent(document)
            return service.hover(document, textDocumentPosition.position, libs)
        });
        connection.onSignatureHelp(async (textDocumentPosition: TextDocumentPositionParams): Promise<SignatureHelp> => {
            const document = await this.getDocument(textDocumentPosition.textDocument.uri);
            const libs = await this.getLibsContent(document)
            return service.signatureHelp(document, textDocumentPosition.position, libs);
        });
        connection.onDefinition(async (textDocumentPosition: TextDocumentPositionParams) => {
            const document = await this.getDocument(textDocumentPosition.textDocument.uri);
            const libs = await this.getLibsContent(document)
            return service.definition(document, textDocumentPosition.position, libs);
        });

        connection.onCompletionResolve(this.service.completionResolve.bind(service));
        // connection.onImplementation(service.implementation.bind(service));
        // connection.onTypeDefinition(service.typeDefinition.bind(service));
        // connection.onDocumentFormatting(service.documentFormatting.bind(service));
        // connection.onDocumentHighlight(service.documentHighlight.bind(service));
        // connection.onDocumentSymbol(service.documentSymbol.bind(service));
        // connection.onExecuteCommand(service.executeCommand.bind(service));
        // connection.onReferences(service.references.bind(service));
        // connection.onRenameRequest(service.rename.bind(service));
        // connection.onWorkspaceSymbol(service.workspaceSymbol.bind(service));
        // connection.onFoldingRanges(service.foldingRanges.bind(service));
    }

    private sendDiagnostics(uri: string, diagnostics: Diagnostic[]) {
        this.connection.sendDiagnostics({uri, diagnostics})
    }
}
