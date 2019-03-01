import { CompletionItemKind, CompletionItem } from 'vscode-languageserver-types';
import * as suggestions from './suggestions.json';
import { getTypes, getVarsDoc, getFunctionsDoc } from '@waves/ride-js';

//=============================================================================================================

type TItemInfo = TArrayInfo | TStructInfo | TUnionInfo | TPrimitiveInfo

export type TPrimitiveInfo = {
    name: string
    type: 'Primitive'
}

export type TStructField = { label: string, kind: CompletionItemKind, detail: string }
export type TStructInfo = {
    name: string
    type: 'Struct'
    fields: { label: string, kind: CompletionItemKind, detail: string }[]
}

export type TArrayInfo = {
    name: string,
    type: 'Array'
    items: { type: string, doc: string }
}

export type TUnionInfo = {
    name: string
    type: 'Union'
    types: { label: string, detail: string }[]
}

type TtypeHandlers = {
    'Primitive': (name: string) => TPrimitiveInfo
    'Struct': (name: string, type: any) => TStructInfo
    'Array': (name: string, type: any) => TArrayInfo
    'Union': (name: string, type: any) => TUnionInfo
}

//=============================================================================================================

const isString = (value: any): boolean => (typeof value === 'string');

const selectType = (type: any): 'Primitive' | 'Struct' | 'Array' | 'Union' => {
    if (isString(type)) return 'Primitive';    //if type is string, type = Primitive
    else if (type.fields) return 'Struct';     //else if type.fields, type = Struct
    else if (type.listOf) return 'Array';      //else if type.listOf, type = Array
    else return 'Union'                        //else type = Union
};

const getStructDetail = {
    'Primitive': (type: string) => type,
    'Struct': (type: any) => type.typeName,
    'Array': (type: any) => type.listOf.typeName ? type.listOf.typeName : type.listOf,
    'Union': (type: any) => type.map((x: any) => ((isString(x.typeName) || isString(x.name))) ? x.typeName || x.name : x).join('|'),
};

const getTypeStructFields = (type: any) => type.fields.map(({name, type}: any) => ({
    label: name,
    kind: CompletionItemKind.Field,
    detail: getStructDetail[selectType(type)](type)
}));
const getTypeArraysItems = (listOf: any) => ({
    type: listOf.typeName || listOf,
    doc: (listOf.fields) ? listOf.fields.map(({name}: any) => name).join('|') : ''
});
const getTypeUnionTypes = (type: any) => type.map(({typeName, fields}: any) => ({
    label: typeName,
    detail: fields.map(({name}: any) => name).join('|')
}));

const typeHandlers: TtypeHandlers = {
    'Primitive': (name) => ({name, type: 'Primitive'}),
    'Struct': ((name: string, type: any) => ({name, type: 'Struct', fields: getTypeStructFields(type)})),
    'Array': (name: string, type: any) => ({name, type: 'Array', items: getTypeArraysItems(type.listOf)}),
    'Union': (name: string, type: any) => ({name, type: 'Union', types: getTypeUnionTypes(type)}),
};

export const types: TItemInfo[] = //getTypes();
    //TODO remove this data
    [...getTypes(),
        {
            'name': 'data',
            'type': {
                'listOf': {
                    'typeName': 'DataEntry',
                    'fields': [
                        {
                            'name': 'key',
                            'type': 'String'
                        },
                        {
                            'name': 'value',
                            'type': [
                                'Int',
                                'Boolean',
                                'ByteVector',
                                'String'
                            ]
                        }
                    ]
                }
            }
        },
        {
            'name': 'proofs',
            'type': {
                'listOf': 'ByteVector'
            }
        }, {
        'name': 'transfers',
        'type': {
            'listOf': {
                'typeName': 'Transfer',
                'fields': [
                    {
                        'name': 'recipient',
                        'type': [
                            {
                                'typeName': 'Address',
                                'fields': [
                                    {
                                        'name': 'bytes',
                                        'type': 'ByteVector'
                                    }
                                ]
                            },
                            {
                                'typeName': 'Alias',
                                'fields': [
                                    {
                                        'name': 'alias',
                                        'type': 'String'
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        'name': 'amount',
                        'type': 'Int'
                    }
                ]
            }
        }
    }].map(({name, type}) => typeHandlers[selectType(type)](name, type));

//this regexp looks for fields
export const typesRegExp = new RegExp(`\\b${types.map(({name}) => name).join('\\b|\\b')}\\b`, 'g');

//=============================================================================================================

export const globalVariables = //getVarsDoc();
    //TODO remove this data
    [...getVarsDoc(),
        {
            'name': 'tx',
            'doc': 'Retrieves current transaction being processed'
        }
    ];

//=============================================================================================================

export const functions: Record<string, any> = getFunctionsDoc();

//=============================================================================================================

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

export const Classes = (types.filter(({name, type}) =>  type === 'Struct' && ignoreTypes.indexOf(name) === -1))
    .map(({name}) => ({label: name, kind: CompletionItemKind.Class}));

export const transactionClasses = (types.filter(({name}) => name ==="Transaction").pop() as TUnionInfo).types
    .filter(({label}) => ignoreTypes.indexOf(label) === -1).map(({label}) => ({label, kind: CompletionItemKind.Class}));


export const globalSuggestions: CompletionItem[] =
    suggestions.keywords.map((label: string) => <CompletionItem>({label, kind: CompletionItemKind.Keyword}))
    //snippets
        .concat((Object as any).values(suggestions.snippets).map((x: any) => ({
            ...x,
            kind: CompletionItemKind.Snippet
        })))
        //globalVariables
        .concat(globalVariables.map(({name, doc}) => ({
            label: name,
            detail: doc,
            kind: CompletionItemKind.Variable,
        })))
        //functions
        .concat(getFunctionsDoc().map(({name, doc}) => ({
            detail: doc,
            kind: CompletionItemKind.Function,
            label: name,
        })));
