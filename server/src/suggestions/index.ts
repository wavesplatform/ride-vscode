import { CompletionItemKind, CompletionItem } from 'vscode-languageserver-types';
import * as suggestions from './suggestions.json';
import {
    getTypes,
    getVarsDoc,
    getFunctionsDoc,
    TType,
    TPrimitive,
    TStruct,
    TList,
    TUnionItem,
    TUnion,
    TFunction
} from '@waves/ride-js';

//======================Types==============================

export const types = getTypes();

//----------------------TPrimitive-------------------------

export const isPrimitive = (item: TType): item is TPrimitive => typeof item === 'string';

export const isString = (item: any): item is string => typeof item === 'string';


//----------------------TStruct----------------------------

export const isStruct = (item: TType): item is TStruct => typeof item === 'object' && 'typeName' in item;


//----------------------TList------------------------------

export const isList = (item: TType): item is TList => typeof item === 'object' && 'listOf' in item;

export const listToString = (type: TList) => `LIST[ ${isStruct(type.listOf) ? type.listOf.typeName : type.listOf}]`;


//----------------------TUnion-----------------------------

export const isUnion = (item: TType): item is TUnion => Array.isArray(item);

export const getUnionItemName = (item: TUnionItem): string => {
    if (isStruct(item)) return item.typeName;
    if (isList(item)) return listToString(item);
    return item
};

export const unionToString = (item: TUnion) => item.map(type => getUnionItemName(type)).join('|');


//----------------------snippets---------------------------

type TSnippet = {
    label: string
    insertText: string
    insertTextFormat: number
}

//======================functions==========================

export const functions: TFunction[] = getFunctionsDoc();


//=========================================================

export const letRegexp = /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm;
export const caseRegexp = /\bcase[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*:(.*)[=>{]/gm;
export const matchRegexp = /\bmatch[ \t]*\([ \t]*([a-zA-z0-9_]+)[ \t]*\)/gm;
export const typesRegExp = new RegExp(`\\b${types.map(({name}) => name).join('\\b|\\b')}\\b`, 'g');
export const functionsRegExp = new RegExp(`^[!]*(\\b${
    functions.filter(({name}) => ['*', '\\', '/', '%', '+',].indexOf(name) === -1).map(({name}) => name).join('\\b|\\b')
    }\\b)[ \\t]*\\(`);

//ContractInvocationTransaction types
// const ignoreTypes = [
//     'ContractInvocationTransaction',
//     'WriteSet',
//     'AttachedPayment',
//     'ContractTransfer',
//     'TransferSet',
//     'ContractResult',
//     'Invocation'
// ];

export const globalVariables = getVarsDoc();

export const classes = types.map(({name}) => ({label: name, kind: CompletionItemKind.Class}));

export const transactionClasses = (types!.find(t => t.name === 'Transaction')!.type as TUnion)
    .map(({typeName}: any) => ({label: typeName, kind: CompletionItemKind.Class}));


export const globalSuggestions: CompletionItem[] = [
    ...suggestions.keywords.map((label: string) => <CompletionItem>({label, kind: CompletionItemKind.Keyword})),
    ...suggestions.snippets.map(({label}: TSnippet) => ({label, kind: CompletionItemKind.Snippet})),
    ...globalVariables.map(({name, doc}) => ({label: name, detail: doc, kind: CompletionItemKind.Variable,})),
    ...functions.map(({name, doc}) => ({detail: doc, kind: CompletionItemKind.Function, label: name}))
];
