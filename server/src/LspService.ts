import {
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    Definition,
    Diagnostic,
    DiagnosticSeverity,
    Location,
    Position,
    Range,
    SignatureHelp,
    TextDocument
} from 'vscode-languageserver-types';
import { compile, scriptInfo } from '@waves/ride-js';
import * as utils from './utils';
import { suggestions, TPosition } from "./context";

export class LspService {
    public validateTextDocument(document: TextDocument): Diagnostic[] {
        try {
            const info = scriptInfo(document.getText());
            if ('error' in info) throw info.error;
            const {stdLibVersion, scriptType} = info;
            suggestions.updateSuggestions(stdLibVersion, scriptType === 2);
        } catch (e) {
            suggestions.updateSuggestions();
        }

        let diagnostics: Diagnostic[] = [];
        let resultOrError = compile(document.getText());
        if ('error' in resultOrError) {
            const errorText = resultOrError.error;
            const errRangesRegxp = /\d+-\d+/gm;
            const errorRanges: string[] = errRangesRegxp.exec(errorText) || [];
            if (errorRanges.length > 0) {
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
            } else {
                const parsingErrRegexp = /:(\d+):(\d+) ...".*"\)$/gm;
                const parsingErrorRanges: string[] = parsingErrRegexp.exec(errorText) || [];
                if (!isNaN(+parsingErrorRanges[1]) && !isNaN(+parsingErrorRanges[2])) {
                    diagnostics.push({
                        range: Range.create(
                            Position.create(+parsingErrorRanges[1] - 1, +parsingErrorRanges[2] - 1),
                            Position.create(+parsingErrorRanges[1] - 1, +parsingErrorRanges[2] - 1)
                        ),
                        severity: DiagnosticSeverity.Error,
                        message: `Parsing error: ${errorText}`
                    });
                } else {
                    diagnostics.push({
                        range: Range.create(
                            Position.create(0, 0),
                            Position.create(0, 0)
                        ),
                        severity: DiagnosticSeverity.Error,
                        message: errorText
                    });
                }
            }

        }
        return diagnostics;
    }

    public completion(document: TextDocument, position: Position) {
        const offset = document.offsetAt(position);
        const text = document.getText();
        const character = text.substring(offset - 1, offset);
        const line = document.getText({start: {line: position.line, character: 0}, end: position});
        const p: TPosition = {row: position.line, col: position.character + 1};

        utils.ctx.updateContext(text);

        let result: CompletionItem[] = [];
        try {
            let wordBeforeDot = line.match(/([a-zA-z0-9_]+)\.[a-zA-z0-9_]*\b$/);     // get text before dot (ex: [tx].test)
            let firstWordMatch = (/([a-zA-z0-9_]+)\.[a-zA-z0-9_.]*$/gm).exec(line) || [];
            switch (true) {
                case (character === '.' || wordBeforeDot !== null):                 //auto completion after clicking on a dot
                    let inputWord = (wordBeforeDot === null)                        //get word before dot or last word in line
                        ? (utils.getLastArrayElement(line.match(/\b(\w*)\b\./g))).slice(0, -1)
                        : wordBeforeDot[1];

                    //TODO Make fashionable humanly
                    if (firstWordMatch.length >= 2 && utils.ctx.getVariable(firstWordMatch[1])) {
                        result = [
                            ...utils.getCompletionResult(firstWordMatch[0].split('.')),
                            ...utils.checkPostfixFunction(inputWord).map(({name}) => ({label: name}))
                        ];
                    }
                    break;
                //auto completion after clicking on a colon or pipe
                case (line.match(/([a-zA-z0-9_]+)[ \t]*[|:][ \t]*[a-zA-z0-9_]*$/) !== null):
                    result = utils.getColonOrPipeCompletionResult(text, p);
                    break;
                case (['@'].indexOf(character) !== -1):
                    result = [
                        {label: 'Callable', kind: CompletionItemKind.Interface},
                        {label: 'Verifier', kind: CompletionItemKind.Interface}
                    ];
                    break;
                default:
                    result = utils.getCompletionDefaultResult(p);
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
        utils.ctx.updateContext(document.getText());
        const p: TPosition = {row: position.line, col: position.character + 1};
        return {contents: utils.getHoverResult(word, (match ? match[0] : '').split('.'), p)};
    }

    public definition(document: TextDocument, position: Position): Definition {

        const text = document.getText(),
            line = text.split('\n')[position.line],
            word = utils.getWordByPos(line, position.character),
            {uri} = document,
            func = utils.getDataByRegexp(text, /func[ \t]*(.*)\([ \t]*(.*)[ \t]*\)[ \t]*=[ \t]*{/g)
                .find(({name}) => name === word);

        let pos;
        if (func && func.namePos && func.row) pos = {line: func.row, character: func.namePos};
        else pos = utils.getVarDefinition(word, position);

        return pos
            ? Location.create(uri, {start: pos, end: {...pos, character: pos.character + word.length}})
            : null;
    }

    public signatureHelp(document: TextDocument, position: Position): SignatureHelp {

        const offset = document.offsetAt(position);
        const character = document.getText().substring(offset - 1, offset);

        const textBefore = document.getText({start: {line: 0, character: 0}, end: position});
        const line = document.getText({start: {line: position.line, character: 0}, end: position});

        const isPostfix = /[a-zA-z0-9_]+\.\b([a-zA-z0-9_]+)\b[ \t]*\(/.test(line);

        const lastFunction = utils.getLastArrayElement(textBefore.match(/\b([a-zA-z0-9_]*)\b[ \t]*\(/g));
        const functionArguments = utils.getLastArrayElement(textBefore.split(lastFunction || ''));

        let fail = false;

        if (character === ')' || functionArguments.split(')').length > 1)
            fail = true;

        return {
            activeParameter: fail ? null : functionArguments.split(',').length - 1,
            activeSignature: fail ? null : 0,
            //get result by last function call
            signatures: fail ? [] : utils.getSignatureHelpResult(lastFunction.slice(0, -1), isPostfix),
        };
    }

    public completionResolve(item: CompletionItem) {
        return item;
    }

}

