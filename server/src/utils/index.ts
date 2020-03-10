
import { getFuncArgumentOrTypeByPos, getTypeDoc, validateByPos, getFuncHoverByNode, getFuncHoverByTFunction, getExpressionType } from './hoverUtils';
import { getPostfixFunctions, getCompletionDefaultResult, convertToCompletion, intersection, getNodeType } from './completionUtils';
import { getFunctionDefinition } from './definitionUtils';
import {
    IAnnotatedFunc,
    IAnnotation,
    IBlock,
    ICompilationError,
    IConstByteStr,
    IConstLong,
    IConstStr,
    IDApp,
    IFalse,
    IFunc,
    IFunctionCall,
    IGetter,
    IIf,
    ILet,
    IMatch,
    IMatchCase,
    IParseAndCompileResult,
    IRef,
    IScript,
    ITrue,
    TNode,
    TPrimitiveNode
} from '@waves/ride-js';


export {
    getNodeType,
    getFunctionDefinition,

    getPostfixFunctions,
    getCompletionDefaultResult,
    convertToCompletion,
    intersection,

    getFuncArgumentOrTypeByPos,
    validateByPos,
    getFuncHoverByNode,
    getFuncHoverByTFunction,
    getTypeDoc,
    getExpressionType,
};


export const isIConstByteStr = (node: TNode | null): node is IConstByteStr => node != null && node.type === 'CONST_BYTESTR';
export const isIConstLong = (node: TNode | null): node is IConstLong => node != null && node.type === 'CONST_LONG';
export const isIConstStr = (node: TNode | null): node is IConstStr => node != null && node.type === 'CONST_STRING';
export const isITrue = (node: TNode | null): node is ITrue => node != null && node.type === 'TRUE';
export const isIFalse = (node: TNode | null): node is IFalse => node != null && node.type === 'FALSE';
export const isIRef = (node: TNode | null): node is IRef => node != null && node.type === 'REF';
export const isIBlock = (node: TNode | null): node is IBlock => node != null && node.type === 'BLOCK';
export const isILet = (node: TNode | null): node is ILet => node != null && node.type === 'LET';
export const isIIf = (node: TNode | null): node is IIf => node != null && node.type === 'IF';
export const isIFunctionCall = (node: TNode | null): node is IFunctionCall => node != null && node.type === 'FUNCTION_CALL';
export const isIGetter = (node: TNode | null): node is IGetter => node != null && node.type === 'GETTER';
export const isIMatch = (node: TNode | null): node is IMatch => node != null && node.type === 'MATCH';
export const isIMatchCase = (node: TNode | null): node is IMatchCase => node != null && node.type === 'MATCH_CASE';
export const isIFunc = (node: TNode | null): node is IFunc => node != null && node.type === 'FUNC';
export const isIScript = (node: TNode | null): node is IScript => node != null && node.type === 'SCRIPT';
export const isIDApp = (node: TNode | null): node is IDApp => node != null && node.type === 'DAPP';
export const isIAnnotatedFunc = (node: TNode | null): node is IAnnotatedFunc => node != null && node.type === 'ANNOTATEDFUNC';
export const isIAnnotation = (node: TNode | null): node is IAnnotation => node != null && node.type === 'ANNOTATION';
export const isParseError = (res: IParseAndCompileResult | ICompilationError): res is ICompilationError => 'error' in res;
export const isPrimitiveNode = (node: TNode): node is TPrimitiveNode => isIConstStr(node) || isIConstByteStr(node) || isIConstLong(node)|| isITrue(node)|| isIFalse(node)

const findNodeByFunc = (node: TNode, f: (node: TNode) => TNode | null): TNode | null => {
    if (isIBlock(node)) {
        return f(node.body) || f(node.dec);
    } else if (isIDApp(node)) {
        return node.decList.find(node => f(node) != null) || null;
    } else if (isIAnnotatedFunc(node)) {
        return f(node.func);
    } else if (isILet(node) || isIMatch(node) || isIMatchCase(node) || isIFunc(node) || isIScript(node)) {
        return f(node.expr);
    } else if (isIIf(node)) {
        return f(node.cond) || f(node.ifTrue) || f(node.ifFalse);
    } else if (isIFunctionCall(node)) {
        return node.args.find(node => f(node) != null) || null;
    } else if (isIGetter(node)) {
        return f(node.ref);
    } else if (isIMatch(node)) {
        return node.cases.find(node => f(node) != null) || null;
    } else {
        return null;
    }
};


export function offsetToRange(startOffset: number, content: string): { line: number, character: number } {
    const sliced = content.slice(0, startOffset).split('\n');
    const line = sliced.length - 1, character = sliced[line].length === 0 ? 0 : sliced[line].length - 1;
    return {line, character};
}

export function rangeToOffset(line: number, character: number, content: string): number {
    const split = content.split('\n');
    return Array.from({length: line}, (_, i) => i)
        .reduce((acc, i) => acc + split[i].length + 1, 0) + character + 1;
}


export function getNodeByOffset(node: TNode, pos: number): TNode {

    const validateNodeByPos = (pos: number) => (node: TNode): TNode | null =>
        (node.posStart <= pos && node.posEnd >= pos) ? node : null;

    const goodChild = findNodeByFunc(node, validateNodeByPos(pos));
    return (goodChild) ? getNodeByOffset(goodChild, pos) : node;
}

