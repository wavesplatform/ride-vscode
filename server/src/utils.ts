import { CompletionItem, CompletionItemKind, Position, Location } from 'vscode-languageserver-types';
import { isList, isPrimitive, isStruct, isUnion, listToString, unionToString } from './suggestions';
import { TFunction, TList, TStruct, TStructField, TType, TUnion } from '@waves/ride-js'
import { Context, suggestions, TPosition } from "./context";

export const ctx = new Context();
const { types, functions, globalVariables, globalSuggestions } = suggestions;
import * as jsonSuggestions from './suggestions/suggestions.json';


//======================DEFINITION=========================

export function getVarDefinition(word: string, { line: row, character: col }: Position) {
    const variable = ctx.getVariablesByPos({ row, col }).reverse().find(({ name: varName }) => varName === word);
    return variable && variable.pos ? {line: variable.pos.row, character: variable.pos.col} : undefined
}

//======================COMPLETION=========================

export const getCompletionDefaultResult = (p: TPosition) => {
    return [
        ...globalSuggestions,
        ...types.filter(item => isStruct(item.type))
            .map(({ name }) => ({ kind: CompletionItemKind.Class, label: name })),
        ...ctx.getVariablesByPos(p)
            .map(item => ({ label: item.name, kind: CompletionItemKind.Variable, detail: item.doc })),
    ];
};

export const getCompletionResult = (inputWords: string[]) =>
    getLadderCompletion(ctx, inputWords).map((item) => convertToCompletion(item));


function getLadderCompletion(ctx: Context, inputWords: string[]): TStructField[] {
    let declVariable = ctx.getVariable(inputWords[0]);
    if (declVariable == null || !declVariable.type) return [];
    let out = intersection(isUnion(declVariable.type) ? declVariable.type : [declVariable.type]);

    for (let i = 1; i < inputWords.length - 1; i++) {
        let actualType = out.find(item => item.name === inputWords[i] && !isPrimitive(item.type) && !isList(item.type));

        if (!actualType) return [];
        if (isStruct(actualType.type)) out = actualType.type.fields;
        if (isUnion(actualType.type)) out = intersection(actualType.type)

    }
    return out;
}


export const getColonOrPipeCompletionResult = (text: string, p: TPosition): CompletionItem[] => {
    let out: CompletionItem[] = types.map((type: TStructField) => convertToCompletion(type));
    const context = ctx.getContextByPos(p);
    const matchRegexp = /\bmatch[ \t(]+\b(.+)\b[ \t)]*[{=]*/gm;
    let matchRes = matchRegexp.exec(text.split('\n')[context.start.row]);
    if (matchRes != null && matchRes[1]) {
        const variable = ctx.getVariablesByPos(p).find(({ name }) => name === matchRes![1].toString());
        if (variable && variable.type && isUnion(variable.type)) {
            out = variable.type.map(({ typeName }: any) => ({ label: typeName, kind: CompletionItemKind.Class }));
        }
    }
    return out
};

export const checkPostfixFunction = (inputWord: string) => {
    let variable = ctx.getVariable(inputWord);

    const out = functions.filter(({ args }) => {
        if (!args[0] || !variable || !variable.type) return false;

        let type = variable.type;

        if (isPrimitive(type) && isPrimitive(args[0].type) && type === args[0].type) return true;

        if (isStruct(type) && isStruct(args[0].type)) {
            if (type.typeName === args[0].type.typeName) {
                return true;
            }
        }

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

    return out
};


//======================SignatureHelp======================

export function getSignatureHelpResult(word: string, isShift: boolean) {
    type TStructTypeField = { name: string, type: TStruct };

    const getLabel = (name: string, args: TStructField[], resultType: TType) =>
        `${name}(${args.map(({ name, type }) =>
            `${name}: ${getFunctionArgumentString(type)}`).join(', ')}): ${getFunctionArgumentString(resultType)}`;

    const getParameters = (args: TStructField[]) => args.map(({ name, type }) => ({
        label: `${name}: ${getFunctionArgumentString(type)}`
    }));

    return [
        ...getFunctionsByName(word).map(func => ({
            ...func,
            args: func.args.filter((_, i) => !(isShift && i === 0))
        })).map(({ name, args, doc, resultType }) =>
            ({ label: getLabel(name, args, resultType), documentation: doc, parameters: getParameters(args) })),

        ...types.filter((item): item is TStructTypeField => item.name === word && isStruct(item.type))
            .map(({ name, type }: TStructTypeField) =>
                ({ label: getLabel(name, type.fields, type), parameters: getParameters(type.fields) }))
    ]
}

//======================Hover==============================

export function getHoverResult(word: string, inputWords: string[]) {

    const getHoverFunctionDoc = (func: TFunction) => `**${func.name}** (${func.args.length > 0 ?
        `\n${func.args.map(({ name, type, doc }) => `\n * ${`${name}: ${getFunctionArgumentString(type)} - ${doc}`} \n`)}\n` :
        ' '}) : ${getFunctionArgumentString(func.resultType)} \n>_${func.doc}_`;
    return unique(
        getLadderCompletion(ctx, inputWords)
            .filter(({ name }) => name === word).map(item => `**${item.name}**: ` + getTypeDoc(item))
            .concat(ctx.variables.filter(({ name }) => name === word)
                .map(({ type }) => type ? getTypeDoc({ name: '', type: type }, true) : 'Unknown'))
            .concat(globalVariables.filter(({ name }) => name === word).map(({ doc }) => doc))
            .concat(getFunctionsByName(word).map((func: TFunction) => getHoverFunctionDoc(func)))
            .concat(types.filter(({ name }) => name === word).map(item => getTypeDoc(item)))
            .concat(jsonSuggestions.snippets.filter(({ label, detail }) => label === word && detail)
                .map(({detail}) => detail || ''))
    );
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

export const getLastArrayElement = (arr: string[] | null): string => arr !== null ? [...arr].pop() || '' : '';


//======================HELPERS============================

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

export const getTypeDoc = (item: TStructField, isRec?: Boolean): string => {
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

const getFunctionsByName = (funcName: string): TFunction[] => functions.filter(({ name }: TFunction) => name === funcName);

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

export function intersection(types: TType[]): TStructField[] {
    const items = [...types];
    let structs: TStruct[] = [];
    if (types === [] || items.length === 0) {
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

export type TDecl = {
    name: string
    namePos?: number
    value: string
    valuePos?: number
    row?: number
}

export function getDataByRegexp(text: string, re: RegExp) {
    const declarations: TDecl[] = [];
    const split = text.split('\n');
    let myMatch;

    split.forEach((row: string, i: number) => {
        while ((myMatch = re.exec(row)) !== null) {
            declarations.push({
                name: myMatch[1],
                namePos: row.indexOf(myMatch[1]),
                value: myMatch[2],
                valuePos: row.indexOf(myMatch[2]),
                row: i
            });
        }
    });

    return declarations;
}

export const unique = (arr: any) => {
    let obj: any = {};
    for (let i = 0; i < arr.length; i++) {
        if (!arr[i]) continue;
        let str = JSON.stringify(arr[i]);
        obj[str] = true;
    }
    return Object.keys(obj).map(type => JSON.parse(type));
};
