import {
    getExpressionType,
    getFuncArgumentOrTypeByPos,
    getFuncHoverByNode,
    getFuncHoverByTFunction,
    getTypeDoc,
    validateByPos
} from './hoverUtils';
import {
    convertToCompletion,
    getCompletionDefaultResult,
    getNodeType,
    getPostfixFunctions,
    intersection
} from './completionUtils';
import {getFunctionDefinition} from './definitionUtils';
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
    IParseAndCompileResult,
    IRef,
    IScript, IScriptInfo,
    ITrue,
    TDecl,
    TExpr,
    TNode,
    TPrimitiveNode
} from '@waves/ride-js';
import {performance} from "perf_hooks";


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
export const isIFunc = (node: TNode | null): node is IFunc => node != null && node.type === 'FUNC';
export const isIScript = (node: TNode | null): node is IScript => node != null && node.type === 'SCRIPT';
export const isIDApp = (node: TNode | null): node is IDApp => node != null && node.type === 'DAPP';
export const isIAnnotatedFunc = (node: TNode | null): node is IAnnotatedFunc => node != null && node.type === 'ANNOTATEDFUNC';
export const isIAnnotation = (node: TNode | null): node is IAnnotation => node != null && node.type === 'ANNOTATION';
export const isCompileError = (res: IParseAndCompileResult | IScriptInfo | ICompilationError): res is ICompilationError => 'error' in res;
export const isPrimitiveNode = (node: TNode): node is TPrimitiveNode => isIConstStr(node) || isIConstByteStr(node) || isIConstLong(node) || isITrue(node) || isIFalse(node)

const findNodeByFunc = (node: TNode, f: (node: TNode) => TNode | null): TNode | null => {
    if (isIDApp(node)) {
        // console.log("isIDApp")
        return node.decList.find(dec => f(dec) != null) || node.annFuncList.find(node => f(node) != null) || null;
    } else if (isIAnnotatedFunc(node)) {
        return f(node.func) || node.annList.find(annotation => f(annotation) != null) || null
    } else if (isIBlock(node)) {
        // console.log("isIBlock")
        return (f(node.body)) || f(node.dec);
    } else if (isIDApp(node)) {
        return node.decList.find(node => f(node) != null) || node.annFuncList.find(node => f(node) != null) || null;
    } else if (isILet(node)) {
        // console.log("isILet")
        return f(node.expr)
    } else if (isIFunc(node) || isIScript(node)) {
        // console.log("isIFunc || isIScript")
        return f(node.expr)
    } else if (isIIf(node)) {
        console.log("isIIf")
        return f(node.ifTrue) || f(node.cond) || f(node.ifFalse);
    } else if (isIFunctionCall(node)) {
        // console.log("isIFunctionCall")
        const findedNode = node.args.find(node => f(node) != null && !(isIRef(node) && node.name.startsWith('$match')))
        // @ts-ignore
        // if (findedNode && "name" in findedNode && findedNode.name && (findedNode.name.value || findedNode.name as unknown as string).startsWith('$match')) {
        //     console.log('true')
        //     return null
        // } else
            return findedNode || null
    } else if (isIGetter(node)) {
        // console.log("isIGetter")
        return f(node.ref);
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
    const position = Array.from({length: line}, (_, i) => i)
        .reduce((acc, i) => acc + split[i].length + 1, 0) + character
    return line !== 0 ? position + 1 : position
}


export function getNodeByOffset(node: TNode, pos: number): TNode {
    const validateNodeByPos = (node: TNode, pos: number) => (node: TNode): TNode | null => {
        return (node.posStart <= pos && node.posEnd >= pos) ? node : null;
    }

    const goodChild = findNodeByFunc(node, validateNodeByPos(node, pos));
    return (goodChild) ? getNodeByOffset(goodChild, pos) : node;
}

export function findAnnotatedFunc(funcList: any[], pos: number): any {
    return Array.isArray(funcList) ? funcList.find(i => (i.posStart <= pos) && (i.posEnd >= pos)) : null
}

export function getConstantsFromFunction(funcNode: IFunc): TDecl[] {
    const result = [] as TDecl[]
    const recursiveFunc = (node: TExpr) => {
        if (isIBlock(node)) {
            result.push(node.dec)
            recursiveFunc(node.body)
        }
    }
    recursiveFunc(funcNode.expr)
    return result
}

export function getSelectedConst(constants: TDecl[], position: number): TDecl | undefined {
    const validateNodeByPos = (node: TDecl, pos: number): boolean => !!node && !!node.posStart && pos >= node.posStart && pos <= node.posEnd
    return constants.find(node => {
        return validateNodeByPos(node, position)
    })
}

export const getLastArrayElement = (arr: string[] | null): string => arr !== null ? [...arr].pop() || '' : '';