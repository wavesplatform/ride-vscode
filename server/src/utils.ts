import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types';
import {
    types, functions, globalVariables, globalSuggestions, transactionClasses, Classes,
    typesRegExp, functionsRegExp, letRegexp,
    TItem, TPrimitive, TStruct, TStructType, TList, TListType, TUnion, TFunction,
    isString, isPrimitive, isStruct, isStructType, isUnion, isList, isListType,
    handleTUnion, handleTList, handleTListType, handleTStruct, getUnionItemName, handlePrimitive
} from './suggestions';


//======================TYPES==============================

type TVariableDeclaration = {
    variable: string
    types?: string[]
    value?: string
}


//======================HELPERS============================

//----------------------TFunction--------------------------
const handleFuncTypes = (type: string | TListType | TStructType | (TStructType | string)[]): string => {
    let result;
    switch (true) {
        case isString(type):
            result = (type as string);
            break;
        case isListType(type as TListType):
            result = handleTListType(type as TListType);
            break;
        case isStructType(type as TStructType):
            result = (type as TStructType).typeName;
            break;
        case Array.isArray(type):
            result = (type as (TStructType | string)[])
                .map((type: TStructType | string) => isStructType(type) ? type.typeName : type).join('|');
            break;
    }
    return result;
};

const getFunctionsByName = (funcName: string): TFunction[] => functions.filter(({name}: TFunction) => name === funcName);


//----------------------Completion-------------------------
const conventToCompletion = (type: TItem): CompletionItem => {
    let result;
    switch (true) {
        case isPrimitive(type):
            result = handlePrimitive(type as TPrimitive);
            break;
        case isStruct(type):
            result = handleTStruct(type as TStruct);
            break;
        case isList(type):
            result = handleTList(type as TList);
            break;
        case isUnion(type):
            result = handleTUnion(type as TUnion);
    }
    return {
        label: result.name,
        detail: result.doc,
        kind: CompletionItemKind.Field
    };
};


//----------------------Types------------------------------
const getTypeDoc = (type: TItem): string => {
    let typeDoc;
    switch (true) {
        case isPrimitive(type):
            typeDoc = type.type as string;
            break;
        case isStruct(type):
            typeDoc = (type as TStruct).type.typeName;
            break;
        case isUnion(type):
            typeDoc = (type as TUnion).type.map(field => isStructType(field) ? field.typeName : field).join('|');
            break;
        case isList(type):
            typeDoc = `LIST[ ` +
                `${((type as TList).type.listOf as TStructType).typeName || (type as TList).type.listOf}]`;
            break;
    }
    return typeDoc;
};

const getTypeByName = (typeName: string): TItem => types[types.map(({name}: TItem) => name).indexOf(typeName)];


//======================COMPLETION=========================

export const getTxFields = () => intersection(...transactionClasses.map(({label}) => getTypeByName(label) as TStruct))
    .map((item) => conventToCompletion(item));

export function getCompletionDefaultResult(textBefore: string) {
    return [
        // get variables after 'let' and globalSuggestions
        ...getDataByRegexp(textBefore, letRegexp).map(val => ({label: val.name, kind: CompletionItemKind.Variable})),
        ...globalSuggestions
    ];
}

export const getCaseCompletionResult = (inputWords: string[], caseDeclarations: TVariableDeclaration[]) =>
    getCaseVariablesHelp(inputWords, caseDeclarations).map((item) => conventToCompletion(item));

function getCaseVariablesHelp(inputWords: string[], caseDeclarations: TVariableDeclaration[]) {
    const typesByNames = (names: string[]): TStruct[] => types.filter(({name}) => names.indexOf(name) > -1);

    let declVariable = caseDeclarations.filter(({variable, types}) => variable === inputWords[0] && types !== null)[0];
    if (!declVariable) return [];
    let out = intersection(...typesByNames(declVariable.types));
    for (let i = 1; i < inputWords.length - 1; i++) {
        let actualType = out.filter( item => item.name === inputWords[i] && !isPrimitive(item) && !isList(item))[0];
        if (!actualType) return [];
        out = intersection(
            ...typesByNames(isStruct(actualType) ?
                [actualType.type.typeName] :
                (actualType as TUnion).type.map(item => getUnionItemName(item))
            )
        )
    }
    return out;
}

export function getLetCompletionResult(textBefore: string, inputWord: string) {
    let out: CompletionItem[] = [];
    //this regexp looks for variables
    findLetDeclarations(textBefore).map((val) => {
        if (val.variable === inputWord) {
            out = intersection(...val.types.map(name => (getTypeByName(name) as TStruct))
                .filter(item => item !== undefined)).map((item) => conventToCompletion(item));
        }
    });

    return out;
}

export const getColonOrPipeCompletionResult = (textBefore: string) =>
    ([...findMatchDeclarations(textBefore)].pop() === 'tx') ? transactionClasses : Classes;


//======================SignatureHelp======================

export function getSignatureHelpResult(word: string) {
    let func = getFunctionsByName(word);
    return func.map((func: TFunction) => ({
        label: `${word}(${func.args.map(({name, type}) =>
            `${name}: ${handleFuncTypes(type)}`).join(', ')}): ${handleFuncTypes(func.resultType)}`,
        documentation: func.doc,
        parameters: func.args.map(({name, type, doc}) => ({
            label: `${name}: ${handleFuncTypes(type)}`, documentation: doc
        }))
    }))
}


