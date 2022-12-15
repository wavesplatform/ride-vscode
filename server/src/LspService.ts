import {
    CompletionItem,
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
import {
    ICompilationError,
    IParseAndCompileResult,
    parseAndCompile,
    scriptInfo,
    TFunction,
    TStructField
} from '@waves/ride-js';
import suggestions from './suggestions';
import {
    getExpressionType,
    getFuncArgumentOrTypeByPos,
    getFuncHoverByNode,
    getFuncHoverByTFunction,
    getNodeByOffset,
    isIFunc,
    isIFunctionCall,
    isIGetter,
    isILet,
    isIRef,
    isCompileError,
    offsetToRange,
    rangeToOffset, getTypeDoc, isIConstStr
} from './utils/index';
import {getFunctionCallHover} from "./utils/hoverUtils";
import * as complitionUtils from './utils/complitionUtils';

export class LspService {
    ast:  ICompilationError | IParseAndCompileResult | null = null;

    public static TextDocument = TextDocument;

    public validateTextDocument(document: TextDocument, libs: Record<string, string>): Diagnostic[] {
        const text = document.getText();
        try {
            const parsedResult = parseAndCompile(text, 3, undefined, undefined, libs);
            this.ast = parsedResult;
            if (isCompileError(parsedResult)) throw parsedResult.error;
            const info = scriptInfo(text);
            if (info && isCompileError(info)) throw info.error;
            const {stdLibVersion, scriptType, contentType} = info;
            suggestions.updateSuggestions(stdLibVersion, scriptType === 2, contentType === 2);
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


    public completion(document: TextDocument, position: Position) {
        const offset = document.offsetAt(position);
        const text = document.getText();
        const character = text.substring(offset - 1, offset);
        const line = document.getText({start: {line: position.line, character: 0}, end: position});
        const p: {row: number, col: number} = {row: position.line, col: position.character + 1};

        complitionUtils.ctx.updateContext(text);

        let result: CompletionItem[] = [];
        try {
            let wordBeforeDot = line.match(/([a-zA-z0-9_]+)\.[a-zA-z0-9_]*\b$/);     // get text before dot (ex: [tx].test)
            let firstWordMatch = (/([a-zA-z0-9_]+)\.[a-zA-z0-9_.]*$/gm).exec(line) || [];
            switch (true) {
                case (character === '.' || wordBeforeDot !== null):                 //auto completion after clicking on a dot
                    let inputWord = (wordBeforeDot === null)                        //get word before dot or last word in line
                        ? (complitionUtils.getLastArrayElement(line.match(/\b(\w*)\b\./g))).slice(0, -1)
                        : wordBeforeDot[1];

                    //TODO Make fashionable humanly
                    if (firstWordMatch.length >= 2 && complitionUtils.ctx.getVariable(firstWordMatch[1])) {
                        result = [
                            ...complitionUtils.getCompletionResult(firstWordMatch[0].split('.')),
                            ...complitionUtils.checkPostfixFunction(inputWord).map(({name}) => ({label: name}))
                        ];
                    }
                    break;
                //auto completion after clicking on a colon or pipe
                case (line.match(/([a-zA-z0-9_]+)[ \t]*[|:][ \t]*[a-zA-z0-9_]*$/) !== null):
                    result = complitionUtils.getColonOrPipeCompletionResult(text, p);
                    break;
                case (['@'].indexOf(character) !== -1):
                    result = [
                        {label: 'Callable', kind: CompletionItemKind.Interface},
                        {label: 'Verifier', kind: CompletionItemKind.Interface}
                    ];
                    break;
                default:
                    result = complitionUtils.getCompletionDefaultResult(p);
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


    public hover(document: TextDocument, position: Position, libs: Record<string, string>): Hover {
        let contents: MarkupContent | MarkedString | MarkedString[] = [];
        try {
            const text = document.getText();

            const parsedResult = this.ast || parseAndCompile(text, 3, undefined, undefined, libs);
            if (isCompileError(parsedResult)) throw parsedResult.error;
            // @ts-ignore
            const ast = parsedResult.exprAst || parsedResult.dAppAst || parsedResult.ast;
            if (!ast) return {contents: []};
            const cursor = rangeToOffset(position.line, position.character, text);
            const node = getNodeByOffset(ast, cursor);
            // console.log('ast', JSON.stringify(ast, undefined, ' '))
            // console.log('node', JSON.stringify(node, undefined, ' '))
            // console.log('cursor', cursor)

            if (isILet(node)) {
                contents.push(`**${node.name.value}**: ${getExpressionType(node.expr.resultType)}`);
            } else if (isIConstStr(node)) {
                contents.push(`${getExpressionType(node.resultType)}`);
            } else if (isIGetter(node)) {
                contents.push(getExpressionType(node.resultType));
            } else if (isIRef(node)) {
                const refDocs = suggestions.globalVariables
                    .filter(({name, doc}) => node.name === name && doc != null).map(({doc}) => doc);
                const defCtx = node.ctx.find(({name}) => name === node.name);
                if (node.name && node.resultType) {
                    contents.push(`**${node.name}**: ${getExpressionType(node.resultType)}`);
                }
                if (defCtx && !contents.length) {
                    const def = getNodeByOffset(ast, defCtx.posStart);
                    if (isILet(def)) {
                        contents.push(`**${def.name.value}**: ${getExpressionType(def.expr.resultType)}`);
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
                if (findedGlobalFunc.length) {
                    result = getFuncHoverByTFunction(findedGlobalFunc)
                } else if (findedGlobalType) {
                    result = [getTypeDoc(findedGlobalType)]
                } else {
                    result = [getFunctionCallHover(node)]
                }

                contents = [...contents, ...result];
            }
            contents = [...contents];
        } catch (e) {
            console.error('VS-Code Language Service Failed: ', e)
        }
        return {contents};
    }

    public definition(document: TextDocument, {
        line,
        character
    }: Position, libs: Record<string, string>): Definition | null {
        const text = document.getText();
        const parsedResult = this.ast || parseAndCompile(text, 3, undefined, undefined, libs);
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

    public signatureHelp(document: TextDocument, position: Position, libs: Record<string, string>): SignatureHelp {
        const text = document.getText();
        const cursor = rangeToOffset(position.line, position.character, text);

        const parsedResult = parseAndCompile(text, 3, undefined, undefined, libs);
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

