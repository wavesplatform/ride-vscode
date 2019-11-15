"use strict";
exports.__esModule = true;
var vscode_languageserver_types_1 = require("vscode-languageserver-types");
var ride_js_1 = require("@waves/ride-js");
var suggestions_1 = require("./suggestions");
var utils_1 = require("./utils");
var LspService = /** @class */ (function () {
    function LspService() {
    }
    LspService.prototype.validateTextDocument = function (document) {
        var text = document.getText();
        var parsedDoc = ride_js_1.parseAndCompile(text);
        try {
            var info = ride_js_1.scriptInfo(text);
            if ('error' in info)
                throw info.error;
            var stdLibVersion = info.stdLibVersion, scriptType = info.scriptType;
            suggestions_1["default"].updateSuggestions(stdLibVersion, scriptType === 2);
        }
        catch (e) {
            suggestions_1["default"].updateSuggestions();
        }
        return parsedDoc.errorList
            .map(function (_a) {
            var posStart = _a.posStart, posEnd = _a.posEnd, message = _a.msg;
            var start = utils_1.offsetToRange(posStart, text);
            var end = utils_1.offsetToRange(posEnd, text);
            return ({
                range: vscode_languageserver_types_1.Range.create(vscode_languageserver_types_1.Position.create(start.row, start.col), vscode_languageserver_types_1.Position.create(end.row, end.col)),
                severity: vscode_languageserver_types_1.DiagnosticSeverity.Error,
                message: message
            });
        });
    };
    LspService.prototype.completion = function (document, position) {
        // const text = document.getText();
        // const parsedDoc = parseAndCompile(text);
        // getNodeByOffset(parsedDoc.exprAst, rangeToOffset(position.line, position.character, text));
        return [];
    };
    LspService.prototype.hover = function (document, position) {
        var text = document.getText();
        var parsedDoc = ride_js_1.parseAndCompile(text);
        var node = utils_1.getNodeByOffset(parsedDoc.exprAst, utils_1.rangeToOffset(position.line, position.character, text));
        console.error(utils_1.rangeToOffset(position.line, position.character, text), position);
        console.error(node.posStart, utils_1.offsetToRange(node.posStart, text));
        console.error(node.posEnd, utils_1.offsetToRange(node.posEnd, text));
        console.error('---------');
        var contents = [];
        if ('name' in node)
            contents = "" + node.name.value;
        return { contents: contents };
    };
    LspService.prototype.definition = function (document, position) {
        var text = document.getText();
        var parsedDoc = ride_js_1.parseAndCompile(text);
        var node = utils_1.getNodeByOffset(parsedDoc.exprAst, utils_1.rangeToOffset(position.line, position.character, text));
        delete node.ctx;
        console.error(node);
        return null;
    };
    LspService.prototype.signatureHelp = function (document, position) {
        return {
            activeParameter: null,
            activeSignature: null,
            signatures: []
        };
    };
    // public completion(document: TextDocument, position: Position) {
    //     const offset = document.offsetAt(position);
    //     const text = document.getText();
    //     const character = text.substring(offset - 1, offset);
    //     const line = document.getText({start: {line: position.line, character: 0}, end: position});
    //     const p: TPosition = {row: position.line, col: position.character + 1};
    //
    //     utils.ctx.updateContext(text);
    //
    //     let result: CompletionItem[] = [];
    //     try {
    //         let wordBeforeDot = line.match(/([a-zA-z0-9_]+)\.[a-zA-z0-9_]*\b$/);     // get text before dot (ex: [tx].test)
    //         let firstWordMatch = (/([a-zA-z0-9_]+)\.[a-zA-z0-9_.]*$/gm).exec(line) || [];
    //         switch (true) {
    //             case (character === '.' || wordBeforeDot !== null):                 //auto completion after clicking on a dot
    //                 let inputWord = (wordBeforeDot === null)                        //get word before dot or last word in line
    //                     ? (utils.getLastArrayElement(line.match(/\b(\w*)\b\./g))).slice(0, -1)
    //                     : wordBeforeDot[1];
    //
    //                 //TODO Make fashionable humanly
    //                 if (firstWordMatch.length >= 2 && utils.ctx.getVariable(firstWordMatch[1])) {
    //                     result = [
    //                         ...utils.getCompletionResult(firstWordMatch[0].split('.')),
    //                         ...utils.checkPostfixFunction(inputWord).map(({name}) => ({label: name}))
    //                     ];
    //                 }
    //                 break;
    //             //auto completion after clicking on a colon or pipe
    //             case (line.match(/([a-zA-z0-9_]+)[ \t]*[|:][ \t]*[a-zA-z0-9_]*$/) !== null):
    //                 result = utils.getColonOrPipeCompletionResult(text, p);
    //                 break;
    //             case (['@'].indexOf(character) !== -1):
    //                 result = [
    //                     {label: 'Callable', kind: CompletionItemKind.Interface},
    //                     {label: 'Verifier', kind: CompletionItemKind.Interface}
    //                 ];
    //                 break;
    //             default:
    //                 result = utils.getCompletionDefaultResult(p);
    //                 break;
    //         }
    //     } catch (e) {
    //         // console.error(e);
    //     }
    //
    //     return {
    //         isIncomplete: false,
    //         items: result
    //     } as CompletionList;
    // }
    //
    // public hover(document: TextDocument, position: Position) { //todo add hover to func args
    //     const match = (/[a-zA-z0-9_]+\.[a-zA-z0-9_.]*$/gm)
    //         .exec(document.getText({start: {line: position.line, character: 0}, end: position}));
    //     const line = document.getText().split('\n')[position.line];
    //     const word = utils.getWordByPos(line, position.character);
    //     utils.ctx.updateContext(document.getText());
    //     const p: TPosition = {row: position.line, col: position.character + 1};
    //     return {contents: utils.getHoverResult(word, (match ? match[0] : '').split('.'), p)};
    // }
    //
    // public definition(document: TextDocument, position: Position): Definition {
    //
    //     const text = document.getText(),
    //         line = text.split('\n')[position.line],
    //         word = utils.getWordByPos(line, position.character),
    //         {uri} = document,
    //         func = utils.getDataByRegexp(text, /func[ \t]*(.*)\([ \t]*(.*)[ \t]*\)[ \t]*=[ \t]*/g)
    //             .find(({name}) => name === word);
    //
    //     let pos;
    //     if (func && func.namePos && func.row) pos = {line: func.row, character: func.namePos};
    //     else pos = utils.getVarDefinition(word, position);
    //
    //     return pos
    //         ? Location.create(uri, {start: pos, end: {...pos, character: pos.character + word.length}})
    //         : null;
    // }
    //
    // public signatureHelp(document: TextDocument, position: Position): SignatureHelp {
    //
    //     const offset = document.offsetAt(position);
    //     const character = document.getText().substring(offset - 1, offset);
    //
    //     const textBefore = document.getText({start: {line: 0, character: 0}, end: position});
    //     const line = document.getText({start: {line: position.line, character: 0}, end: position});
    //
    //     const isPostfix = /[a-zA-z0-9_]+\.\b([a-zA-z0-9_]+)\b[ \t]*\(/.test(line);
    //
    //     const lastFunction = utils.getLastArrayElement(textBefore.match(/\b([a-zA-z0-9_]*)\b[ \t]*\(/g));
    //     const functionArguments = utils.getLastArrayElement(textBefore.split(lastFunction || ''));
    //
    //     let fail = false;
    //
    //     if (character === ')' || functionArguments.split(')').length > 1)
    //         fail = true;
    //
    //     return {
    //         activeParameter: fail ? null : functionArguments.split(',').length - 1,
    //         activeSignature: fail ? null : 0,
    //         //get result by last function call
    //         signatures: fail ? [] : utils.getSignatureHelpResult(lastFunction.slice(0, -1), isPostfix),
    //     };
    // }
    LspService.prototype.completionResolve = function (item) {
        return item;
    };
    return LspService;
}());
exports.LspService = LspService;
