import { IBlock, IFunc, IFunctionCall, IGetter, IIf, ILet, IMatch, IMatchCase, TNode, IScript, IDApp } from "@waves/ride-js";

const isScript = (node: TNode): node is IScript => node.type === "SCRIPT";
const isDapp = (node: TNode): node is IDApp => node.type === "DAPP";
const isIBlock = (node: TNode): node is IBlock => node.type === "BLOCK";
const isILet = (node: TNode): node is ILet => node.type === "LET";
const isIIf = (node: TNode): node is IIf => node.type === "IF";
const isIFunctionCall = (node: TNode): node is IFunctionCall => node.type === "FUNCTION_CALL";
const isIGetter = (node: TNode): node is IGetter => node.type === "GETTER";
const isIMatch = (node: TNode): node is IMatch => node.type === "MATCH";
const isIMatchCase = (node: TNode): node is IMatchCase => node.type === "MATCH_CASE";
const isIFunc = (node: TNode): node is IFunc => node.type === "FUNC";

const validateNodeByPos = (pos: number) => (node: TNode): TNode | null =>
    (node.posStart <= pos && node.posEnd >= pos) ? node : null;

const findNodeByFunc = (node: TNode, f: (node: TNode) => TNode | null): TNode | null => {
    if (isIBlock(node)) {
        return f(node.body) || f(node.dec)
    } else if (isILet(node) || isIMatch(node) || isIMatchCase(node) || isIFunc(node) || isScript(node) || isDapp(node)) {
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
    return {row: sliced.length - 1, col: sliced[sliced.length - 1].length + sliced.length - 1};
}

export function rangeToOffset(row: number, col: number, content: string): number {
    const split = content.split('\n');
    return Array.from({length: row}, (_, i) => i).reduce((acc, i) => acc + split[i].length, 0) + col;
}
