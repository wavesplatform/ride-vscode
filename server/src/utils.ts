import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types';
import {
    types, functions, globalVariables, globalSuggestions, typesRegExp, transactionClasses, Classes,
    TStructInfo, TArrayInfo, TUnionInfo, TStructField,
} from './suggestions';

//=============================================================
interface ParamType {
    name: string
    type: string | any[]
    doc: string
}

interface typeType {
    typeName: string
}

interface LetDeclarationType {
    name: string
    value: string
}

//=============================================================

export function getCompletionDefaultResult(textBefore: string) {
    return [
        // get variables after 'let' and globalSuggestions
        ...getDataByRegexp(textBefore, /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm)
            .map(val => ({label: val.name, kind: CompletionItemKind.Variable})),
        ...globalSuggestions
    ]
}

export function getCaseCompletionResult(textBefore: string, inputWord: string, caseDeclarations: string[]) {
    let temp = textBefore.match(/\bcase[ \t]*.*/g)
        .filter((value: string) => !(/\bcase[ \t]*_/g).test(value))[caseDeclarations.lastIndexOf(inputWord)]
        .match(new RegExp(typesRegExp, 'g'))
        .map((value: string) => {
            let elementPos = types.map(({name}) => name).indexOf(value);
            if (elementPos > -1 && types[elementPos].type === "Struct")
                return (types[elementPos] as TStructInfo).fields;
            else
                return []
        });
    return intersection(...temp);
}

export function getLetCompletionResult(textBefore: string, inputWord: string) {
    let out: CompletionItem[] = [];
    //this regexp looks for variables
    findLetDeclarations(textBefore).map((val, _, arr) => {
        if (val.name === inputWord) {
            let elementPos = types.map((x: any) => x.name).indexOf(val.value);
            if (elementPos > -1 && types[elementPos].type === "Struct")
                out = (types[elementPos] as TStructInfo).fields;
            arr.length = 0;
        }
    });
    return out
}

export function getColonOrPipeCompletionResult(textBefore: string) {
    let out = [];
    ([...findMatchDeclarations(textBefore)].pop() === 'tx') ? out = transactionClasses : out = Classes;
    return out
}

export function getFieldsByType(type: string) {//
    let out: TStructField[] = [];
    let elementPos = types.map(({name}) => name).indexOf(type);
    if (elementPos > -1 && types[elementPos].type === "Struct")
        out = (types[elementPos] as TStructInfo).fields;
    return out
}

export const getTxFields = () => intersection(...transactionClasses.map(({label}) =>
    (types[types.map(({name}) => name).indexOf(label)] as TStructInfo).fields));


//=============================================================

export function getSignatureHelpResult(word: string) {
    let elementPos = functions.map((x: any) => x.name).indexOf(word);
    return (elementPos > -1) ?
        //get label in format: functionName (parameter1, parameter2 ...)
        [{
            label: `${word}(${functions[elementPos].args.map((p: ParamType) => `${p.name}: ${getTypeString(p.type)}`).join(', ')}): ` +
                `${getTypeString(functions[elementPos].resultType)}`,
            documentation: functions[elementPos].doc,
            parameters: functions[elementPos].args.map((p: ParamType) => ({
                label: `${p.name}: ${getTypeString(p.type)}`, documentation: p.doc
            }))
        }] :
        [];
}

//=============================================================

export function getHoverResult(word: string) {
    let result = [];
    let functionsPos = functions.map((x: any) => x.name).indexOf(word);
    let typesPos = types.map((x: any) => x.name).indexOf(word);

    if (functionsPos > -1) {
        result.push(
            `**${word}** (\n
            ${functions[functionsPos].args.map((p: ParamType) => `\n * ${`${p.name}: ${getTypeString(p.type)} - ${p.doc}`} \n`)}` +
            `\n) : ${getTypeString(functions[functionsPos].resultType)} \n>_${functions[functionsPos].doc}_`
        );
    } else if (types[typesPos]) {
        let selector;
        switch (types[typesPos].type) {
            case  'Primitive':
                result.push(types[typesPos].name);
                break;
            case  'Struct':
                selector = types[typesPos] as TStructInfo;
                result.push(`**${selector.name}**:
                ${selector.fields.map(({label, detail}) => ` \n- ${label}: ${detail}`).join(',')}`);
                break;
            case  'Array':
                selector = types[typesPos] as TArrayInfo;
                result.push(`**${selector.name}**: [${selector.items.type}:${selector.items.doc}]`);
                break;
            case  'Union':
                selector = types[typesPos] as TUnionInfo;
                result.push(`**${selector.name}**: ${selector.types.map(({label, detail}) => `\n- ${label}: ${detail}\n`).join('\n')}`);
                break;
        }
    } else {
        let elementPos = globalVariables.map((x: any) => x.name).indexOf(word);
        if (elementPos > -1) {
            result.push(globalVariables[elementPos].doc)
        }
    }

    return result;
}

//=============================================================

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
    return string.substring(start, end)
}

export function findCaseDeclarations(text: string): string[] {
    const re = /\bcase[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*:/gm;                   //this regexp looks for 'case' blocks
    const declarations: string[] = [];
    let myMatch;

    while ((myMatch = re.exec(text)) !== null) {
        declarations.push(myMatch[1])
    }

    return declarations
}

//=============================================================

function intersection(...args: any): CompletionItem[] {
    let out = args[0];
    for (let i = 1; i < args.length; i++) out = intersect(out, args[i]);
    return out
}

function getDataByRegexp(text: string, re: RegExp): LetDeclarationType[] {
    const declarations = [];
    let myMatch;
    while ((myMatch = re.exec(text)) !== null) {
        declarations.push({name: myMatch[1], value: myMatch[2]});
    }
    return declarations;
}

function intersect(a: CompletionItem[], b: CompletionItem[]) {
    let list: string[] = [], out: CompletionItem[] = [];
    a.forEach((val) => list.push(val.label));
    b.forEach(val => (list.indexOf(val.label) > -1) ? out.push(val) : false);
    return out
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

function findLetDeclarations(text: string): LetDeclarationType[] {
    return [
        //this regexp looks for variables
        ...getDataByRegexp(text, /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm)
    ].filter(val => {
        let match = val.value.match(typesRegExp);
        if (match !== null) {
            val.value = match[0] || '';
            return val
        } else return false
    })
}

const getTypeString = (type: string | any[]) =>
    (typeof type === 'string') ? type : type.map((v: typeType) => v.typeName).join('|');

