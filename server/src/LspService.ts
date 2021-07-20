import {
    CompletionItem,
    CompletionItemKind as ItemKind,
    CompletionItemKind,
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
import {IRef, parseAndCompile, scriptInfo} from '@waves/ride-js';
import suggestions from './suggestions';
import {
    convertToCompletion,
    getCompletionDefaultResult,
    getExpressionType,
    getFuncArgumentOrTypeByPos,
    getFuncHoverByNode,
    getFuncHoverByTFunction,
    getNodeByOffset,
    getNodeType,
    getPostfixFunctions,
    intersection,
    isIBlock,
    isIFunc,
    isIFunctionCall,
    isIGetter,
    isILet,
    isIRef,
    isIScript,
    isParseError, isPrimitiveNode,
    offsetToRange,
    rangeToOffset
} from './utils/index';
import {getFunctionCallHover} from "./utils/hoverUtils";


export class LspService {

    public validateTextDocument(document: TextDocument): Diagnostic[] {
        const text = document.getText();
        try {
            const parsedResult = parseAndCompile(text, 3);
            if (isParseError(parsedResult)) throw parsedResult.error;
            const info = scriptInfo(text);
            if ('error' in info) throw info.error;
            const {stdLibVersion, scriptType} = info;
            suggestions.updateSuggestions(stdLibVersion, scriptType === 2);
            return (parsedResult.errorList || [])
                .map(({posStart, posEnd, msg: message}) => {
                    const start = offsetToRange(posStart, text);
                    const end = offsetToRange(posEnd, text);

                    return ({
                        range: Range.create(
                            Position.create(start.line, start.character),
                            Position.create(end.line, end.character)
                        ),
                        severity: DiagnosticSeverity.Error,
                        message: `${message}, start: ${start.line + 1}:${start.character + 1}; len: ${posEnd - posStart}`
                    });
                });
        } catch (e) {
            console.error(e);
        }
        return [];
    }

    public completion(document: TextDocument, position: Position): CompletionItem[] | CompletionList {
        const offset = document.offsetAt(position);
        const text = document.getText();
        const character = text.substring(offset - 1, offset);
        const cursor = rangeToOffset(position.line, position.character, text);
        let items: CompletionItem[] = [];

        const parsedResult = parseAndCompile(text, 3);
        if (isParseError(parsedResult)) throw parsedResult.error;
        const ast = parsedResult.exprAst || parsedResult.dAppAst;
        if (!ast) return [];

        const node = getNodeByOffset(ast, cursor);
        if (character === '@') {
            console.log('wtf')
            items = [
                {label: 'Callable', kind: CompletionItemKind.Interface},
                {label: 'Verifier', kind: CompletionItemKind.Interface}
            ];
        } else if (character === ':') {
            items = suggestions.types.reduce((acc, t) => [...acc, convertToCompletion(t)], new Array())
        } else if (isIBlock(node) && isILet(node.dec)) {
            if (isIGetter(node.dec.expr)) {
                items = getNodeType(node.dec.expr).map((item) => convertToCompletion(item));
            }
            if (isPrimitiveNode(node.dec.expr) && 'type' in node.dec.expr.resultType) {
                items = getPostfixFunctions(node.dec.expr.resultType.type)
                    .map(({name: label, doc: detail}) => ({label, detail, kind: ItemKind.Field}));
            }
            if (isIRef(node.dec.expr)) {
                const refDocs = suggestions.globalVariables
                    .filter(({name, doc}) => (node.dec.expr as IRef).name === name);
                if (refDocs) {
                    items = intersection(refDocs.map(({type}) => type)).map((item) => convertToCompletion(item));
                }
            }
            if ('type' in node.dec.expr.resultType) {
                items = [...items, ...getPostfixFunctions(node.dec.expr.resultType.type)
                    .map(({name: label, doc: detail}) => ({label, detail, kind: ItemKind.Function}))];
            }
        }
        if (items.length === 0 && character != '.') {
            const {ctx} = isIScript(node) ? node.expr : node;
            items = getCompletionDefaultResult(ctx);
        }
        // console.error(items)
        return {isIncomplete: false, items} as CompletionList;
    }

    public hover(document: TextDocument, position: Position): Hover {

        const text = document.getText();
        const range = rangeToOffset(position.line, position.character, document.getText())

        const parsedResult = parseAndCompile(text, 3);
        if (isParseError(parsedResult)) throw parsedResult.error;
        const ast = parsedResult.exprAst || parsedResult.dAppAst;
        // console.log('ast', JSON.stringify(ast))
        if (!ast) return {contents: []};
        const cursor = rangeToOffset(position.line, position.character, text);
        console.log('cursor', cursor)
        const node = getNodeByOffset(ast, cursor);

        console.log('node', JSON.stringify(node))
        let contents: MarkupContent | MarkedString | MarkedString[] = [];

        if (isILet(node)) {
            contents.push(`${node.name.value}: ${getExpressionType(node.expr.resultType)}`);
        } else if (isIGetter(node)) {
            contents.push(getExpressionType(node.resultType));
        } else if (isIRef(node)) {
            const refDocs = suggestions.globalVariables
                .filter(({name, doc}) => node.name === name && doc != null).map(({doc}) => doc);
            const defCtx = node.ctx.find(({name}) => name === node.name);
            if (defCtx) {
                // console.log('defCtx', defCtx)
                const def = getNodeByOffset(ast, defCtx.posStart);
                // console.log('def', def)
                if (isILet(def)) {
                    contents.push(`${def.name.value}: ${getExpressionType(def.expr.resultType)}`);
                }
            }
            // @ts-ignore
            // node.name && node.resultType.type && contents.push(`${node.name}: ${getExpressionType(node.resultType.type)}`)
            contents = [...contents, ...refDocs];
        } else if (isIFunc(node)) {
            // console.log('func', node)
            contents.push(
                getFuncArgumentOrTypeByPos(node, cursor) || getFuncHoverByNode(node)
            );
        } else if (isIFunctionCall(node)) {
            // console.log('functionCall')
            const findedGlobalFunc = suggestions.functions.find(({name}) => node.name.value === name)
            let result = !!findedGlobalFunc ? getFuncHoverByTFunction(findedGlobalFunc) : getFunctionCallHover(node)
            contents = [...contents, result];
        }
        console.log(JSON.stringify(contents))
        contents = [...contents, `line: ${position.line}, character: ${position.character}, position: ${range}, posStart: ${ast.posStart}`];
        return {contents};
    }

    public definition(document: TextDocument, {line, character}: Position): Definition | null{
        const text = document.getText();
        const parsedResult = parseAndCompile(text, 3);
        if (isParseError(parsedResult)) throw parsedResult.error;
        const ast = parsedResult.exprAst || parsedResult.dAppAst;
        if (!ast) return null;

        // console.log('ast', JSON.stringify(ast))
        const node = getNodeByOffset(ast, rangeToOffset(line, character, text));
        // console.log('node', node)
        // console.log('Offset', rangeToOffset(line, character, text))
        if (!node.ctx) return null;
        let nodeName: string | null = null;
        // console.log('node', JSON.stringify(node))
        if (isIRef(node)) nodeName = node.name;
        else if (isIFunctionCall(node)) nodeName = node.name.value;
        // console.log('nodeName', nodeName)
        const def = node.ctx
            .find(({name, posEnd, posStart}) => name === nodeName && posEnd !== -1 && posStart !== -1);
        // console.log('def', def)
        if (def == null) return null;
        const start = offsetToRange(def.posStart + 1, text), end = offsetToRange(def.posEnd, text);
        // console.log('start', start)
        return Location.create(document.uri, {start, end});
    }

    public signatureHelp(document: TextDocument, position: Position): SignatureHelp {
        const text = document.getText();
        const cursor = rangeToOffset(position.line, position.character, text);

        const parsedResult = parseAndCompile(text, 3);
        if (isParseError(parsedResult)) throw parsedResult.error;
        const ast = parsedResult.exprAst || parsedResult.dAppAst;
        let node;
        if (ast) {
            node = getNodeByOffset(ast, cursor);

            // console.log('node', node)
        }

        console.error('s');
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

