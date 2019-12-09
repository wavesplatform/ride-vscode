import {
    CompletionItem,
    CompletionList,
    Definition,
    Diagnostic,
    DiagnosticSeverity,
    Hover,
    Location,
    MarkedString,
    MarkupContent,
    Position,
    Range,
    SignatureHelp,
    TextDocument
} from 'vscode-languageserver-types';
import { IFunc, parseAndCompile, scriptInfo, TFunction } from '@waves/ride-js';
import suggestions from "./suggestions";
import {
    getNodeByOffset,
    getNodeDefinitionByName,
    isIFunc,
    isIFunctionCall,
    isIGetter,
    isILet,
    isIRef,
    offsetToRange,
    rangeToOffset
} from "./utils";

export class LspService {

    public validateTextDocument(document: TextDocument): Diagnostic[] {
        const text = document.getText();
        const parsedDoc = parseAndCompile(text);
        try {
            const info = scriptInfo(text);
            if ('error' in info) throw info.error;
            const {stdLibVersion, scriptType} = info;
            suggestions.updateSuggestions(stdLibVersion, scriptType === 2);
        } catch (e) {
            suggestions.updateSuggestions();
        }
        return parsedDoc.errorList
            .map(({posStart, posEnd, msg: message}) => {
                const start = offsetToRange(posStart, text);
                const end = offsetToRange(posEnd, text);

                return ({
                    range: Range.create(
                        Position.create(start.line, start.character),
                        Position.create(end.line, end.character)
                    ),
                    severity: DiagnosticSeverity.Error,
                    message
                })
            });
    }

    public completion(document: TextDocument, position: Position): CompletionItem[] | CompletionList {
        const text = document.getText();
        const parsedDoc = parseAndCompile(text);
        getNodeByOffset(parsedDoc.exprAst, rangeToOffset(position.line, position.character, text));
        return []
    }

    public hover(document: TextDocument, position: Position): Hover {
        const text = document.getText();
        const parsedDoc = parseAndCompile(text);
        const node = getNodeByOffset(parsedDoc.exprAst, rangeToOffset(position.line, position.character, text));

        const getFuncHoverByNode = (n: IFunc) => `${n.name.value}(${n.argList.map(({argName: {value}, typeList}) =>
            `${value}: ${typeList.map(({typeName: {value}}) => value).join('|')}`).join(', ')}): ${n.expr.resultType}`;
        const getFuncHoverByTFunction = (f: TFunction)=> `${f.name}(${f.args.map(({name, type}) =>
            `${name}: ${type}`).join(', ')}): ${f.resultType}`;

        let contents: MarkupContent | MarkedString | MarkedString[] = [];

        if (isILet(node)) {
            contents.push(`${node.name.value}: ${node.expr.resultType}`)
        } else if (isIGetter(node)) {
            contents.push(node.resultType)
        } else if (isIRef(node)) {
            contents.push(`${node.name}: ${node.resultType}`)
        } else if (isIFunc(node)) {
            contents.push(getFuncHoverByNode(node))
        } else if (isIFunctionCall(node)) {
            const def = getNodeDefinitionByName(parsedDoc.exprAst, node.name.value, node.posStart);
            if (isIFunc(def)) contents.push(getFuncHoverByNode(def))
            if (def === null) {
                const funcs = suggestions.functions.filter(({name}) => name === node.name.value);
                contents = [...contents, ...funcs.map(f => getFuncHoverByTFunction(f))]
            }
        } else {
        }
        return {contents};
    }

    public definition(document: TextDocument, {line, character}: Position): Definition {
        const text = document.getText();
        const {exprAst: parsedDoc} = parseAndCompile(text);
        const node = getNodeByOffset(parsedDoc, rangeToOffset(line, character, text));
        let def = null;
        if (isIRef(node))
            def = getNodeDefinitionByName(parsedDoc, node.name, rangeToOffset(line, character, text));
        else if (isIFunctionCall(node)) {
            def = getNodeDefinitionByName(parsedDoc, node.name.value, rangeToOffset(line, character, text));
        }
        if (def == null) return null;
        const start = offsetToRange(def.posStart, text), end = offsetToRange(def.posEnd, text);
        return Location.create(document.uri, {start, end})
    }

    public signatureHelp(document: TextDocument, position: Position): SignatureHelp {
        return {
            activeParameter: null,
            activeSignature: null,
            signatures: []
        };
    }


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

    public completionResolve(item: CompletionItem) {
        return item;
    }

}

