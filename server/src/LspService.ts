import {
    TextDocument, CompletionItemKind,
    Diagnostic, CompletionItem, Position, Range, DiagnosticSeverity, CompletionList
} from "vscode-languageserver-types";
import { globalSuggestions, txFieldsItems, txTypesItems } from './suggestions'
import { safeCompile } from './safeCompile'
const fieldsMap = require('../src/adds/addFieldsObject.json');


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

        try {
            if (character === '.') {
                let inputString = line.match(/\b(\w*)\b\./g).pop().slice(0, -1);

                if (['buyOrder', 'sellOrder'].indexOf(inputString) > -1) {
                    result = fieldsMap['Order']
                } else if (['recipient'].indexOf(inputString) > -1) {
                    result = [...fieldsMap['Address'], ...fieldsMap['Alias']]
                } else if (['tx'].indexOf(inputString) > -1) {
                    let cutout = ['Address', 'Alias', 'Transfer', 'DataEntry', 'GenesisTransaction', 'PaymentTransaction'];//'Order',
                    let temp: CompletionItem[] = [];
                    for (let i in fieldsMap) (cutout.indexOf(i) > -1) ? false : temp.push(fieldsMap[i]);
                    result = intersection(...temp)
                } else if ([...caseDeclarations].pop() === inputString) {
                    let temp: CompletionItem[] = [];
                    let rx = new RegExp(`\\b${Object.keys(fieldsMap).join('\\b|\\b')}\\b`, 'g');
                    textBefore.match(/\bcase[ \t]*.*/g).pop()
                        .match(/\bcase[ \t]*\b(.+)\b[ \t]*:[ \t]*(.+)[{+=>]/)[2].match(rx)
                        .map(value => temp.push(fieldsMap[value]))
                    result = intersection(...temp)
                } else {
                    this.findLetDeclarations(textBefore)
                        .map((val, _, arr) => {
                            if (val.name === inputString) {
                                result = fieldsMap[val.value]
                                arr.length = 0
                            }
                        })
                }

            } else if (character === ':') {
                if ([...matchDeclarations].pop() === 'tx') {
                    let cutout = ['Address', 'Alias', 'Transfer', 'DataEntry', 'GenesisTransaction', 'PaymentTransaction']; //'Order',

                    for (let temp in fieldsMap) {
                        if (cutout.indexOf(temp) === -1) {
                            result.push({ label: temp, kind: CompletionItemKind.Class });
                        }
                    }
                } else {
                    for (let temp in fieldsMap) {
                        result.push({ label: temp, kind: CompletionItemKind.Class })
                    }
                }
            } else {
                result = [
                    ...getDataByRegexp(textBefore, /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm)
                        .map(val => ({ label: val.name, kind: CompletionItemKind.Variable })),
                    ...globalSuggestions,
                    ...fieldsMap['tx']
                ]
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