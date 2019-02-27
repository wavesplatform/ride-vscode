import { CompletionItemKind, CompletionItem } from 'vscode-languageserver-types';
// @ts-ignore
import * as suggestions from './suggestions.json';

const rideJs = require('@waves/ride-js/src/lang-opt.js');

//=============================================================================================================

const isString = (value:any) => (value && typeof value === 'string');

const getDocFromArray = (fields: any) => fields
    .map((x: any) => ((isString(x.typeName) || isString(x.name))) ? x.typeName || x.name : x).join('|');

const getTypeObj = (type: any) => type.fields.map(({name, type}: any) => ({
    label: name,
    kind: CompletionItemKind.Field,
    detail: isString(type) ? type :
        ((type.typeName || type.listOf) ?
            type.typeName || (type.listOf.typeName ? type.listOf.typeName : type.listOf) : getDocFromArray(type))
}));


export const types = [...rideJs.getTypes()].map(({name, type, doc}) => ({
        name,
        doc: (isString(type) ? type : doc || ''),
        fields: ((type.fields) ? getTypeObj(type) : isString(type) ? [] : type.map(({typeName, fields}: any) => (
            {label: typeName, detail: getDocFromArray(fields), kind: CompletionItemKind.Field}
        )))

    })
);

//this regexp looks for fields
export const typesRegExp = new RegExp(`\\b${types.map(({name}) => name).join('\\b|\\b')}\\b`, 'g');

//=============================================================================================================

export const globalVariables = [
    ...rideJs.getVarsDoc(),
    {
        'name': 'tx',
        'doc': 'Retrieves current transaction being processed'
    }
];

//=============================================================================================================

export const functions: Record<string, any> = rideJs.getFunctionsDoc();

//=============================================================================================================

export const txFields = ['id', 'proofs', 'senderPublicKey', 'timestamp'].map(x => ({
    label: x,
    kind: CompletionItemKind.Field
}));

export const nonTransactionsClasses = ['Address', 'Alias', 'Transfer', 'DataEntry', 'GenesisTransaction', 'PaymentTransaction'];

export const transactionClasses =
    ['Order', 'TransferTransaction', 'IssueTransaction', 'ReissueTransaction', 'BurnTransaction', 'LeaseTransaction',
        'LeaseCancelTransaction', 'MassTransferTransaction', 'CreateAliasTransaction', 'SetAssetScriptTransaction',
        'SetScriptTransaction', 'SponsorFeeTransaction', 'ExchangeTransaction', 'DataTransaction'];

export const globalSuggestions: CompletionItem[] =
    suggestions.keywords.map((label: string) => <CompletionItem>({label, kind: CompletionItemKind.Keyword}))
    //snippets
        .concat((Object as any).values(suggestions.snippets).map((x: any) => ({
            ...x,
            kind: CompletionItemKind.Snippet
        })))
        //globalVariables
        .concat(globalVariables.map(({name, doc}: any) => ({
            label: name,
            detail: doc,
            kind: CompletionItemKind.Variable
        })))
        //functions
        .concat(rideJs.getFunctionsDoc().map(({name, doc}: any) => ({
            detail: doc,
            kind: CompletionItemKind.Function,
            label: name
        })));
