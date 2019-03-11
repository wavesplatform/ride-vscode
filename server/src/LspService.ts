import {
    TextDocument,
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
                };
            });
            diagnostics.push(...errors);
        }
        return diagnostics;
    }

    public completion(document: TextDocument, position: Position) {

        const offset = document.offsetAt(position);
        const character = document.getText().substring(offset - 1, offset);
        const textBefore = document.getText({start: {line: 0, character: 0}, end: position});
        const line = document.getText({start: {line: position.line, character: 0}, end: position});
        const variablesDeclarations = utils.findDeclarations(textBefore);
        let result: CompletionItem[] = [];

        try {
            let wordBeforeDot = line.match(/([a-zA-z0-9_]+)\.[a-zA-z0-9_]*\b$/);     // get text before dot (ex: [tx].test)
            let firstWordMatch = (/([a-zA-z0-9_]+)\.[a-zA-z0-9_.]*$/gm).exec(line) as string[] || [];
            switch (true) {
                case (character === '.' || wordBeforeDot !== null):                 //auto completion after clicking on a dot
                    let inputWord = (wordBeforeDot === null)                        //get word before dot or last word in line
                    ? (utils.getLastArrayElement(line.match(/\b(\w*)\b\./g) )).slice(0, -1)
                        : wordBeforeDot[1];

                        if (['tx'].indexOf(inputWord) > -1) //todo add after completion
                            result = utils.txFields;
                        else if (firstWordMatch.length >= 2 && variablesDeclarations.filter(({variable}) => variable === firstWordMatch[1]).length > 0)
                            result = utils.getCompletionResult((firstWordMatch[0] as string).split('.'), variablesDeclarations);
                    break;
                //auto completion after clicking on a colon or pipe
                case ([':', '|'].indexOf(character) !== -1 || line.match(/([a-zA-z0-9_]+)[ \t]*[|:][ \t]*[a-zA-z0-9_]*$/) !== null):
                    result = utils.getColonOrPipeCompletionResult(textBefore);
                    break;
                    //todo add completion after ] in lists
                default:
                    result = utils.getCompletionDefaultResult(textBefore);
                    break;
            }
        } catch (e) {
             // console.error(e);
        }

        return {
            isIncomplete: false,
            items: result
        } as CompletionList;
    }

    public hover(document: TextDocument, position: Position) { //todo add hover to func args
        const match = (/[a-zA-z0-9_]+\.[a-zA-z0-9_.]*$/gm)
            .exec(document.getText({start: {line: position.line, character: 0}, end: position}));
        const line = document.getText().split('\n')[position.line];
        const word = utils.getWordByPos(line, position.character);
        return {contents: utils.getHoverResult(document.getText(), word, (match ? match[0] : '').split('.'))};
    }

    public signatureHelp(document: TextDocument, position: Position): SignatureHelp {

        const offset = document.offsetAt(position);
        const character = document.getText().substring(offset - 1, offset);
        const textBefore = document.getText({start: {line: 0, character: 0}, end: position});
        
        const lastFunction = utils.getLastArrayElement(textBefore.match(/\b([a-zA-z0-9_]*)\b[ \t]*\(/g));
        const functionArguments = utils.getLastArrayElement(textBefore.split(lastFunction || ''));

        let fail = false;

        if (character === ')' || functionArguments.split(')').length > 1)
            fail = true;

        return {
            activeParameter: fail ? null : functionArguments.split(',').length - 1,
            activeSignature: fail ? null : 0,
            //get result by last function call
            signatures: fail ? [] : utils.getSignatureHelpResult((lastFunction.slice(0, -1))),
        };
    }

    public completionResolve(item: CompletionItem) {
        return item;
    }

}

