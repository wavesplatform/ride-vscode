import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types';
import {
    types, functions, globalVariables, globalSuggestions, transactionClasses, classes, typesRegExp, caseRegexp,
    functionsRegExp, letRegexp, isPrimitive, isStruct, isUnion, isList,
    listToString, unionToString, matchRegexp
} from './suggestions';
import { TType, TStruct, TList, TUnion, TFunction, TUnionItem, TStructField } from '@waves/ride-js'

//======================TYPES==============================

type TVariableDeclaration = {
    variable: string
    types: string[]
    value?: string,
}


//======================HELPERS============================

//----------------------TFunction--------------------------
const getFunctionArgumentString = (type: TType): string => {
    if (isPrimitive(type)) {
        return type
    } else if (isList(type)) {
        return listToString(type)
    } else if (isStruct(type)) {
        return type.typeName
    } else if (isUnion(type)) {
        return type.map((type: TUnionItem) => isStruct(type) ? type.typeName : type).join('|');
    } else {
        return 'Unknown'
    }
};

const getFunctionsByName = (funcName: string): TFunction[] => functions.filter(({ name }: TFunction) => name === funcName);


//----------------------Completion-------------------------
const convertToCompletion = (field: TStructField): CompletionItem => {
    let detail: string = '';
    if (isPrimitive(field.type)) {
        detail = field.type
    } else if (isList(field.type)) {
        detail = listToString(field.type)
    } else if (isStruct(field.type)) {
        detail = field.type.typeName
    } else if (isUnion(field.type)) {
        detail = unionToString(field.type)
    }

    return {
        label: field.name,
        detail,
        kind: CompletionItemKind.Field
    };
};

//----------------------Types------------------------------
const getTypeDoc = (item: TStructField, isRec?: Boolean): string => {
    const type = item.type;
    let typeDoc = 'Unknown';
    switch (true) {
        case isPrimitive(type):
            typeDoc = type as string;
            break;
        case isStruct(type):
            typeDoc = isRec ? (type as TStruct).typeName :
                `**${(type as TStruct).typeName}**(\n- ` + (type as TStruct).fields
                    .map((v) => `${v.name}: ${getTypeDoc(v, true)}`).join('\n- ') + '\n\n)';
            break;
        case isUnion(type):
            typeDoc = (type as TUnion).map(field => isStruct(field) ? field.typeName : field).join('|');
            break;
        case isList(type):
            typeDoc = `LIST[ ` +
                `${((type as TList).listOf as TStruct).typeName || (type as TList).listOf}]`;
            break;
    }
    return typeDoc;
};


//======================COMPLETION=========================

// Todo: remove this constant altogether
export const txFields = intersection((types.find(t => t.name === 'Transaction')!.type as TUnion))
    .map((item) => convertToCompletion(item));

export const getCompletionDefaultResult = (textBefore: string) =>
    [
        // get variables after 'let' and globalSuggestions
        ...getDataByRegexp(textBefore, letRegexp).map(val => ({ label: val.name, kind: CompletionItemKind.Variable })),
        ...getDataByRegexp(textBefore, caseRegexp).filter((_, i, arr) => arr.length === (i + 1))
            .map(val => ({ label: val.name, kind: CompletionItemKind.Variable })),
        ...globalSuggestions,
    ];


export const getCompletionResult = (inputWords: string[], declarations: TVariableDeclaration[]) =>
    getVariablesHelp(inputWords, declarations).map((item: any) => convertToCompletion(item));


function getVariablesHelp(inputWords: string[], declarations: TVariableDeclaration[], isNext?: boolean) {
    const typesByNames = (names: string[]): TType[] => types.filter(({ name }) => names.indexOf(name) > -1)
        .map(({ type }) => type);

    let declVariable = declarations.filter(({ variable, types }) => variable === inputWords[0] && types !== null)[0];
    if (declVariable == null) return [];
    let out = intersection(typesByNames(declVariable.types));
    let len = isNext ? inputWords.length : inputWords.length - 1;
    for (let i = 1; i < len; i++) {
        let actualType = out.filter(item => item.name === inputWords[i] && !isPrimitive(item.type) && !isList(item.type))[0];
        if (i === len - 1 && isNext && isUnion(actualType.type)) {
            actualType.type = actualType.type.filter(type => (type as TStruct).typeName !== 'Unit');
        }
        if (!actualType) {
            out = []
        } else if (isStruct(actualType.type)) {
            out = actualType.type.fields;
        } else if (isUnion(actualType.type)) {
            out = intersection(actualType.type)
        }
    }
    return out;
}


