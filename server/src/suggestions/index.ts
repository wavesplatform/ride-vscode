import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types';
import * as suggestions from './suggestions.json';
import { getFunctionsDoc, getTypes, getVarsDoc, IVarDoc, TFunction, TStructField, } from '@waves/ride-js';

class Suggestions {
    types: TStructField[] = getTypes();
    functions: TFunction[] = getFunctionsDoc();
    globalVariables: IVarDoc[] = getVarsDoc();
    globalSuggestions: CompletionItem[] = [];

    constructor() {
        this.updateSuggestions()
    }

    updateSuggestions = (stdlibVersion?: number, isTokenContext?: boolean) => {

        const types = getTypes(stdlibVersion, isTokenContext);
        const functions = getFunctionsDoc(stdlibVersion, isTokenContext);
        const globalVariables = getVarsDoc(stdlibVersion, isTokenContext);

        this.types.length = 0;
        this.functions.length = 0;
        this.globalVariables.length = 0;
        this.globalSuggestions.length = 0;

        this.types.push(...types);
        this.functions.push(...functions);
        this.globalVariables.push(...globalVariables);

        this.globalSuggestions.push(
            ...suggestions.directives.map(directive => ({label: directive, kind: CompletionItemKind.Reference})),
            ...suggestions.keywords.map((label: string) => <CompletionItem>({label, kind: CompletionItemKind.Keyword})),
            ...suggestions.snippets.map(({label}) => ({label, kind: CompletionItemKind.Snippet})),
            ...functions.map(({name, doc}) => ({detail: doc, kind: CompletionItemKind.Function, label: name}))
        )
    };
}

export default new Suggestions()
