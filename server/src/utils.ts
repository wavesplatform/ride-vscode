import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types';
import {
    caseRegexp,
    isList,
    isPrimitive,
    isStruct,
    isUnion,
    letRegexp,
    listToString,
    matchRegexp,
    SuggestionData,
    unionToString
} from './suggestions';
import { scriptInfo, TFunction, TList, TStruct, TStructField, TType, TUnion } from '@waves/ride-js'

export const Suggestions = new SuggestionData;

const {regexps, types, functions, globalVariables, globalSuggestions, classes, transactionClasses} = Suggestions;

//======================TYPES==============================
type TPosition = {
    row: number
    col: number
};


type TVarDecl = {
    variable: string,
    type: TType,
};

type TContext = {
    vars: TVarDecl[]
    start: TPosition
    end: TPosition
    children: TContext[]
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
        return unionToString(type);
    } else {
        return 'Unknown'
    }
};

const getFunctionsByName = (funcName: string): TFunction[] => functions.filter(({name}: TFunction) => name === funcName);


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

export const getCompletionDefaultResult = (variablesDeclarations: TVarDecl[]) =>
    [
        ...variablesDeclarations.map(item => ({label: item.variable, kind: CompletionItemKind.Variable})),
        ...globalSuggestions,
    ];


export const getCompletionResult = (inputWords: string[], declarations: TVarDecl[]) =>
    getVariablesHelp(inputWords, declarations).map((item: any) => convertToCompletion(item));


function getVariablesHelp(inputWords: string[], declarations: TVarDecl[], isNext?: boolean): TStructField[] {
    let declVariable = declarations.find(({variable, type}) => variable === inputWords[0] && type !== null);
    if (declVariable == null || !declVariable.type) return [];
    let out = intersection(isUnion(declVariable.type) ? declVariable.type : [declVariable.type]);

    let len = isNext ? inputWords.length : inputWords.length - 1;
    for (let i = 1; i < len; i++) {
        let actualType = out.find(item => item.name === inputWords[i] && !isPrimitive(item.type) && !isList(item.type));

        if (!actualType) return [];
        if (isStruct(actualType.type)) out = actualType.type.fields;
        if (isUnion(actualType.type)) out = intersection(actualType.type)

    }
    return out;
}


export const getColonOrPipeCompletionResult = (textBefore: string, vars: TVarDecl[]) => {
    let out = classes;
    let matchVariable = getLastArrayElement(getDataByRegexp(textBefore, matchRegexp).map(({name}) => name));
    if (matchVariable === 'tx') {
        out = transactionClasses;
    } else {
        const type = defineType('', matchVariable, vars).type;
        if (isUnion(type)) {
            out = type.map(({typeName}: any) => ({label: typeName, kind: CompletionItemKind.Class}));
        }
    }
    return out
};

export const checkPostfixFunction = (variablesDeclarations: TVarDecl[], inputWord: string) => {
    let variable = variablesDeclarations.find(({variable}) => variable === inputWord);
    return functions.filter(({args}) => {
        if (!args[0] || !variable || !variable.type) return false;

        let type = variable.type;

        if (isPrimitive(type) && isPrimitive(args[0].type) && type === args[0].type) return true;

        if (isStruct(type) && isUnion(args[0].type)) {
            let currentType = args[0].type[0];
            if (isStruct(currentType) && type.typeName === currentType.typeName) {
                return true;
            }
        }
        if (args[0].type === 'PARAMETERIZEDUNION(List(TYPEPARAM(84), Unit))' && isUnion(type)) {
            return type.some(item => isStruct(item) && item.typeName === 'Unit')
        }
        return false;
    })
};


//======================SignatureHelp======================

export function getSignatureHelpResult(word: string, isShift: boolean) {
    let func = getFunctionsByName(word).map(func => ({
        ...func,
        args: func.args.filter((_, i) => !(isShift && i === 0))
    }));
    return func.map((func: TFunction) => ({
        label: `${word}(${func.args.map(({name, type}) =>
            `${name}: ${getFunctionArgumentString(type)}`).join(', ')}): ${getFunctionArgumentString(func.resultType)}`,
        documentation: func.doc,
        parameters: func.args.map(({name, type, doc}) => ({
            label: `${name}: ${getFunctionArgumentString(type)}`, documentation: doc
        }))
    }))
}

//======================Hover==============================