function getExtractType(inputWords: string[], declarations: TVariableDeclaration[]) {

    const getOut = (type: TUnion) => type.filter(type => (type as TStruct).typeName !== 'Unit').map(type => getTypeDoc({ name: '', type }, true));
    const typesByNames = (names: string[]): TType[] => types.filter(({ name }) => names.indexOf(name) > -1)
        .map(({ type }) => type);

    let declVariable = declarations.filter(({ variable, types }) => variable === inputWords[0] && types !== null)[0];
    if (declVariable == null) return [];

    let len = inputWords.length;
    if (len === 1) {
        return getOut(typesByNames(declVariable.types) as TUnion);
    }

    let data = intersection(typesByNames(declVariable.types));
    let out = data.map(type => type.name);

    for (let i = 1; i < len; i++) {
        let actualType = data.filter(item => item.name === inputWords[i] && !isPrimitive(item.type) && !isList(item.type))[0];
        if (i === len - 1 && isUnion(actualType.type)) {
            out = getOut(actualType.type)
        }
        if (!actualType) {
            data = []
        } else if (isStruct(actualType.type)) {
            data = actualType.type.fields;
        } else if (isUnion(actualType.type)) {
            data = intersection(actualType.type)
        }
    }

    return out;
}


export const getColonOrPipeCompletionResult = (textBefore: string) =>
    ([...getDataByRegexp(textBefore, matchRegexp)].map(({ name }) => name).indexOf('tx') > -1) ? transactionClasses : classes;


//======================SignatureHelp======================

export function getSignatureHelpResult(word: string) {
    let func = getFunctionsByName(word);
    return func.map((func: TFunction) => ({
        label: `${word}(${func.args.map(({ name, type }) =>
            `${name}: ${getFunctionArgumentString(type)}`).join(', ')}): ${getFunctionArgumentString(func.resultType)}`,
        documentation: func.doc,
        parameters: func.args.map(({ name, type, doc }) => ({
            label: `${name}: ${getFunctionArgumentString(type)}`, documentation: doc
        }))
    }))
}

//======================Hover==============================

export function getHoverResult(textBefore: string, word: string, inputWords: string[]) {
    //todo
    //  case t:TransferTransaction =>
    //  let txId = t.attachment
    //  add hover txId


    const getHoverFunctionDoc = (func: TFunction) => `**${func.name}** (${func.args.length > 0 ?
        `\n${func.args.map(({ name, type, doc }) => `\n * ${`${name}: ${getFunctionArgumentString(type)} - ${doc}`} \n`)}\n` :
        ' '}) : ${getFunctionArgumentString(func.resultType)} \n>_${func.doc}_`;

    const declarations = findDeclarations(textBefore);

    return getVariablesHelp(inputWords, declarations)
        .filter(({ name }) => name === word).map(item => `**${item.name}**: ` + getTypeDoc(item))
        .concat(declarations.filter(({ variable }) => variable === word).map(({ types }) => types.join('|')))
        .concat(globalVariables.filter(({ name }) => name === word).map(({ doc }) => doc))
        .concat(getFunctionsByName(word).map((func: TFunction) => getHoverFunctionDoc(func)))
        .concat(types.filter(({ name }) => name === word).map(item => getTypeDoc(item)));
}

//======================exported functions=================

export function getWordByPos(string: string, character: number) {
    let sep = ['"', '\'', '*', '(', ')', '{', '}', '[', ']', '!', '<', '>', '|', '\\', '/', '.', ',', ':', ';', '&', ' ', '=', '\t'];
    let start = 0, end = string.length;
    for (let i = character; i <= string.length; i++) {
        if (sep.indexOf(string[i]) > -1) {
            end = i;
            break;
        }
    }
    for (let i = character; i >= 0; i--) {
        if (sep.indexOf(string[i]) > -1) {
            start = ++i;
            break;
        }
    }
    return string.substring(start, end);
}


