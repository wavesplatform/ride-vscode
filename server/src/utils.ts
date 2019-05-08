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

const {regexps, types, functions, globalVariables, globalSuggestions, transactionClasses} = suggestions;

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

//======================STORAGE============================

function comparePos(start: TPosition, end: TPosition, p: TPosition): boolean {
    if (start.row > p.row && end.row < p.row) return true;
    else if (start.row === p.row && start.col <= p.col-1) return true;
    else if (end.row === p.row && end.col >= p.col-1) return true;
    return false
}

function getDefinedVariables(vars: TContext[]) {
    const out: TVarDecl[] = [];
    vars.forEach(item => out.push(...item.vars));
    return out
}

export class Storage {

    contexts: TContext[] = [];

    variables: TVarDecl[] = [];

    text: string = '';

    updateContext(text: string) {
        if (this.text !== text) this.findContextDeclarations(text);
    }

    getVariable = (name: string): (TVarDecl | undefined) =>
        this.variables.find(({variable}) => variable === name);

    getVariablesByPos = (p: TPosition) => getDefinedVariables(
        this.contexts.filter(({start, end}) => comparePos(start, end, p))
    );

    defineType(name: string, value: string): TVarDecl {
        let out: TVarDecl = {variable: name, type: 'Unknown'};
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
            let uniqueType = this.unique(match[1].split(',')
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
            out = {variable: name, type: type != null ? type.type : out.type}
        } else if (value === 'Verifier') {
            let type = types.find(item => item.name === 'Transaction');
            out = {variable: name, type: type != null ? type.type : out.type}
        }

        if (out.type === 'TYPEPARAM(84)') out.type = this.getExtactDoc(this, value, out.type);
        return out
    };


    private contextFrames = (text: string) => {
        const re = /func[ \t]*(.*)\([ \t]*(.*)[ \t]*\)[ \t]*=[ \t]*{/g;
        const rows = text.split('\n');
        const out = getDataByRegexp(text, re).map(func => {
            const regexp = new RegExp(`([a-zA-z0-9_]+)[ \\t]*:[ \\t]*(${regexps.typesRegExp.source})`, 'g');

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
        this.contexts = [
            {
                vars: [],
                start: {row: 0, col: 0},
                end: {row: rows.length, col: rows[rows.length - 1].length},
                children: [],
            },
            ...out
        ]
    };

    private findContextDeclarations(text: string) {
        const scriptType = scriptInfo(text).scriptType;
        this.contextFrames(text);
        this.pushGlobalVariable({variable: 'tx', type: transactionClasses});

        if (scriptType === 1) {
            let type = types.find(item => item.name === 'Address');
            this.pushGlobalVariable({variable: 'this', type: type ? type.type : 'Unknown'})
        }

        if (scriptType === 2) this.pushGlobalVariable({
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
                const variable = this.defineType(item.name, item.value) || {variable: item.name};
                this.variables.push(variable);
                for (let i = 1; i < this.contexts.length; i++) {
                    if (item.row >= this.contexts[i].start.row && item.row <= this.contexts[i].end.row) {
                        this.contexts[i].vars.push(variable);
                        isPushed = true;
                    }
                }
                if (!isPushed) this.contexts[0].vars.push(variable);
            });
    }

    private pushGlobalVariable(v: TVarDecl) {
        this.variables.push(v);
        this.contexts[0].vars.push(v);
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
            //out = getLadderType(ctx, extractData[1].split('.'), true).type;
        }
        return out
    };

    private unique = (arr: any) => {
        let obj: any = {};
        for (let i = 0; i < arr.length; i++) {
            if (!arr[i]) continue;
            let str = JSON.stringify(arr[i]);
            obj[str] = true;
        }
        return Object.keys(obj).map(type => JSON.parse(type));
    };


}

export const ctx = new Storage();

//======================COMPLETION=========================

export const getCompletionDefaultResult = (p: TPosition) =>{
    console.error(JSON.stringify(ctx.contexts.map(({start, end}) => [start, end, p]), null, 4))
    
   return [
        ...getDefinedVariables(ctx.contexts.filter(({start, end}) => comparePos(start, end, p)))
            .map(item => ({label: item.variable, kind: CompletionItemKind.Variable})),
        ...globalSuggestions,
    ];
}

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
    let out = {name: declVariable.variable, type: extractUnit(declVariable.type)};
    for (let i = 1; i < inputWords.length; i++) {
        let actualType;
        if (isStruct(out.type)) actualType = out.type.fields.find(type => type.name === inputWords[i]);
        if (actualType && actualType.type) out = {...actualType, type: extractUnit(actualType.type)}
    }
    return out;
}


export const getColonOrPipeCompletionResult = (textBefore: string) => {
    let out = types.map((type: TStructField) => convertToCompletion(type));

    let matchVariable = getLastArrayElement(getDataByRegexp(textBefore, matchRegexp).map(({name}) => name));
    if (matchVariable === 'tx') {
        out = transactionClasses.map(({typeName}: any) => ({label: typeName, kind: CompletionItemKind.Class}));
    } else {
        const type = ctx.defineType('', matchVariable).type;
        if (isUnion(type)) {
            out = type.map(({typeName}: any) => ({label: typeName, kind: CompletionItemKind.Class}));
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


    return getLadderCompletion(ctx, inputWords)
        .filter(({name}) => name === word).map(item => `**${item.name}**: ` + getTypeDoc(item))
        .concat(ctx.variables.filter(({variable}) => variable === word)
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
                row: i + 1
            });
        }
    });
    return declarations;
}



