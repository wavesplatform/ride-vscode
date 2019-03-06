import { CompletionItemKind, CompletionItem } from 'vscode-languageserver-types';
import * as suggestions from './suggestions.json';
import { getTypes, getVarsDoc, getFunctionsDoc } from '@waves/ride-js';


//======================Types==============================

export type TItem = TList | TStruct | TUnion | TPrimitive


//----------------------TPrimitive-------------------------
export type TPrimitive = {
    name: string
    type: string
};

export const isPrimitive = (item: TItem): item is TPrimitive => typeof item.type === 'string';

export const isString = (item: any): item is string => typeof item === 'string';

export const handlePrimitive = (({name, type}: TPrimitive) => ({name, doc: type}));


//----------------------TStruct----------------------------
export type TStruct = {
    name: string
    type: TStructType
};

export type TStructType = {
    typeName: string
    fields: TItem[]
};
export const isStruct = (item: TItem): item is TStruct => (item as TStruct).type.typeName !== undefined;
export const isStructType = (item: TStructType | string): item is TStructType => (item as TStructType).typeName !== undefined;
export const handleTStruct = ({name, type}: TStruct) => ({name, doc: type.typeName});


//----------------------TList------------------------------
export type TList = {
    name: string
    type: TListType
};

export type TListType = {
    "listOf": string | TStructType
};

export const isList = (item: TItem): item is TList => (item as TList).type.listOf !== undefined;

export const isListType = (item: TListType): item is TListType => (item as TListType).listOf !== undefined;

export const handleTListType = (type: TListType) => `LIST[ ${isStructType(type.listOf) ? type.listOf.typeName : type.listOf}]`;

export const handleTList = ({name, type}: TList) => ({name, doc: handleTListType(type)});


//----------------------TUnion-----------------------------
export type TUnion = {
    name: string
    type: (TStructType | string)[]
};

export const isUnion = (item: TItem): item is TUnion => Array.isArray(item.type);

export const getUnionItemName = (item: TStructType | string): string => isStructType(item) ? item.typeName : item;

export const handleTUnion = ({name, type}: TUnion) => ({name, doc: type.map(type => getUnionItemName(type)).join('|')});


//----------------------TFunction--------------------------
export type TFunction = {
    name: string
    doc: string
    resultType: string | TStructType | (TStructType | string)[]
    args: TFunctionArgument[]
};

export type TFunctionArgument = {
    name: string
    type: string | TListType | (TStructType | string)[]
    doc: string
};

export const types = getTypes();

//this regexp looks for fields
export const typesRegExp = new RegExp(`\\b${types.map(({name}) => name).join('\\b|\\b')}\\b`, 'g');


//----------------------snippets---------------------------

type Tsnippet = {
    label: string
    insertText: string
    insertTextFormat: number
}

//======================functions==========================

export const functions: TFunction[] = getFunctionsDoc();
export const functionsRegExp = new RegExp(`^[!]*(\\b${
    functions.filter(({name}) => ['*', '\\', '/', '%', '+',].indexOf(name) === -1).map(({name}) => name).join('\\b|\\b')
    }\\b)[ \\t]*\\(`);


//=========================================================

export const letRegexp = /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm;

//ContractInvocationTransaction types
const ignoreTypes = [
    'ContractInvocationTransaction',
    'WriteSet',
    'AttachedPayment',
    'ContractTransfer',
    'TransferSet',
    'ContractResult',
    'Invocation'
];

export const globalVariables = getVarsDoc();

export const Classes = (types.filter((item) => isStruct(item) && ignoreTypes.indexOf(item.name) === -1))
    .map(({name}) => ({label: name, kind: CompletionItemKind.Class}));

export const transactionClasses = (types.filter(({name}) => name === "Transaction").pop() as TUnion).type
    .filter((item) => isStructType(item) && ignoreTypes.indexOf(item.typeName) === -1)
    .map(({typeName}: TStructType) => ({label: typeName, kind: CompletionItemKind.Class}));


export const globalSuggestions: CompletionItem[] = [
    ...suggestions.keywords.map((label: string) => <CompletionItem>({label, kind: CompletionItemKind.Keyword})),
    ...suggestions.snippets.map(({label}: Tsnippet) => ({label, kind: CompletionItemKind.Snippet})),
    ...globalVariables.map(({name, doc}) => ({label: name, detail: doc, kind: CompletionItemKind.Variable,})),
    ...functions.map(({name, doc}) => ({detail: doc, kind: CompletionItemKind.Function, label: name}))
];