export function findDeclarations(text: string): TVariableDeclaration[] {

    const getTypeName = (type?: TType): string[] => {
        let result: string[] = [];
        if (typeof type === 'string')
            result = [type];
        else if (type && isStruct(type))
            result = [type.typeName];
        else if (type && Array.isArray(type))
            result = type.map((v: TUnionItem): string => getTypeName(v).join('|'));
        return result;
    };

    const getFuncDoc = (funcName: string): string[] => {
        let func = [...functions].filter(({ name }) => name === funcName).pop();
        return getTypeName(func && func.resultType);
    };

    const getExtactDoc = (value: string, type: string): string => {
        let extractData = value.match(/extract[ \t]*\(([a-zA-z0-9_.()]*)\)/) || [];
        let out, match;
        if (extractData[1] && (match = extractData[1].match(functionsRegExp)) != null) {
            out = (getFuncDoc(match[1]).filter(type => type !== 'Unit')).join('|');
        } else {
            out = extractData[1] ?
                getExtractType(extractData[1].split('.'), result).join('|') : type
        }
        return out
    };

    //todo add string and unit
    let result: TVariableDeclaration[] = [];
    [...getDataByRegexp(text, caseRegexp), ...getDataByRegexp(text, letRegexp)]
        .map(({ name, value }) => {
            let out: TVariableDeclaration;
            let match;
            if (Number(value.toString().replace(/_/g, '')).toString() !== 'NaN')
                out = { variable: name, types: ['Int'], value: value };
            else if ((match = value.match(/\b(base58|base64)\b[ \t]*'(.*)'/)) != null) {
                out = { variable: name, types: ['ByteVector'], value: match[2] }
            } else if ((match = value.match(functionsRegExp)) != null) {
                out = { variable: name, types: getFuncDoc(match[1]) };
                out.types = (out.types.map(type => type === 'TYPEPARAM(84)' ? getExtactDoc(value, type) : type))
            } else if ((match = value.match(typesRegExp)) != null) {
                out = { variable: name, types: match }
            } else if (/.*\b&&|==|!=|>=|>\b.*/.test(value)) { //todo let b = true hovers
                out = { variable: name, types: ['Boolean'] }
            } else {
                out = { variable: name, types: [] }
            }
            result.push(out);
        });
    return result;
}

export const getLastArrayElement = (arr: string[] | null): string => arr !== null ? [...arr].pop() || '' : '';


//======================non-exported functions=============

function intersection(types: TType[]): TStructField[] {
    const items = [...types];
    let structs: TStruct[] = [];
    if (types === []){
        return [];
    }
    let next: TType;
    while (items.length > 0) {
        next = items.pop()!;
        if (isStruct(next)) {
            structs.push(next)
        } else if (isUnion(next)) {
            items.push(...next)
        } else {
            return []
        }
    }
    const firstArg = structs[0];
    let out = firstArg.fields;
    for (let i = 1; i < structs.length; i++) out = intersect(out, structs[i].fields);
    return out;
}

function intersect(a: TStructField[], b: TStructField[]) {
    let list: string[] = [], out: TStructField[] = [];
    a.forEach((val) => list.push(val.name));
    b.forEach(val => (list.indexOf(val.name) > -1) ? out.push(val) : false);
    return out;
}

function getDataByRegexp(text: string, re: RegExp) {
    const declarations: {
        name: string
        namePos: number
        value: string
        valuePos: number
        row: number
    }[] = [];
    const split = text.split('\n');
    let myMatch;
    split.map((row: string, i: number) => {
        while ((myMatch = re.exec(row)) !== null) {
            declarations.push({
                name: myMatch[1],
                namePos: row.indexOf(myMatch[1]),
                value: myMatch[2],
                valuePos: row.indexOf(myMatch[2].toString()),
                row: i + 1
            });
        }
    });
    return declarations;
}


