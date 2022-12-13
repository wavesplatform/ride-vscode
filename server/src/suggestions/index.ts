import {CompletionItem, CompletionItemKind, InsertTextFormat} from 'vscode-languageserver-types';
import * as suggestions from './suggestions.json';
import {
    getFunctionsDoc,
    getTypes,
    getVarsDoc,
    IVarDoc,
    TFunction, TList,
    TPrimitive, TStruct,
    TStructField,
    TType, TUnion, TUnionItem,
} from '@waves/ride-js';

//======================Types==============================

type TSnippet = {
    label: string
    insertText: string
    insertTextFormat: number
}

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
export const letRegexp = /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm;
export const caseRegexp = /\bcase[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*:(.*)=>*{*/gm;

//----------------------------------------------------------
export class Suggestions {
    types: TStructField[] = getTypes();
    functions: TFunction[] = getFunctionsDoc();
    globalVariables: IVarDoc[] = getVarsDoc();
    globalSuggestions: CompletionItem[] = [];
    regexps = {
        typesRegExp: /[]/,
        functionsRegExp: /[]/
    };

    constructor() {
        this.updateSuggestions()
    }

    updateSuggestions = (stdlibVersion: number = 6, isTokenContext?: boolean, isContract?: boolean) => {
        const types = getTypes(stdlibVersion, isTokenContext, isContract);
        const functions = getFunctionsDoc(stdlibVersion, isTokenContext, isContract);
        const globalVariables = getVarsDoc(stdlibVersion, isTokenContext, isContract);

        this.regexps.typesRegExp = new RegExp(`\\b${types.map(({name}) => name).join('\\b|\\b')}\\b`, 'g');
        this.regexps.functionsRegExp = new RegExp(`^[!]*(\\b${
            functions.filter(({name}) => ['*', '\\', '/', '%', '+',':+', '++'].indexOf(name) === -1).map(({name}) => name).join('\\b|\\b')
        }\\b)[ \\t]*\\(`);

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
            ...suggestions.snippets.map(({label, insertText}) => ({label,
                insertText,
                kind: CompletionItemKind.Function,
                insertTextFormat: InsertTextFormat.Snippet,})),
            ...functions.map(({name, doc}) => ({detail: doc, kind: CompletionItemKind.Function, label: name}))
        )
    };
}

export default new Suggestions()
