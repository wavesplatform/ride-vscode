import { TextDocument, InitializeParams } from "vscode-languageserver";

export class LspService {
    private hasConfigurationCapability: boolean = false;
    private hasWorkspaceFolderCapability: boolean = false;
    private hasDiagnosticRelatedInformationCapability: boolean = false;

    initialize(params: InitializeParams) { 
        let capabilities = params.capabilities;

        // Does the client support the `workspace/configuration` request?
        // If not, we will fall back using global settings
        this.hasConfigurationCapability =
            capabilities.workspace && !!capabilities.workspace.configuration;
        this.hasWorkspaceFolderCapability =
            capabilities.workspace && !!capabilities.workspace.workspaceFolders;
        this.hasDiagnosticRelatedInformationCapability =
            capabilities.textDocument &&
            capabilities.textDocument.publishDiagnostics &&
            capabilities.textDocument.publishDiagnostics.relatedInformation;
    }

    initialized() { }

    didChangeContent(document: TextDocument) {

    }
}