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
    unionToString,
} from './suggestions';
import { scriptInfo, TFunction, TList, TStruct, TStructField, TType, TUnion } from '@waves/ride-js'

export const suggestions = new SuggestionData();

const {regexps, types, functions, globalVariables, globalSuggestions} = suggestions;

//======================TYPES==============================
export type TPosition = {
    row: number
    col: number
};

type TVarDecl = {
    name: string,
    type: TType,
    doc?: string

};

type TContext = {
    vars: TVarDecl[]
    start: TPosition
    end: TPosition
    children: TContext[]
}

//======================STORAGE============================

const unique = (arr: any) => {
    let obj: any = {};
    for (let i = 0; i < arr.length; i++) {
        if (!arr[i]) continue;
        let str = JSON.stringify(arr[i]);
        obj[str] = true;
    }
    return Object.keys(obj).map(type => JSON.parse(type));
};

export class Storage {

    context: TContext = {
        vars: [],
        start: {row: 0, col: 0},
        end: {row: 0, col: 0},
        children: []
    };

    variables: TVarDecl[] = [];

    text: string = '';

    updateContext(text: string) {
        this.context = {
            vars: [],
            start: {row: 0, col: 0},
            end: {row: 0, col: 0},
            children: []
        };
        this.variables.length = 0;
        if (this.text !== text) this.findContextDeclarations(text);
    }

    getVariable = (name: string): (TVarDecl | undefined) =>
        this.variables.find(({name: varName}) => varName === name);

    getVariablesByPos = (p: TPosition): TVarDecl[] => this.getVariablesRec(this.context, p);

    getContextByPos = (p: TPosition): TContext => this.getContextRec(this.context, p);

    private getContextRec = (c: TContext, p: TPosition): TContext => {
        const newCtx: TContext | undefined = c.children.find(({start, end}) => this.comparePos(start, end, p));
        return (newCtx !== undefined) ? this.getContextRec(newCtx, p) : c;
    };


    private getVariablesRec(c: TContext, p: TPosition): TVarDecl[] {
        const out: TVarDecl[] = c.vars;
        const childCtx = c.children.find(({start, end}) => this.comparePos(start, end, p));
        if (childCtx) out.push(...this.getVariablesRec(childCtx, p));
        return out;
    }

    private comparePos(start: TPosition, end: TPosition, p: TPosition): boolean {
        if (start.row < p.row && end.row > p.row) return true;
        else if (start.row === p.row && start.col <= p.col - 1) return true;
        else if (end.row === p.row && end.col >= p.col - 1) return true;
        return false
    }

    private defineType(name: string, value: string): TVarDecl {
        let out: TVarDecl = {name: name, type: 'Unknown'};
        let match: RegExpMatchArray | null, split;

        const variable = this.getVariable(value);
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
        } else if ((match = value.match(/^[ \t]*\[(.+)][ \t]*$/)) != null) {
            let uniqueType = unique(match[1].split(',')
                .map(type => this.defineType('', type).type));
            out.type = (uniqueType.length === 1) ? {listOf: uniqueType[0]} : {listOf: "any"};
        } else if ((split = value.split('.')).length > 1) {
            const type = getLadderType(this, split);
            out.type = type.type;
            if ((match = getLastArrayElement(split).match(regexps.functionsRegExp)) != null) {
                let func = functions.find(({name}) => match != null && name === match[1]);
                if (func) out.type = func.resultType
            }
        } else if (value === 'Callable') {
            let type = types.find(item => item.name === 'Invocation');
            out = {name: name, type: type != null ? type.type : out.type}
        } else if (value === 'Verifier') {
            let type = types.find(item => item.name === 'Transaction');
            out = {name: name, type: type != null ? type.type : out.type}
        }

