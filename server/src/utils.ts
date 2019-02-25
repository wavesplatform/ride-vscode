import { CompletionItem,CompletionItemKind } from "vscode-languageserver-types";
import { typesRegExp, functions, types, globalVariables, globalSuggestions } from "./suggestions/index"

//=============================================================

export function getCompletionDefaultResult(textBefore:string){
    return [
        // get variables after "let" and globalSuggestions
        ...getDataByRegexp(textBefore, /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm)
            .map(val => ({ label: val.name, kind: CompletionItemKind.Variable })),
        ...globalSuggestions
    ]
}

//=============================================================

export function getSignatureHelpResult(word: string) {
    return (functions[word] !== undefined) ?
        //get label in format: functionName (parameter1, parameter2 ...)
        [{
            label: `${word}(${functions[word].params.map((p: ParamType) => `${p.name}${p.required ? "" : "?"}:` +
                ` ${p.type}`).join(', ')}): ${functions[word].type}`,
            documentation: functions[word].detail,
            parameters: functions[word].params.map((p: ParamType) => ({
                label: `${p.name}${p.required ? "" : "?"}:` +
                    ` ${p.type}`, documentation: p.detail
            }))
        }] :
        [];
}

//=============================================================

export function getHoverResult(word: string) {
    let result = []
    if (functions[word]) {
        result.push(
            `**${word}** (\n
            ${functions[word].params.map((p: ParamType) => `\n * ${`${p.name}${p.required ? "" : "?"}:` +
                ` ${p.type} - ${p.detail}`} \n`)}\n) : ${functions[word].type} \n>_${functions[word].detail}_`
        );
    } else if (types[word]) {
        result.push(types[word].detail)
    } else if (globalVariables[word]) {
        result.push(globalVariables[word].detail)
    }

    return result;
}

//=============================================================


export function intersection(...args: any): CompletionItem[] {
    let out = args[0];
    for (let i = 1; i < args.length; i++) out = intersect(out, args[i])
    return out
}

export function getWordByPos(string: string, character: number) {
    let sep = ['"', '\'', '*', '(', ')', '{', '}', '[', ']', '!', '<', '>', '|', '\\', '/', '.', ',', ':', ';', '&', ' ', '=', '\t']
    let start = 0, end = string.length
    for (let i = character; i <= string.length; i++) {
        if (sep.indexOf(string[i]) > -1) {
            end = i
            break
        }
    }
    for (let i = character; i >= 0; i--) {
        if (sep.indexOf(string[i]) > -1) {
            start = ++i
            break
        }
    }
    return string.substring(start, end)
}

export function findLetDeclarations(text: string): LetDeclarationType[] {
    return [
        //this regexp looks for variables
        ...getDataByRegexp(text, /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm)
    ].filter(val => {
        let match = val.value.match(typesRegExp)
        if (match !== null) {
            val.value = match[0] || ''
            return val
        } else return false
    })
}

export function findMatchDeclarations(text: string) {
    const re = /\bmatch[ \t]*\([ \t]*([a-zA-z0-9_]+)[ \t]*\)/gm;                //this regexp looks for "match" blocks
    const declarations = [];
    let myMatch;
    while ((myMatch = re.exec(text)) !== null) {
        declarations.push(myMatch[1]);
    }
    return declarations;
}

export function findCaseDeclarations(text: string): string[] {
    const re = /\bcase[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*:/gm                   //this regexp looks for "case" blocks
    const declarations: string[] = []
    let myMatch;

    while ((myMatch = re.exec(text)) !== null) {
        declarations.push(myMatch[1])
    }

    return declarations
}

//=============================================================

function getDataByRegexp(text: string, re: RegExp): LetDeclarationType[] {
    const declarations = [];
    let myMatch;
    while ((myMatch = re.exec(text)) !== null) {
        declarations.push({ name: myMatch[1], value: myMatch[2] });
    }
    return declarations;
}

function intersect(a: CompletionItem[], b: CompletionItem[]) {
    let list: string[] = [], out: CompletionItem[] = [];
    a.forEach((val) => list.push(val.label));
    b.forEach(val => (list.indexOf(val.label) > -1) ? out.push(val) : false);
    return out
}