export function getHoverResult(textBefore: string, word: string, inputWords: string[]) {


    const getHoverFunctionDoc = (func: TFunction) => `**${func.name}** (${func.args.length > 0 ?
        `\n${func.args.map(({name, type, doc}) => `\n * ${`${name}: ${getFunctionArgumentString(type)} - ${doc}`} \n`)}\n` :
        ' '}) : ${getFunctionArgumentString(func.resultType)} \n>_${func.doc}_`;

    const declarations = getDefinedVariables(findContextDeclarations(textBefore));

    return getVariablesHelp(inputWords, findDeclarations(textBefore))
        .filter(({name}) => name === word).map(item => `**${item.name}**: ` + getTypeDoc(item))
        .concat(declarations.filter(({variable}) => variable === word)
            .map(({type}) => type ? getTypeDoc({name: '', type: type}, true) : 'Unknown'))
        .concat(globalVariables.filter(({name}) => name === word).map(({doc}) => doc))
        .concat(getFunctionsByName(word).map((func: TFunction) => getHoverFunctionDoc(func)))
        .concat(types.filter(({name}) => name === word).map(item => getTypeDoc(item)));
}

//======================exported functions=================

export function getWordByPos(string: string, character: number) {
    let sep = ['"', '\'', '*', '(', ')', '{', '}', '[', ']', '!', '<', '>', '|', '\\', '/', '.', ',', ':', ';', '&', ' ', '=', '\t'];
    let start = 0, end = string.length;
    for (let i = character; i <= string.length; i++) {
        if (~sep.indexOf(string[i])) {
            end = i;
            break;
        }
    }
    for (let i = character; i >= 0; i--) {
        if (~sep.indexOf(string[i])) {
            start = ++i;
            break;
        }
    }
    return string.substring(start, end);
}

const getExtactDoc = (value: string, type: string, variables: TVarDecl[]): TType => {
    let extractData = value.match(/(.+)\.extract/) ||
        value.match(/extract[ \t]*\([ \t]*([a-zA-z0-9_.()]*)[ \t]*\)/) || [];
    let out: TType = type, match: RegExpMatchArray | null;
    if (extractData.length < 2) return out;
    if (extractData[1] && (match = extractData[1].match(regexps.functionsRegExp)) != null) {
        let resultType = functions.find(({name}) => name === match![1])!.resultType;
        if (resultType && isUnion(resultType)) {
            out = resultType.filter(type => (type as TStruct)!.typeName !== 'Unit')
        }
    } else {
        out = getType(extractData[1].split('.'), variables, true).type;
    }
    return out
};

const unique = (arr: any) => {
    let obj: any = {};
    for (let i = 0; i < arr.length; i++) {
        if (!arr[i]) continue;
        let str = JSON.stringify(arr[i]);
        obj[str] = true;
    }
    return Object.keys(obj).map(type => JSON.parse(type));
};


export function findDeclarations(text: string): TVarDecl[] {
    let result: TVarDecl[] = [];
    const scriptType = scriptInfo(text).scriptType;

    if (scriptType === 1) {
        let type = types.find(item => item.name === 'Address');
        result.push({variable: 'this', type: type ? type.type : 'Unknown'});
    }

    if (scriptType === 2) result.push({variable: 'this', type: ["ByteVector", {"typeName": "Unit", "fields": []}]}); //assetId

    [
        ...getDataByRegexp(text, /@(Verifier|Callable)[ \t]*\((.+)\)/g)
            .map(item => ({...item, name: item.value, value: item.name})),
        ...getDataByRegexp(text, caseRegexp),
        ...getDataByRegexp(text, letRegexp),
    ]
        .map(({name, value}) => result.push(defineType(name, value, result) || {variable: name}));

    return result;
}


export function getDefinedVariables(vars: TContext[]) {
    const out: TVarDecl[] = [];
    vars.forEach(item => out.push(...item.vars));
    return out
}

