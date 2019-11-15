'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var vscode_languageserver_1 = require("vscode-languageserver");
var fs = require("fs");
var LspService_1 = require("./LspService");
var LspServer = /** @class */ (function () {
    function LspServer(connection) {
        this.connection = connection;
        this.hasConfigurationCapability = false;
        this.hasWorkspaceFolderCapability = false;
        this.hasDiagnosticRelatedInformationCapability = false;
        this.documents = {};
        this.service = new LspService_1.LspService();
        // Bind connection events to server methods
        // Init
        this.bindInit(connection);
        this.bindCallbacks(connection);
        // Listen
        this.connection.listen();
    }
    LspServer.prototype.getDocument = function (uri) {
        return __awaiter(this, void 0, void 0, function () {
            var document, path_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        document = this.documents[uri];
                        if (!!document) return [3 /*break*/, 2];
                        path_1 = vscode_languageserver_1.Files.uriToFilePath(uri) || './';
                        return [4 /*yield*/, new Promise(function (resolve) {
                                fs.access(path_1, function (err) {
                                    if (err) {
                                        resolve(undefined);
                                    }
                                    else {
                                        fs.readFile(path_1, function (_, data) {
                                            resolve(vscode_languageserver_1.TextDocument.create(uri, "ride", 1, data.toString()));
                                        });
                                    }
                                });
                            })];
                    case 1:
                        document = _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/, document];
                }
            });
        });
    };
    LspServer.prototype.applyChanges = function (document, didChangeTextDocumentParams) {
        var buffer = document.getText();
        var changes = didChangeTextDocumentParams.contentChanges;
        for (var i = 0; i < changes.length; i++) {
            if (!changes[i].range && !changes[i].rangeLength) {
                // no ranges defined, the text is the entire document then
                buffer = changes[i].text;
                break;
            }
            var offset = void 0, end = void 0, range = changes[i].range;
            if (range !== undefined) {
                offset = document.offsetAt(range.start);
                end = null;
                if (range.end) {
                    end = document.offsetAt(range.end);
                }
                else {
                    end = offset + (changes[i].rangeLength || 0);
                }
            }
            buffer = buffer.substring(0, offset) + changes[i].text + buffer.substring(end || 0);
        }
        var changedDocument = vscode_languageserver_1.TextDocument.create(didChangeTextDocumentParams.textDocument.uri, document.languageId, didChangeTextDocumentParams.textDocument.version || 0, buffer);
        return changedDocument;
    };
    LspServer.prototype.bindInit = function (connection, service) {
        var _this = this;
        if (connection === void 0) { connection = this.connection; }
        if (service === void 0) { service = this.service; }
        connection.onInitialize(function (params) {
            var capabilities = params.capabilities;
            // Does the client support the `workspace/configuration` request?
            // If not, we will fall back using global settings
            _this.hasConfigurationCapability =
                !!capabilities.workspace && !!capabilities.workspace.configuration;
            _this.hasWorkspaceFolderCapability =
                !!capabilities.workspace && !!capabilities.workspace.workspaceFolders;
            _this.hasDiagnosticRelatedInformationCapability =
                !!capabilities.textDocument &&
                    !!capabilities.textDocument.publishDiagnostics &&
                    !!capabilities.textDocument.publishDiagnostics.relatedInformation;
            return {
                capabilities: {
                    textDocumentSync: vscode_languageserver_1.TextDocumentSyncKind.Incremental,
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
            };
        });
        connection.onInitialized(function () {
            if (_this.hasConfigurationCapability) {
                // Register for all configuration changes.
                connection.client.register(vscode_languageserver_1.DidChangeConfigurationNotification.type, undefined);
            }
            if (_this.hasWorkspaceFolderCapability) {
                connection.workspace.onDidChangeWorkspaceFolders(function (_event) {
                    connection.console.log('Workspace folder change event received.');
                });
            }
        });
    };
    LspServer.prototype.bindCallbacks = function (connection, service) {
        var _this = this;
        if (connection === void 0) { connection = this.connection; }
        if (service === void 0) { service = this.service; }
        // Document changes
        connection.onDidOpenTextDocument(function (didOpenTextDocumentParams) {
            var document = vscode_languageserver_1.TextDocument.create(didOpenTextDocumentParams.textDocument.uri, didOpenTextDocumentParams.textDocument.languageId, didOpenTextDocumentParams.textDocument.version, didOpenTextDocumentParams.textDocument.text);
            _this.documents[didOpenTextDocumentParams.textDocument.uri] = document;
            var diagnostics = service.validateTextDocument(document);
            _this.sendDiagnostics(document.uri, diagnostics);
        });
        connection.onDidCloseTextDocument(function (didCloseTextDocumentParams) {
            delete _this.documents[didCloseTextDocumentParams.textDocument.uri];
        });
        connection.onDidChangeTextDocument(function (didChangeTextDocumentParams) {
            var document = _this.documents[didChangeTextDocumentParams.textDocument.uri];
            var changedDocument = _this.applyChanges(document, didChangeTextDocumentParams);
            _this.documents[didChangeTextDocumentParams.textDocument.uri] = changedDocument;
            if (document.getText() !== changedDocument.getText()) {
                var diagnostics = service.validateTextDocument(changedDocument);
                _this.sendDiagnostics(document.uri, diagnostics);
            }
        });
        // Lsp callbacks
        // connection.onCodeAction(service.codeAction.bind(service));
        connection.onCompletion(function (textDocumentPosition) { return __awaiter(_this, void 0, void 0, function () {
            var document;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDocument(textDocumentPosition.textDocument.uri)];
                    case 1:
                        document = _a.sent();
                        return [2 /*return*/, service.completion(document, textDocumentPosition.position)];
                }
            });
        }); });
        connection.onHover(function (textDocumentPosition) { return __awaiter(_this, void 0, void 0, function () {
            var document;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDocument(textDocumentPosition.textDocument.uri)];
                    case 1:
                        document = _a.sent();
                        return [2 /*return*/, service.hover(document, textDocumentPosition.position)];
                }
            });
        }); });
        connection.onSignatureHelp(function (textDocumentPosition) { return __awaiter(_this, void 0, void 0, function () {
            var document;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDocument(textDocumentPosition.textDocument.uri)];
                    case 1:
                        document = _a.sent();
                        return [2 /*return*/, service.signatureHelp(document, textDocumentPosition.position)];
                }
            });
        }); });
        connection.onDefinition(function (textDocumentPosition) { return __awaiter(_this, void 0, void 0, function () {
            var document;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getDocument(textDocumentPosition.textDocument.uri)];
                    case 1:
                        document = _a.sent();
                        return [2 /*return*/, service.definition(document, textDocumentPosition.position)];
                }
            });
        }); });
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
    };
    LspServer.prototype.sendDiagnostics = function (uri, diagnostics) {
        this.connection.sendDiagnostics({ uri: uri, diagnostics: diagnostics });
    };
    return LspServer;
}());
exports.LspServer = LspServer;
