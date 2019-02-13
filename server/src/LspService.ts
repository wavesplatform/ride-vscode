import {
    TextDocument, CompletionItemKind,
    Diagnostic, CompletionItem, Position, Range, DiagnosticSeverity, CompletionList
} from "vscode-languageserver-types";
import { globalSuggestions, txFieldsItems, txTypesItems } from './suggestions'
import { safeCompile } from './safeCompile'
const fieldsMap = require('../src/suggestions/suggestionsData.json');


export class LspService {
    public validateTextDocument(document: TextDocument): Diagnostic[] {
        let diagnostics: Diagnostic[] = []
        let result = safeCompile(document.getText())
        const errorText = result.error
        if (errorText) {
            const errRangesRegxp = /\d+-\d+/gm
            const errorRanges: string[] = errRangesRegxp.exec(errorText) || []
            const errors = errorRanges.map(offsets => {
                const [start, end] = offsets.split('-').map(offset => document.positionAt(parseInt(offset)))
                const range = Range.create(start, end)
                return {
                    range,
                    severity: DiagnosticSeverity.Error,
                    message: errorText
                }
            })
            diagnostics.push(...errors)
        }
        return diagnostics
    }

    public completion(document: TextDocument, position: Position) {
        const offset = document.offsetAt(position)
        const character = document.getText().substring(offset - 1, offset)
        const line = document.getText({ start: { line: position.line, character: 0 }, end: position })
        const textBefore = document.getText({ start: { line: 0, character: 0 }, end: position })
        const caseDeclarations = this.findCaseDeclarations(textBefore);
        const matchDeclarations = this.findMatchDeclarations(textBefore)
        let result: CompletionItem[] = [];

        let tranzactionsClasses = ['Address', 'Alias', 'Transfer', 'DataEntry', 'GenesisTransaction', 'PaymentTransaction'];
        let classes = Object.keys(fieldsMap).filter(val => tranzactionsClasses.indexOf(val) === -1)

        try {
            let wordAfterDot = line.match(/([a-zA-z0-9_]+)\.[a-zA-z0-9_]*\b$/)

            switch (true) {
                case (character === '.' || wordAfterDot !== null): //autocompletion after clicking on a dot
                    let inputWord = (wordAfterDot === null) ? line.match(/\b(\w*)\b\./g).pop().slice(0, -1) : wordAfterDot[1];
                    switch (true) {
                        case (['buyOrder', 'sellOrder'].indexOf(inputWord) > -1): result = fieldsMap['Order']; //ExchangeTransaction:'buyOrder', 'sellOrder'
                            break;
                        case (['recipient'].indexOf(inputWord) > -1): result = [...fieldsMap['Address'], ...fieldsMap['Alias']]; //'recipient'
                            break;
                        case (['tx'].indexOf(inputWord) > -1): result = intersection(...classes.map(val => fieldsMap[val])); // 'tx'
                            break;
                        case ([...caseDeclarations].pop() === inputWord): //case variable
                            let temp = textBefore.match(/\bcase[ \t]*.*/g).pop()
                                .match(/\bcase[ \t]*\b(.+)\b[ \t]*:[ \t]*(.+)[{+=>]/)[2]
                                .match(new RegExp(`\\b${Object.keys(fieldsMap).join('\\b|\\b')}\\b`, 'g'))
                                .map(value => fieldsMap[value]);
                            result = intersection(...temp);
                            break;
                        default:
                            this.findLetDeclarations(textBefore).map((val, _, arr) => {
                                if (val.name === inputWord) {
                                    result = fieldsMap[val.value];
                                    arr.length = 0;
                                }
                            });
                            break;
                    }
                    break;
                case (character === ':' || line.match(/([a-zA-z0-9_]+)\:[a-zA-z0-9_]*\b$/) !== null): //autocompletion after clicking on a dubledot
                    ([...matchDeclarations].pop() === 'tx') ?
                        result = classes.map(val => ({ label: val, kind: CompletionItemKind.Class })) : // if match(tx)
                        result = Object.keys(fieldsMap).map(val => ({ label: val, kind: CompletionItemKind.Class })); //if match(!tx)
                    break;
                default:
                    result = [
                        ...getDataByRegexp(textBefore, /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm)
                            .map(val => ({ label: val.name, kind: CompletionItemKind.Variable })),
                        ...globalSuggestions
                    ];
                    break;
            }
        } catch (e) {
            //   console.error(e) 
        }

        return {
            isIncomplete: false,
            items: result
        } as CompletionList
    }

    public completionResolve(item: CompletionItem) {
        return item
    }

    private findLetDeclarations(text: string): LetDeclarationType[] {
        let rx = new RegExp(`\\b${Object.keys(fieldsMap).join('\\b|\\b')}\\b`, 'g');
        return [
            //...getDataByRegexp(text, /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*:[ \t]*([^\n]+)/gm),
            ...getDataByRegexp(text, /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm)
        ].filter(val => {
            let match = val.value.match(rx)
            if (match !== null) {
                val.value = match[0] || ''
                return val
            } else return false
        })
    }

    private findMatchDeclarations(text: string) {
        const re = /\bmatch[ \t]*\([ \t]*([a-zA-z0-9_]+)[ \t]*\)/gm;
        const declarations = [];
        let myMatch;
        while ((myMatch = re.exec(text)) !== null) {
            declarations.push(myMatch[1]);
        }
        return declarations;
    }

    private findCaseDeclarations(text: string): string[] {
        const re = /\bcase[ \t]+([a-zA-z][a-zA-z0-9_]*):/gm
        const declarations: string[] = []
        let myMatch;

        while ((myMatch = re.exec(text)) !== null) {
            declarations.push(myMatch[1])
        }

        return declarations
    }
}

interface LetDeclarationType {
    name: string
    value: string
}

function intersection(...args: any): CompletionItem[] {
    let out = args[0];
    for (let i = 1; i < args.length; i++) out = intersect(out, args[i])
    return out
}

function intersect(a: CompletionItem[], b: CompletionItem[]) {
    let list: string[] = [], out: CompletionItem[] = [];
    a.forEach((val) => list.push(val.label));
    b.forEach(val => (list.indexOf(val.label) > -1) ? out.push(val) : false);
    return out
}

function getDataByRegexp(text: string, re: RegExp): LetDeclarationType[] {
    const declarations = [];
    let myMatch;
    while ((myMatch = re.exec(text)) !== null) {
        declarations.push({ name: myMatch[1], value: myMatch[2] });
    }
    return declarations;
}