import {CompletionItemKind, CompletionItem} from 'vscode-languageserver-types';
const suggestions = require('../../src/suggestions/suggestions.json');

export const types = suggestions.types;
export const functions = suggestions.functions;

export const globalSuggestions: CompletionItem[] =
    suggestions.keywords.map((label: string) => <CompletionItem>({label, kind: CompletionItemKind.Keyword}))
        .concat(suggestions.generalSuggestions)
        .concat(suggestions.cryptoFunctions)
        .concat(suggestions.contextFunctions)
        .concat(suggestions.contextFields);