const contextFrames = (text: string): TContext[] => {
    const re = /func[ \t]*(.*)\([ \t]*(.*)[ \t]*\)[ \t]*=[ \t]*{/g;
    const rows = text.split('\n');
    const out = getDataByRegexp(text, re).map(func => {
        const regexp = new RegExp(`([a-zA-z0-9_]+)[ \\t]*:[ \\t]*(${Suggestions.regexps.typesRegExp.source})`, 'g');

        let out: TContext = {
            vars: getDataByRegexp(func.value, regexp).map(({name, value}): TVarDecl =>
                ({variable: name, type: types.find(type => type.name === value)!.type})
            ),
            start: {row: func.row, col: 0},
            end: {row: rows.length, col: 0},
            children: []
        };
        let bracket = 1;
        let isStop = false;
        for (let i = func.row; i < rows.length; i++) {
            for (let j = 0; j < rows[i].length; j++) {
                if (rows[i][j] === '{') bracket++;
                if (rows[i][j] === '}') bracket--;
                if (bracket === 0) {
                    out.end.row = i + 1;
                    out.end.col = rows[i].length;
                    isStop = true;
                    break;
                }
            }
            if (isStop) break;
        }
        return out;
    });
    return [
        {
            vars: [],
            start: {row: 0, col: 0},
            end: {row: rows.length, col: rows[rows.length - 1].length},
            children: [],
        },
        ...out
    ]
};

export function findContextDeclarations(text: string): TContext[] {
    const scriptType = scriptInfo(text).scriptType;
    const result = contextFrames(text);
    if (scriptType === 1) {
        let type = types.find(item => item.name === 'Address');
        result[0].vars.push({variable: 'this', type: type ? type.type : 'Unknown'});
    }

    if (scriptType === 2) result[0].vars.push({
        variable: 'this',
        type: ["ByteVector", {"typeName": "Unit", "fields": []}]
    }); //assetId


    [
        ...getDataByRegexp(text, /@(Verifier|Callable)[ \t]*\((.+)\)/g)
            .map(item => ({...item, name: item.value, value: item.name})),
        ...getDataByRegexp(text, caseRegexp),
        ...getDataByRegexp(text, letRegexp),
    ]
        .forEach(item => { //by variables
            let isPushed = false;
            for (let i = 1; i < result.length; i++) {
                if (item.row >= result[i].start.row && item.row <= result[i].end.row) {
                    result[i].vars.push(defineType(item.name, item.value, getDefinedVariables(result)) || {variable: item.name});
                    isPushed = true;
                }
            }
            if (!isPushed) result[0].vars.push(defineType(item.name, item.value, getDefinedVariables(result)) || {variable: item.name});
        });

    return result;
}

function getType(inputWords: string[], declarations: TVarDecl[], isExtract?: boolean): TStructField {
    const extractUnit = (type: TType): TType => isExtract && isUnion(type)
        ? type.filter((item) => !(isStruct(item) && item.typeName === 'Unit'))
        : type;
    let declVariable = declarations.find(({variable, type}) => variable === inputWords[0] && type !== null);
    if (declVariable == null || !declVariable.type) return {name: 'Unknown', type: 'Unknown'};
    let out = {name: declVariable.variable, type: extractUnit(declVariable.type)};
    for (let i = 1; i < inputWords.length; i++) {
        let actualType;
        if (isStruct(out.type)) actualType = out.type.fields.find(type => type.name === inputWords[i]);
        if (actualType && actualType.type) out = {...actualType, type: extractUnit(actualType.type)}
    }
    return out;
}

function defineType(name: string, value: string, variables: TVarDecl[]): TVarDecl {
    let out: TVarDecl = {variable: name, type: 'Unknown'};
    let match: RegExpMatchArray | null, split;

    const variable = variables.find(({variable}) => variable === value);
    if (variable) out.type = variable.type;
    else if (Number(value.toString().replace(/_/g, '')).toString() !== 'NaN') {
        out.type = 'Int';
    } else if ((match = value.match(/\b(base58|base64)\b[ \t]*'(.*)'/)) != null) {
        out.type = 'ByteVector';
    } else if (/.*\b&&|==|!=|>=|>\b.*/.test(value) || /\btrue|false\b/.test(value)) {
        out.type = 'Boolean';
    } else if ((match = value.match(/^[ \t]*"(.+)"[ \t]*/)) != null) {
        out.type = 'String';
    } else if ((match = value.match(regexps.functionsRegExp)) != null) {
        out.type = functions.find(({name}) => name === match![1])!.resultType;
    } else if ((match = value.match(regexps.typesRegExp)) != null) {
        out.type = types.find(type => match != null && type.name === match[0])!.type;
    } else if ((match = value.match(/^[ \t]*\[(.+)][ \t]*$/)) != null) { //todo add variables define
        let uniqueType = unique(match[1].split(',')
            .map(type => defineType('', type, variables).type));
        out.type = (uniqueType.length === 1) ? {listOf: uniqueType[0]} : {listOf: "any"};
    } else if ((split = value.split('.')).length > 1) {
        const type = getType(split, variables);
        out.type = type.type;
        if ((match = getLastArrayElement(split).match(regexps.functionsRegExp)) != null) {
            let func = functions.find(({name}) => match != null && name === match[1]);
            if (func) out.type = func.resultType
        }
    } else if (value === 'Callable') {
        let type = types.find(item => item.name === 'Invocation');
        out = {variable: name, type: type != null ? type.type : out.type}
    } else if (value === 'Verifier') {
        let type = types.find(item => item.name === 'Transaction');
        out = {variable: name, type: type != null ? type.type : out.type}
    }

    if (out.type === 'TYPEPARAM(84)') out.type = getExtactDoc(value, out.type, variables);

    return out
}

export const getLastArrayElement = (arr: string[] | null): string => arr !== null ? [...arr].pop() || '' : '';


//======================non-exported functions=============

function intersection(types: TType[]): TStructField[] {
    const items = [...types];
    let structs: TStruct[] = [];
    if (types === []) {
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
    b.forEach(val => (~list.indexOf(val.name)) ? out.push(val) : false);
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
                valuePos: row.indexOf(myMatch[2]),
                row: i + 1
            });
        }
    });
    return declarations;
}


