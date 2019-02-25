import { CompletionItemKind, CompletionItem } from 'vscode-languageserver-types';
// const suggestions = require('../../src/suggestions/suggestions.json');
import * as suggestions from './suggestions.json'

const nonTranzactionsClasses = ['Address', 'Alias', 'Transfer', 'DataEntry', 'GenesisTransaction', 'PaymentTransaction'];

const typesData: Record<string, any>  = suggestions.types;
Object.keys(typesData).map(type => {
    typesData[type].label = type;
    Object.keys(typesData[type].fields).map( field => {
        typesData[type].fields[field].label = typesData[type].fields[field].name;
        typesData[type].fields[field].kind = CompletionItemKind.Field
    })
})


export const transactionClasses = Object.keys(suggestions.types).filter(val => nonTranzactionsClasses.indexOf(val) === -1)
export const types: Record<string, any> = typesData;

export const functions: Record<string, any> = suggestions.functions;
export const globalVariables: Record<string, any> = suggestions.globalVariables;
export const typesRegExp =  new RegExp(`\\b${Object.keys(typesData).join('\\b|\\b')}\\b`, 'g')//this regexp looks for fields

export const globalSuggestions: CompletionItem[] =
    suggestions.keywords.map((label: string) => <CompletionItem>({ label, kind: CompletionItemKind.Keyword }))
        //globalVariables
        .concat((Object as any).values(suggestions.globalVariables)
            .map((x: any) => ({ ...x, kind: CompletionItemKind.Variable, label: x.name })))
        //functions
        .concat((Object as any).values(suggestions.functions)
            .map((x: any) => ({ ...x, kind: CompletionItemKind.Function, label: x.name })))
        //snippets
        .concat((Object as any).values(suggestions.snippets)
            .map((x: any) => ({ ...x, kind: CompletionItemKind.Snippet })))