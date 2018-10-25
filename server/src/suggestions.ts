import { CompletionItemKind, CompletionItem, InsertTextFormat } from 'vscode-languageserver-types'
const keywords = ["let", "true", "false", "if", "then", "else"]

const txFields = [
    'id',
    'fee',
    'feeAssetId',
    'timestamp',
    'bodyBytes',
    'sender',
    'quantity',
    'name',
    'description',
    'script',
    'leaseId',
    "buyOrder",
    "sellOrder",
    "price",
    "amount",
    "buyMatcherFee",
    "sellMatcherFee",
    'totalAmount',
    'transfers',
    'transferCount',
    'senderPublicKey',
    'alias',
    'data',
    'assetName',
    'assetDescription',
    'attachment',
    'decimals',
    'chainId',
    'version',
    'reissuable',
    'proofs',
    'transferAssetId',
    'assetId',
    'recipient',
    'minSponsoredAssetFee',
]

const txTypes = [
    'TransferTransaction',
    'IssueTransaction',
    'ReissueTransaction',
    'BurnTransaction',
    'LeaseTransaction',
    'LeaseCancelTransaction',
    'MassTransferTransaction',
    'CreateAliasTransaction',
    'SetScriptTransaction',
    'SponsorFeeTransaction',
    'ExchangeTransaction',
    'DataTransaction',
]

export const generalSuggestions: CompletionItem[] = [
    {
        label: 'ifelse',
        insertText: 'if (${1:condition}) then $2 else $3',
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Snippet
    },
    {
        label: 'match',
        insertText: `match (\${1:obj}) {
    case $1:\${2:type} => $0
    case _ =>
  }`,
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Snippet
    },
    {
        label: 'base58',
        insertText: `base58'$0'`,
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Snippet
    },
    {
        label: 'base64',
        insertText: `base64'$0'`,
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Snippet
    },
]

export const cryptoFunctions: CompletionItem[] = [
    {
        label: 'keccak256',
        insertText: 'keccak256(${0:BYTE_VECTOR})',
        detail: "Computes the keccak 256 bit hash",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'blake2b256',
        insertText: 'blake2b256(${0:BYTE_VECTOR})',
        detail: "Computes the blake2b 256 bit hash",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'sha256',
        insertText: 'sha256(${0:BYTE_VECTOR})',
        detail: "Computes the sha 256 bit hash",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'sigVerify',
        insertText: 'sigVerify(${1:bytes: BYTE_VECTOR}, ${2:signature: BYTE_VECTOR}, ${3:publicKey: BYTE_VECTOR})',
        detail: "Validated signature for bytes and public key",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'toBase58String',
        insertText: 'toBase58String(${1:bytes: BYTE_VECTOR})',
        insertTextFormat: InsertTextFormat.Snippet,
        detail: "Encodes bytearray to base58 string",
        kind: CompletionItemKind.Function
    },
    {
        label: 'fromBase58String',
        insertText: 'fromBase58String(${1:string: STRING})',
        detail: "Decodes base58 string",
        kind: CompletionItemKind.Function
    },
    {
        label: 'toBase64String',
        insertText: 'toBase64String(${1:bytes: BYTE_VECTOR})',
        detail: "Encodes bytearray to base64 string",
        kind: CompletionItemKind.Function
    },
    {
        label: 'fromBase64String',
        insertText: 'fromBase64String(${1:string: STRING})',
        detail: "Decodes base64 string",
        kind: CompletionItemKind.Function
    },
]

export const contextFields: CompletionItem[] = [
    {
        label: 'height',
        kind: CompletionItemKind.Field,
        insertText: 'height',
        detail: "Retrieves current blockchain height",
    },
    {
        label: 'tx',
        kind: CompletionItemKind.Field,
        insertText: 'tx',
        detail: "Retrieves current transaction being processed",
    },
]

