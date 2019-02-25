import {
    TextDocument, CompletionItemKind, Diagnostic, CompletionItem, Position, Range, DiagnosticSeverity, CompletionList, SignatureHelp
} from "vscode-languageserver-types";
import { transactionClasses, types } from './suggestions/index'
import { compile } from '@waves/ride-js'
import * as utils from './utils'



export class LspService {
    public validateTextDocument(document: TextDocument): Diagnostic[] {
        let diagnostics: Diagnostic[] = []
        let result = compile(document.getText())
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
        const textBefore = document.getText({ start: { line: 0, character: 0 }, end: position })

        const line = document.getText({ start: { line: position.line, character: 0 }, end: position })
        const caseDeclarations = utils.findCaseDeclarations(textBefore);
        const matchDeclarations = utils.findMatchDeclarations(textBefore)
        let result: CompletionItem[] = [];

        try {
            let wordBeforeDot = line.match(/([a-zA-z0-9_]+)\.[a-zA-z0-9_]*\b$/)     // get text before dot (ex: [tx].test)

            switch (true) {
                case (character === '.' || wordBeforeDot !== null):                 //autocompletion after clicking on a dot

                    let inputWord = (wordBeforeDot === null)                        //get word before dot or last word in line
                        ? line.match(/\b(\w*)\b\./g).pop().slice(0, -1)
                        : wordBeforeDot[1];

                    switch (true) {
                        case (['buyOrder', 'sellOrder'].indexOf(inputWord) > -1):
                            result = types['Order'].fields;                         //ExchangeTransaction:'buyOrder', 'sellOrder'
                            break;
                        case (['recipient'].indexOf(inputWord) > -1):               //Transfer:'recipient'
                            result = [...types['Address'].fields, ...types['Alias'].fields];
                            break;
                        case (['tx'].indexOf(inputWord) > -1):                      // 'tx'
                            result = utils.intersection(...transactionClasses.map(val => types[val].fields));
                            break;
                        case (caseDeclarations.lastIndexOf(inputWord) > -1):           //case variable:
                            //get "case" block and search fields in line 
                            let temp = textBefore.match(/\bcase[ \t]*.*/g)
                                .filter(value => !(/\bcase[ \t]*_/g).test(value))[caseDeclarations.lastIndexOf(inputWord)]
                                .match(new RegExp(`\\b${Object.keys(types).join('\\b|\\b')}\\b`, 'g'))
                                .map(value => types[value].fields);
                            result = utils.intersection(...temp);

                            break;
                        default:
                            utils.findLetDeclarations(textBefore).map((val, _, arr) => {
                                if (val.name === inputWord) {
                                    result = types[val.value].fields;
                                    arr.length = 0;
                                }
                            });
                            break;
                    }
                    break;
                //autocompletion after clicking on a colon or pipe
                case ([':', '|'].indexOf(character) !== -1 || line.match(/([a-zA-z0-9_]+)[ \t]*[|:][ \t]*[a-zA-z0-9_]*$/) !== null):
                    ([...matchDeclarations].pop() === 'tx')                         // if match(tx) else match(!tx)
                        ? result = transactionClasses.map(val => ({ label: val, kind: CompletionItemKind.Class }))
                        : result = Object.keys(types).map(val => ({ label: val, kind: CompletionItemKind.Class }));
                    break;
                default:
                    result = utils.getCompletionDefaultResult(textBefore);
                    result.push({
                        "label": [...caseDeclarations].pop(),
                        "kind": CompletionItemKind.Variable
                    })
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

    public hover(document: TextDocument, position: Position) {
        const line = document.getText().split('\n')[position.line];
        const word = utils.getWordByPos(line, position.character);
        return { contents: utils.getHoverResult(word) };
    }

    public signatureHelp(document: TextDocument, position: Position): SignatureHelp {

        const offset = document.offsetAt(position);
        const character = document.getText().substring(offset - 1, offset);
        const textBefore = document.getText({ start: { line: 0, character: 0 }, end: position });

        const lastFunction = (textBefore.match(/\b([a-zA-z0-9_]*)\b[ \t]*\(/g) || [""]).pop(); //get function calls || ""
        const functionArguments = textBefore.split(lastFunction).pop()

        let fail = false

        if (character === ")" || functionArguments.split(')').length > 1)
            fail = true;

        return {
            activeParameter: fail ? null : (functionArguments.split(',').length - 1 || null),
            activeSignature: fail ? null : 0,
            //get result by last function call
            signatures: fail ? null : utils.getSignatureHelpResult((lastFunction.slice(0, -1))),
        };
    }
    public completionResolve(item: CompletionItem) {
        return item
    }

}

