import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types';
import { types, functions, globalVariables, globalSuggestions, transactionClasses, classes, typesRegExp,
    functionsRegExp, letRegexp, TType, TStruct, TList, TUnion, TFunction, isPrimitive, isStruct, isUnion, isList,
    TUnionItem, TStructField, listToString, unionToString } from './suggestions';


//======================TYPES==============================

type TVariableDeclaration = {
    variable: string
    types?: string[]
    value?: string
}


//======================HELPERS============================

//----------------------TFunction--------------------------
const getFunctionArgumentString = (type: TType): string => {
    if (isPrimitive(type)){
        return type
    }else if (isList(type)){
        return listToString(type)
    }else if (isStruct(type)){
        return type.typeName
    }else if (isUnion(type)){
        return type.map((type: TUnionItem) => isStruct(type) ? type.typeName : type).join('|');
    }else {
        return 'Unknown'
    }
};

const getFunctionsByName = (funcName: string): TFunction[] => functions.filter(({name}: TFunction) => name === funcName);


//----------------------Completion-------------------------
const convertToCompletion = (field: TStructField): CompletionItem => {
    let detail: string = '';
    if (isPrimitive(field.type)){
        detail =  field.type
    }else if (isList(field.type)){
        detail = listToString(field.type)
    }else if (isStruct(field.type)){
        detail = field.type.typeName
    }else if (isUnion(field.type)){
        detail = unionToString(field.type)
    }

    return {
        label: field.name,
        detail,
        kind: CompletionItemKind.Field
    };
};


//----------------------Types------------------------------
const getTypeDoc = (type: TType): string => {
    let typeDoc;
    switch (true) {
        case isPrimitive(type):
            typeDoc = type as string;
            break;
        case isStruct(type):
            typeDoc = (type as TStruct).typeName;
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

const getTypeByName = (typeName: string): TType => types.find(({name}) => name === typeName).type;


//======================COMPLETION=========================

export const txFields = intersection((types as any)['Transaction'] as TUnion)
    .map((item) => convertToCompletion(item));
// Todo: remove
export const getTxFields = () => intersection((types as any)['Transaction'] as TUnion)
    .map((item) => convertToCompletion(item));

export function getCompletionDefaultResult(textBefore: string) {
    return [
        // get variables after 'let' and globalSuggestions
        ...getDataByRegexp(textBefore, letRegexp).map(val => ({label: val.name, kind: CompletionItemKind.Variable})),
        ...globalSuggestions
    ];
}

export const getCaseCompletionResult = (inputWords: string[], caseDeclarations: TVariableDeclaration[]) =>
    getCaseVariablesHelp(inputWords, caseDeclarations).map((item: any) => convertToCompletion(item));

function getCaseVariablesHelp(inputWords: string[], caseDeclarations: TVariableDeclaration[]) {
    const typesByNames = (names: string[]): TType[] => types.filter(({name}) => names.indexOf(name) > -1)
        .map(({type})=> type);

    let declVariable = caseDeclarations.filter(({variable, types}) => variable === inputWords[0] && types !== null)[0];
    if (!declVariable) return [];
    let out = intersection(typesByNames(declVariable.types));
    for (let i = 1; i < inputWords.length - 1; i++) {
        let actualType = out.filter( item => item.name === inputWords[i] && !isPrimitive(item.type) && !isList(item.type))[0];
        if (!actualType){
            out = []
        } else if (isStruct(actualType.type)){
            out = actualType.type.fields;
        }else if (isUnion(actualType.type)) {
            out = intersection(actualType.type)
        }
    }
    return out;
}

export function getLetCompletionResult(textBefore: string, inputWord: string) {
    let out: CompletionItem[] = [];
    //this regexp looks for variables
    findLetDeclarations(textBefore).map((val) => {
        if (val.variable === inputWord) {
            out = intersection(val.types.map(name => (getTypeByName(name) as TStruct))
                .filter(item => item !== undefined)).map((item) => convertToCompletion(item));
        }
    });

    return out;
}

export const getColonOrPipeCompletionResult = (textBefore: string) =>
    ([...findMatchDeclarations(textBefore)].pop() === 'tx') ? transactionClasses : classes;


//======================SignatureHelp======================

export function getSignatureHelpResult(word: string) {
    let func = getFunctionsByName(word);
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
    let hoveredFunctions = getFunctionsByName(word);
    let hoveredType = getTypeByName(word);

    let caseDeclarations = findCaseDeclarations(textBefore);

    let result: string[] = [
        ...getCaseVariablesHelp(inputWords, caseDeclarations)
            .map((item: TStructField) => ({variable: item.name, types: getTypeDoc(item.type)})),
        ...findLetDeclarations(textBefore).map(item => ({...item, types: item ? item.types.join('|') : ''}))
    ]
        .filter(decl => decl && decl.variable === word)
        .map(decl => `**${decl.variable}**: ` + decl.types);

    if (hoveredFunctions.length > 0) {
        result = (hoveredFunctions.map((func: TFunction): string => `**${word}** (${func.args.length > 0 ?
            `\n${func.args.map(({name, type, doc}) => `\n * ${`${name}: ${getFunctionArgumentString(type)} - ${doc}`} \n`)}\n` : 
            ' '}) : ${getFunctionArgumentString(func.resultType)} \n>_${func.doc}_`));
    } else if (hoveredType) {
        result.push(`**${word}**: ${getTypeDoc(hoveredType)}`)
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

function intersection(items: TType[]): TStructField[] {
    let structs: TStruct[] = [];

    let next: TType = items.pop()
    while (items.length > 0){
        if(isStruct(next)){
            structs.push(next)
        }else if (isUnion(next)){
            items.push(...next)
        }else {
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
        return (typeof type === 'string') ? [type] : (type as (TStruct[])).map((v: TStruct) => v.typeName);
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