//======================Hover==============================

export function getHoverResult(textBefore: string, word: string, inputWords: string[]) {
    let hoveredFunctions = getFunctionsByName(word);
    let hoveredType = getTypeByName(word);

    let caseDeclarations = findCaseDeclarations(textBefore);

    let result: string[] = [
        ...getCaseVariablesHelp(inputWords, caseDeclarations)
            .map((item: TItem) => ({variable: item.name, types: getTypeDoc(item)})),
        ...findLetDeclarations(textBefore).map(item => ({...item, types: item ? item.types.join('|') : ''}))
    ]
        .filter(decl => decl && decl.variable === word)
        .map(decl => `**${decl.variable}**: ` + decl.types);

    if (hoveredFunctions.length > 0) {
        result = (hoveredFunctions.map((func: TFunction): string => `**${word}** (${func.args.length > 0 ?
            `\n${func.args.map(({name, type, doc}) => `\n * ${`${name}: ${handleFuncTypes(type)} - ${doc}`} \n`)}\n` : 
            ' '}) : ${handleFuncTypes(func.resultType)} \n>_${func.doc}_`));
    } else if (hoveredType) {
        result.push(`**${hoveredType.name}**: ${getTypeDoc(hoveredType)}`)
    } else if (caseDeclarations.map(({variable}) => variable).indexOf(word) > -1) {
        result.push(caseDeclarations[caseDeclarations.map(({variable}) => variable).indexOf(word)].types.join('|'))
    } else {
        let elementPos = globalVariables.map(x => x.name).indexOf(word);
        if (elementPos > -1) {
            result.push(globalVariables[elementPos].doc)
        }
    }
    return result;
}


//======================exported functions=================

export function getWordByPos(string: string, character: number) {
    let sep = ['"', '\'', '*', '(', ')', '{', '}', '[', ']', '!', '<', '>', '|', '\\', '/', '.', ',', ':', ';', '&', ' ', '=', '\t'];
    let start = 0, end = string.length;
    for (let i = character; i <= string.length; i++) {
        if (sep.indexOf(string[i]) > -1) {
            end = i;
            break
        }
    }
    for (let i = character; i >= 0; i--) {
        if (sep.indexOf(string[i]) > -1) {
            start = ++i;
            break
        }
    }
    return string.substring(start, end);
}

export function findCaseDeclarations(text: string): TVariableDeclaration[] {
    const re = /\bcase[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*:.*$/gm;                 //this regexp looks for 'case' blocks
    const declarations = [];
    let myMatch;

    while ((myMatch = re.exec(text)) !== null) {
        declarations.push({
            variable: myMatch[1],
            types: (myMatch[0].match(new RegExp(typesRegExp, 'g')) as string[])
        })
    }

    return declarations;
}


//======================non-exported functions=============

function intersection(...args: TStruct[]) {
    if (args.length === 0)
        return [];
    let out = args[0].type.fields;
    for (let i = 1; i < args.length; i++) out = intersect(out, args[i].type.fields);
    return out;
}

function intersect(a: TItem[], b: TItem[]) {
    let list: string[] = [], out: TItem[] = [];
    a.forEach((val) => list.push(val.name));
    b.forEach(val => (list.indexOf(val.name) > -1) ? out.push(val) : false);
    return out;
}

function getDataByRegexp(text: string, re: RegExp) {
    const declarations = [];
    let myMatch;
    while ((myMatch = re.exec(text)) !== null) {
        declarations.push({name: myMatch[1], value: myMatch[2]});
    }
    return declarations;
}


function findMatchDeclarations(text: string) {
    const re = /\bmatch[ \t]*\([ \t]*([a-zA-z0-9_]+)[ \t]*\)/gm;                //this regexp looks for 'match' blocks
    const declarations = [];
    let myMatch;
    while ((myMatch = re.exec(text)) !== null) {
        declarations.push(myMatch[1]);
    }
    return declarations;
}

export function findLetDeclarations(text: string): TVariableDeclaration[] {

    const getFuncType = (funcName: string) => {
        let type = functions.filter(({name}) => name === funcName).pop().resultType;
        return (typeof type === 'string') ? [type] : (type as (TStructType[])).map((v: TStructType) => v.typeName);
    };

    return getDataByRegexp(text, letRegexp)
        .map(({name, value}) => {
            let out: TVariableDeclaration;
            if (Number(value.toString().replace(/_/g, '')).toString() !== 'NaN')
                out = {variable: name, types: ['Int'], value: value};
            else if (/\b(base58|base64)\b[ \t]*'(.*)'/.test(value)) {
                let match = value.match(/\b(base58|base64)\b[ \t]*'(.*)'/);
                out = {variable: name, types: [match[1]], value: match[2]}
            } else if (functionsRegExp.test(value)) {
                let match = value.match(functionsRegExp);
                out = {variable: name, types: getFuncType(match[1])}
            } else if (typesRegExp.test(value)) {
                out = {variable: name, types: value.match(typesRegExp)}
            } else if (/.*\b&&|==|!=|>=|>\b.*/.test(value)) {
                out = {variable: name, types: ['Boolean']}
            }
            return out;
        })
}
