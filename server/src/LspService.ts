import {
    CompletionItem,
    CompletionItemKind as ItemKind,
    CompletionItemKind,
    CompletionList,
    Definition,
    Diagnostic,
    DiagnosticSeverity,
    Hover, InsertTextFormat,
    Location,
    MarkedString,
    MarkupContent,
    Position,
    Range,
    SignatureHelp,
    TextDocument
} from 'vscode-languageserver-types';
import {IRef, parseAndCompile, scriptInfo, TFunction, TStructField} from '@waves/ride-js';
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
    isCompileError,
    isPrimitiveNode,
    offsetToRange,
    rangeToOffset, getTypeDoc
} from './utils/index';
import {getFunctionCallHover, getWordByPos} from "./utils/hoverUtils";
import * as jsonSuggestions from './suggestions/suggestions.json';

export class LspService {

    public validateTextDocument(document: TextDocument, lastChangedSymbol?: number | undefined): Diagnostic[] {
        const text = document.getText();
        try {
            const parsedResult = parseAndCompile(text, 3, lastChangedSymbol);
            if (isCompileError(parsedResult)) throw parsedResult.error;
            const info = scriptInfo(text);
            if (info && isCompileError(info)) throw info.error;
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
        if (isCompileError(parsedResult)) throw parsedResult.error;
        const ast = parsedResult.exprAst || parsedResult.dAppAst;
        if (!ast) return [];

        const node = getNodeByOffset(ast, cursor);
        if (character === '@') {
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

        // const lastWord = getWordByPos(text, cursor)
        // const snippet = jsonSuggestions.snippets.find(({ label }) => label === lastWord)
        //
        // if (snippet) {
        //     const {label, insertText} = snippet
        //     items.push({label, insertText, kind: ItemKind.Function, insertTextFormat: InsertTextFormat.Snippet})
        // }

        const obj = {} as any
        items.forEach(function (d) {
            if (!obj[d.label]) {
                obj[d.label] = {label: d.label, kind: d.kind, detail: d.detail}
            }
        })
        items = Object.values(obj);

        return {isIncomplete: false, items} as CompletionList;
    }

    public hover(document: TextDocument, position: Position): Hover {

        const text = document.getText();
        const range = rangeToOffset(position.line, position.character, document.getText())
        const parsedResult = parseAndCompile(text, 3);

        if (isCompileError(parsedResult)) throw parsedResult.error;

        const ast = parsedResult.exprAst || parsedResult.dAppAst;
        if (!ast) return {contents: []};
        const cursor = rangeToOffset(position.line, position.character, text);

        const node = getNodeByOffset(ast, cursor);
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
                const def = getNodeByOffset(ast, defCtx.posStart);
                if (isILet(def)) {
                    contents.push(`${def.name.value}: ${getExpressionType(def.expr.resultType)}`);
                }
                if (isIFunc(def)) {
                    contents.push(
                        getFuncArgumentOrTypeByPos(def, cursor) || getFuncHoverByNode(def)
                    );
                }
            }
            contents = [...contents, ...refDocs];
        } else if (isIFunc(node)) {
            contents.push(
                getFuncArgumentOrTypeByPos(node, cursor) || getFuncHoverByNode(node)
            );
        } else if (isIFunctionCall(node)) {
            const findedGlobalFunc = suggestions.functions.filter(({name}) => node.name.value === name)
            const findedGlobalType = suggestions.types.find(({name}) => node.name.value === name)

            let result
            if(findedGlobalFunc.length) {
                result = getFuncHoverByTFunction(findedGlobalFunc)
            } else if (findedGlobalType) {
                result = [getTypeDoc(findedGlobalType)]
            } else {
                result = [getFunctionCallHover(node)]
            }

            contents = [...contents, ...result];
        }
        contents = [...contents, `line: ${position.line}, character: ${position.character}, position: ${range}, posStart: ${ast.posStart}`];
        return {contents};
    }

    public definition(document: TextDocument, {line, character}: Position): Definition | null {
        const text = document.getText();
        const parsedResult = parseAndCompile(text, 3);
        if (isCompileError(parsedResult)) throw parsedResult.error;
        const ast = parsedResult.exprAst || parsedResult.dAppAst;
        if (!ast) return null;
        const node = getNodeByOffset(ast, rangeToOffset(line, character, text));
        if (!node.ctx) return null;
        let nodeName: string | null = null;
        if (isIRef(node)) nodeName = node.name;
        else if (isIFunctionCall(node)) nodeName = node.name.value;
        const def = node.ctx
            .find(({name, posEnd, posStart}) => name === nodeName && posEnd !== -1 && posStart !== -1);
        if (def == null) return null;
        const start = offsetToRange(def.posStart + 1, text), end = offsetToRange(def.posEnd, text);
        return Location.create(document.uri, {start, end});
    }

    public signatureHelp(document: TextDocument, position: Position): SignatureHelp {
        const text = document.getText();
        const cursor = rangeToOffset(position.line, position.character, text);

        const parsedResult = parseAndCompile(text, 3);
        if (isCompileError(parsedResult)) throw parsedResult.error;
        const ast = parsedResult.exprAst || parsedResult.dAppAst;
        // @ts-ignore
        const node = getNodeByOffset(ast, cursor);

        const func = suggestions.functions.find(x => x.name === (node as any).name.value)
            || suggestions.types.find(x => x.name === (node as any).name.value)

        let args

        if (!!func) {
            if ((func as TFunction).args) {
                args = (func as TFunction).args.reduce((acc, x) => [...acc, {label: x.name}], [] as any)
            }
            // @ts-ignore
            if ((func as TStructField).type.fields) {
                // @ts-ignore
                args = (func as TStructField).type.fields.reduce((acc, x) => [...acc, {label: x.name}], [] as any)
            }
        }

        return {
            activeParameter: null,
            activeSignature: null,
            signatures: args
        };
    }

    public completionResolve(item: CompletionItem) {
        return item;
    }
}