        if (out.type === 'TYPEPARAM(84)') out.type = this.getExtactDoc(this, value, out.type);
        return out
    };

    private getContextFrame(p: TPosition, rows: string[], vars?: TVarDecl[]): TContext {

        let out: TContext = {
            vars: vars || [],
            start: {row: p.row, col: p.col},
            end: {row: rows.length - 1, col: rows[rows.length - 1].length},
            children: []
        };
        let bracket = 1;
        let isStop = false;
        for (let i = p.row; i < rows.length; i++) {

            let childrenVariables: TVarDecl[] = [];
            if (~rows[i].indexOf('{-#') || ~rows[i].indexOf(' #-}')) continue;
            if (bracket === 1) {
                const vars = this.getVariables(rows[i]);
                out.vars.push(...vars);
                childrenVariables = this.getChlidrenVariables(rows[i]);
                this.variables.push(...vars, ...childrenVariables)
            }

            for (let j = ((i === p.row) ? (p.col + 1) : 0); j < rows[i].length; j++) {

                if (rows[i][j] === '}') bracket--;

                if (rows[i][j] === '{') {
                    const child = this.getContextFrame({row: i, col: j}, rows, childrenVariables);
                    out.children.push(child);
                    i = child.end.row;
                    j = child.end.col;
                }

                if (bracket === 0) {
                    out.end.row = i;
                    out.end.col = j + 1;
                    isStop = true;
                    break;
                }
            }
            if (isStop) break;
        }
        return out;
    }

    private getGlobalVariables(scriptType: number) {
        const out = globalVariables.map(v => this.pushGlobalVariable(v));
        if (scriptType === 1) {
            let type = types.find(item => item.name === 'Address');
            out.push(this.pushGlobalVariable({name: 'this', type: type ? type.type : 'Unknown'}))
        }

        if (scriptType === 2) out.push(this.pushGlobalVariable({
            name: 'this',
            type: ["ByteVector", {"typeName": "Unit", "fields": []}]
        })); //assetId
        return out;
    }

    private getVariables = (row: string) => [
        ...getDataByRegexp(row, letRegexp),
    ].map(({name, value}) => this.defineType(name, value) || {variable: name});

    private getChlidrenVariables = (row: string) => [
        ...getDataByRegexp(row, /@(Verifier|Callable)[ \t]*\((.+)\)/g)
            .map(item => ({...item, name: item.value, value: item.name})),
        ...getDataByRegexp(row, matchRegexp).map(({name}) => ({name, value: 'Transaction'})),
        ...getDataByRegexp(row, caseRegexp),

    ].map(({name, value}) => this.defineType(name, value) || {variable: name});

    private findContextDeclarations(text: string) {
        const scriptType = scriptInfo(text).scriptType;
        const rows = text.split('\n');
        const out = this.getContextFrame({row: 0, col: 0}, rows, this.getGlobalVariables(scriptType));
        this.context = out;
        return out;
    }

    private pushGlobalVariable(v: TVarDecl) {
        const index = this.variables.findIndex(({name}) => name === v.name);
        if (~index) this.variables[index] = {...this.variables[index], ...v};
        else this.variables.push(v);

        return v;
    }

    private getExtactDoc = (ctx: Storage, value: string, type: string): TType => {
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
            out = getLadderType(ctx, extractData[1].split('.'), true).type;
        }
        return out
    };

}


export const ctx = new Storage();

//======================COMPLETION=========================

export const getCompletionDefaultResult = (p: TPosition) => {
    return [
        ...globalSuggestions,
        ...ctx.getVariablesByPos(p)
            .map(item => ({label: item.name, kind: CompletionItemKind.Variable, detail: item.doc})),
    ];
};

export const getCompletionResult = (inputWords: string[]) =>
    getLadderCompletion(ctx, inputWords).map((item) => convertToCompletion(item));


function getLadderCompletion(ctx: Storage, inputWords: string[]): TStructField[] {
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


function getLadderType(ctx: Storage, inputWords: string[], isExtract?: boolean): TStructField {
    const extractUnit = (type: TType): TType => isExtract && isUnion(type)
        ? type.filter((item) => !(isStruct(item) && item.typeName === 'Unit'))
        : type;
    let declVariable = ctx.getVariable(inputWords[0]);
    if (declVariable == null || !declVariable.type) return {name: 'Unknown', type: 'Unknown'};
    let out = {name: declVariable.name, type: extractUnit(declVariable.type)};
    for (let i = 1; i < inputWords.length; i++) {
        let actualType;
        if (isStruct(out.type)) actualType = out.type.fields.find(type => type.name === inputWords[i]);
        if (actualType && actualType.type) out = {...actualType, type: extractUnit(actualType.type)}
    }
    return out;
}

export const getColonOrPipeCompletionResult = (text: string, p: TPosition): CompletionItem[] => {
    let out: CompletionItem[] = types.map((type: TStructField) => convertToCompletion(type));
    const context = ctx.getContextByPos(p);
    let matchRes =  matchRegexp.exec(text.split('\n')[context.start.row]);
    if (matchRes != null && matchRes[1]) {
        const variable = ctx.getVariablesByPos(p).find(({name}) => name === matchRes![1].toString());
        if (variable && variable.type && isUnion(variable.type)) {
            out = variable.type.map(({typeName}: any) => ({label: typeName, kind: CompletionItemKind.Class}));
        }
    }
    return out
};

export const checkPostfixFunction = (inputWord: string) => {
    let variable = ctx.getVariable(inputWord);
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

export function getHoverResult(word: string, inputWords: string[]) {


    const getHoverFunctionDoc = (func: TFunction) => `**${func.name}** (${func.args.length > 0 ?
        `\n${func.args.map(({name, type, doc}) => `\n * ${`${name}: ${getFunctionArgumentString(type)} - ${doc}`} \n`)}\n` :
        ' '}) : ${getFunctionArgumentString(func.resultType)} \n>_${func.doc}_`;

    return unique(
        getLadderCompletion(ctx, inputWords)
            .filter(({name}) => name === word).map(item => `**${item.name}**: ` + getTypeDoc(item))
            .concat(ctx.variables.filter(({name}) => name === word)
                .map(({type}) => type ? getTypeDoc({name: '', type: type}, true) : 'Unknown'))
            .concat(globalVariables.filter(({name}) => name === word).map(({doc}) => doc))
            .concat(getFunctionsByName(word).map((func: TFunction) => getHoverFunctionDoc(func)))
            .concat(types.filter(({name}) => name === word).map(item => getTypeDoc(item)))
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

const getFunctionsByName = (funcName: string): TFunction[] => functions.filter(({name}: TFunction) => name === funcName);

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

function intersection(types: TType[]): TStructField[] {
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
                row: i
            });
        }
    });
    return declarations;
}