export const contextFunctions: CompletionItem[] = [
    {
        label: 'transactionById',
        insertText: 'transactionById(${1:transactionId: BYTE_VECTOR})',
        detail: "Retrieves transaction by it's id",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    // {
    //     label: 'transactionHeightById',
    //     insertText: 'transactionHeightById(${1:transactionId: BYTE_VECTOR})',
    //     detail: "Retrieves transaction's height by it's id",
    //     insertTextFormat: InsertTextFormat.Snippet,
    //     kind: CompletionItemKind.Function
    // },
    {
        label: 'addressFromRecipient',
        insertText: 'addressFromRecipient(${1:recipient: Obj(bytes)})',
        detail: "Retrieves adress from recipient obj",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'addressFromString',
        insertText: 'addressFromString(${1:base58})',
        detail: "Retrieves adress from base58 string",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'addressFromPublicKey',
        insertText: 'addressFromPublicKey(${1:publicKey: BYTE_VECTOR})',
        detail: "Retrieves adress from publicKey bytes",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'wavesBalance',
        insertText: 'accountBalance(${1:addressOrAlias: Obj(bytes)})',
        detail: "Returns account balance for address or alias",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'assetBalance',
        insertText: 'accountAssetBalance(${1:addressOrAlias: Obj(bytes)}, ${2:assetId: BYTE_VECTOR})',
        detail: "Returns asset balance for address or alias",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'getInteger',
        insertText: 'getInteger(${1:address: Obj(bytes)}, ${2:key: STRING})',
        detail: "Gets integer value by key from address data table",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'getBoolean',
        insertText: 'getBoolean(${1:address: Obj(bytes)}, ${2:key: STRING})',
        detail: "Gets boolean value by key from address data table",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'getBinary',
        insertText: 'getBinary(${1:address: Obj(bytes)}, ${2:key: STRING})',
        detail: "Gets bytevector value from address data table",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'getString',
        insertText: 'getString(${1:address: Obj(bytes)}, ${2:key: STRING})',
        detail: "Gets string value from address data table",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'getInteger',
        insertText: 'getInteger(${1:data: DATA_TX.DATA}, ${2:key: STRING})',
        detail: "Gets integer value by key from data tx",
    },
    {
        label: 'getBoolean',
        insertText: 'getBoolean(${1:data: DATA_TX.DATA}, ${2:key: STRING})',
        detail: "Gets boolean value by key from data tx",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'getBinary',
        insertText: 'getBinary(${1:data: DATA_TX.DATA}, ${2:key: STRING})',
        detail: "Gets bytevector value by key from data tx",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'getString',
        insertText: 'getString(${1:data: DATA_TX.DATA}, ${2:key: STRING})',
        detail: "Gets string value by key from from data tx",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    }, {
        label: 'getInteger',
        insertText: 'getInteger(${1:data: DATA_TX.DATA}, ${2:index: LONG})',
        detail: "Gets integer value by index from data tx",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'getBoolean',
        insertText: 'getBoolean(${1:data: DATA_TX.DATA}, ${2:index: LONG})',
        detail: "Gets boolean value by index from data tx",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'getBinary',
        insertText: 'getBinary(${1:data: DATA_TX.DATA}, ${2:index: LONG})',
        detail: "Gets bytevector value by index from data tx",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'getString',
        insertText: 'getString(${1:data: DATA_TX.DATA}, ${2:index: LONG})',
        detail: "Gets string value by index from from data tx",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },

    /// From PureContext.scala
    {
        label: 'fraction',
        insertText: 'fraction(${1:value: LONG}, ${2:numerator: LONG}, ${3:denominator: LONG})',
        detail: "Multiplies value by numerator and divides by denominator",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'size',
        insertText: 'size(${1:byteVector: BYTE_VECTOR|STRING})',
        detail: "Returns size of byte vector or string",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'toBytes',
        insertText: 'toBytes(${1:value: BOOLEAN|STRING|LONG})',
        detail: "Converts boolean or string or long to byte vector",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'take',
        insertText: 'take(${1:value: BYTE_VECTOR|STRING}, ${2:n: LONG})',
        detail: "Takes first n bytes or characters",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'drop',
        insertText: 'drop(${1:value: BYTE_VECTOR|STRING}, ${2:n: LONG})',
        detail: "Drops first n bytes or characters",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'takeRight',
        insertText: 'takeRight(${1:value: BYTE_VECTOR|STRING}, ${2:n: LONG})',
        detail: "Takes last n bytes or characters",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'dropRight',
        insertText: 'dropRight(${1:value: BYTE_VECTOR|STRING}, ${2:n: LONG})',
        detail: "Drops last n bytes or characters",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'toString',
        insertText: 'toString(${1:value: BOOLEAN|LONG})',
        detail: "Converts boolean or long to string",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'isDefined',
        insertText: 'isDefined(${1:value: UNION(SOMETHING|UNIT)})',
        detail: "Checks if UNION contains value",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'extract',
        insertText: 'extract(${1:value: UNION(SOMETHING|UNIT)})',
        detail: "Extracts value from union. Throws if value is unit",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
    {
        label: 'throw',
        insertText: 'throw(${1:err: STRING?})',
        detail: "Throws exception. Explicit script termination",
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Function
    },
]

export const globalSuggestions: CompletionItem[] =
    keywords.map(label => <CompletionItem>({ label, kind: CompletionItemKind.Keyword }))
        .concat(generalSuggestions)
        .concat(cryptoFunctions)
        .concat(contextFunctions)
        .concat(contextFields)
export const txFieldsItems = txFields.map(label => ({ label, kind: CompletionItemKind.Field }))
export const txTypesItems = txTypes.map(label => ({ label, kind: CompletionItemKind.Interface }))