import {
    TextDocument,
    CompletionItemKind,
    Diagnostic,
    CompletionItem,
    Position,
    Range,
    DiagnosticSeverity,
    CompletionList,
    SignatureHelp
} from 'vscode-languageserver-types';
import { compile } from '@waves/ride-js';
import * as utils from './utils';


export class LspService {
    public validateTextDocument(document: TextDocument): Diagnostic[] {
        let diagnostics: Diagnostic[] = [];
        let resultOrError = compile(document.getText());
        if ('error' in resultOrError) {
            const errorText = resultOrError.error;
            const errRangesRegxp = /\d+-\d+/gm;
            const errorRanges: string[] = errRangesRegxp.exec(errorText) || [];
            const errors = errorRanges.map(offsets => {
                const [start, end] = offsets.split('-').map(offset => document.positionAt(parseInt(offset)));
                const range = Range.create(start, end);
                return {
                    range,
                    severity: DiagnosticSeverity.Error,
                    message: errorText
                }
            });
            diagnostics.push(...errors);
        }
        return diagnostics
    }

    public completion(document: TextDocument, position: Position) {
        const offset = document.offsetAt(position);
        const character = document.getText().substring(offset - 1, offset);
        const textBefore = document.getText({start: {line: 0, character: 0}, end: position});
        const line = document.getText({start: {line: position.line, character: 0}, end: position});

        const caseDeclarations = utils.findCaseDeclarations(textBefore);

        let result: CompletionItem[] = [];

        try {
            let wordBeforeDot = line.match(/([a-zA-z0-9_]+)\.[a-zA-z0-9_]*\b$/);     // get text before dot (ex: [tx].test)

            switch (true) {
                case (character === '.' || wordBeforeDot !== null):                 //auto completion after clicking on a dot
                    let inputWord = (wordBeforeDot === null)                        //get word before dot or last word in line
                        ? (line.match(/\b(\w*)\b\./g) || ['']).pop().slice(0, -1)
                        : wordBeforeDot[1];

                    switch (true) {
                        case (['buyOrder', 'sellOrder'].indexOf(inputWord) > -1):  //ExchangeTransaction:'buyOrder', 'sellOrder'
                            result = utils.getFieldsByType('Order');
                            break;
                        case (['recipient'].indexOf(inputWord) > -1):               //Transfer:'recipient'
                            result = [...utils.getFieldsByType('Address'), ...utils.getFieldsByType('Alias')];
                            break;
                        case (['tx'].indexOf(inputWord) > -1):                      // 'tx'
                            result = utils.getTxFields();
                            break;
                        case (caseDeclarations.lastIndexOf(inputWord) > -1):        //case variable:
                            result = utils.getCaseCompletionResult(textBefore, inputWord, caseDeclarations);
                            break;
                        default:
                            result = utils.getLetCompletionResult(textBefore, inputWord);
                            break;
                    }
                    break;
                //auto completion after clicking on a colon or pipe
                case ([':', '|'].indexOf(character) !== -1 || line.match(/([a-zA-z0-9_]+)[ \t]*[|:][ \t]*[a-zA-z0-9_]*$/) !== null):
                    result = utils.getColonOrPipeCompletionResult(textBefore);
                    break;
                default:
                    result = utils.getCompletionDefaultResult(textBefore);
                    result.push({
                        'label': [...caseDeclarations].pop(),
                        'kind': CompletionItemKind.Variable
                    });
                    break;
            }
        } catch (e) {
            console.error(e)
        }

        return {
            isIncomplete: false,
            items: result
        } as CompletionList
    }

    public static hover(document: TextDocument, position: Position) {
        const line = document.getText().split('\n')[position.line];
        const word = utils.getWordByPos(line, position.character);
        return {contents: utils.getHoverResult(word)};
    }

    public static signatureHelp(document: TextDocument, position: Position): SignatureHelp {

        const offset = document.offsetAt(position);
        const character = document.getText().substring(offset - 1, offset);
        const textBefore = document.getText({start: {line: 0, character: 0}, end: position});

        const lastFunction = (textBefore.match(/\b([a-zA-z0-9_]*)\b[ \t]*\(/g) || ['']).pop(); //get function calls || ''
        const functionArguments = textBefore.split(lastFunction).pop();

        let fail = false;

        if (character === ')' || functionArguments.split(')').length > 1)
            fail = true;

        return {
            activeParameter: fail ? null : functionArguments.split(',').length - 1,
            activeSignature: fail ? null : 0,
            //get result by last function call
            signatures: fail ? null : utils.getSignatureHelpResult((lastFunction.slice(0, -1))),
        };
    }

    public static completionResolve(item: CompletionItem) {
        return item
    }

}

