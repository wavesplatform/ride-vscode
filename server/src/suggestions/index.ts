import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types';
import * as suggestions from './suggestions.json';
import {
    getFunctionsDoc,
    getTypes,
    getVarsDoc, IVarDoc, TFunction,
    TList,
    TPrimitive,
    TStruct, TStructField,
    TType,
    TUnion,
    TUnionItem,
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

//----------------------------------------------------------

export const letRegexp = /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm;
export const caseRegexp = /\bcase[suggestionData.]/gm;
export const matchRegexp = /\bmatch[ \t]*\([ \t]*([a-zA-z0-9_]+)[ \t]*\)/gm;

export class SuggestionData  {
    types: TStructField[] = getTypes();
    functions: TFunction[] = getFunctionsDoc();
    globalVariables: IVarDoc[] = getVarsDoc();
    regexps = {
        typesRegExp: /()/,
        functionsRegExp: /()/
    };
    classes: CompletionItem[] = [];
    transactionClasses: CompletionItem[] = [];
    globalSuggestions: CompletionItem[] = [];
    
    updateSuggestions = ( stdlibVersion?: number, isTokenContext?: boolean) => {
    
        const types = getTypes(stdlibVersion, isTokenContext);
        const functions = getFunctionsDoc(stdlibVersion, isTokenContext);
        const globalVariables = getVarsDoc(stdlibVersion, isTokenContext);
    
        this.types.length = 0;
        this.functions.length = 0;
        this.globalVariables.length = 0;
        this.classes.length = 0;
        this.transactionClasses.length = 0;
        this.globalSuggestions.length = 0;

        this.types.push(...types);
        this.functions.push(...functions);
        this.globalVariables.push(...globalVariables);
    
        this.regexps.typesRegExp = new RegExp(`\\b${types.map(({name}) => name).join('\\b|\\b')}\\b`, 'g');
        this.regexps.functionsRegExp = new RegExp(`^[!]*(\\b${
            functions.filter(({name}) => ['*', '\\', '/', '%', '+',].indexOf(name) === -1).map(({name}) => name).join('\\b|\\b')
            }\\b)[ \\t]*\\(`);

        this.classes.push(...types.map(({name}) => ({label: name, kind: CompletionItemKind.Class})));
        this.transactionClasses.push(...(types!.find(t => t.name === 'Transaction')!.type as TUnion)
            .map(({typeName}: any) => ({label: typeName, kind: CompletionItemKind.Class})));
    
    
        this.globalSuggestions.push(
            ...suggestions.keywords.map((label: string) => <CompletionItem>({label, kind: CompletionItemKind.Keyword})),
            ...suggestions.snippets.map(({label}: TSnippet) => ({label, kind: CompletionItemKind.Snippet})),
            ...globalVariables.map(({name, doc}) => ({label: name, detail: doc, kind: CompletionItemKind.Variable,})),
            ...functions.map(({name, doc}) => ({detail: doc, kind: CompletionItemKind.Function, label: name}))
        )
    
    };

}


