import {
    IBlock,
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
    IRef,
    IScript,
    ITrue,
    TNode
} from "@waves/ride-js";

export const isIConstByteStr = (node: TNode): node is IConstByteStr => node.type === "CONST_BYTESTR";
export const isIConstLong = (node: TNode): node is IConstLong => node.type === "CONST_LONG";
export const isIConstStr = (node: TNode): node is IConstStr => node.type === "CONST_STRING";
export const isITrue = (node: TNode): node is ITrue => node.type === "TRUE";
export const isIFalse = (node: TNode): node is IFalse => node.type === "FALSE";
export const isIRef = (node: TNode): node is IRef => node.type === "REF";

export const isIBlock = (node: TNode): node is IBlock => node.type === "BLOCK";
export const isILet = (node: TNode): node is ILet => node.type === "LET";
export const isIIf = (node: TNode): node is IIf => node.type === "IF";
export const isIFunctionCall = (node: TNode): node is IFunctionCall => node.type === "FUNCTION_CALL";
export const isIGetter = (node: TNode): node is IGetter => node.type === "GETTER";
export const isIMatch = (node: TNode): node is IMatch => node.type === "MATCH";
export const isIMatchCase = (node: TNode): node is IMatchCase => node.type === "MATCH_CASE";
export const isIFunc = (node: TNode): node is IFunc => node.type === "FUNC";

export const isIScript = (node: TNode): node is IScript => node.type === "SCRIPT";
export const isIDApp = (node: TNode): node is IDApp => node.type === "DAPP";


const validateNodeByPos = (pos: number) => (node: TNode): TNode | null =>
    (node.posStart <= pos && node.posEnd >= pos) ? node : null;

const findNodeByFunc = (node: TNode, f: (node: TNode) => TNode | null): TNode | null => {
    if (isIBlock(node)) {
        return f(node.body) || f(node.dec)
    } else if (isILet(node) || isIMatch(node) || isIMatchCase(node) || isIFunc(node) || isIScript(node) || isIDApp(node)) {
        return f(node.expr)
    } else if (isIIf(node)) {
        return f(node.cond) || f(node.ifTrue) || f(node.ifFalse)
    } else if (isIFunctionCall(node)) {
        return node.args.find(node => f(node) != null) || null
    } else if (isIGetter(node)) {
        return f(node.ref)
    } else if (isIMatch(node)) {
        return node.cases.find(node => f(node) != null) || null
    } else {
        return null
    }
};

export function getNodeByOffset(node: TNode, pos: number): TNode {
    const goodChild = findNodeByFunc(node, validateNodeByPos(pos));
    return (goodChild) ? getNodeByOffset(goodChild, pos) : node
}

export function offsetToRange(startOffset: number, content: string): { row: number, col: number } {
    const sliced = content.slice(0, startOffset).split('\n');
    const row = sliced.length - 1, col = sliced[row].length - 1;
    return {row, col};
}

export function rangeToOffset(row: number, col: number, content: string): number {
    const split = content.split('\n');
    return Array.from({length: row}, (_, i) => i)
        .reduce((acc, i) => acc + split[i].length + 1, 0) + col + 1;
}
