"use strict";
exports.__esModule = true;
var isScript = function (node) { return node.type === "SCRIPT"; };
var isDapp = function (node) { return node.type === "DAPP"; };
var isIBlock = function (node) { return node.type === "BLOCK"; };
var isILet = function (node) { return node.type === "LET"; };
var isIIf = function (node) { return node.type === "IF"; };
var isIFunctionCall = function (node) { return node.type === "FUNCTION_CALL"; };
var isIGetter = function (node) { return node.type === "GETTER"; };
var isIMatch = function (node) { return node.type === "MATCH"; };
var isIMatchCase = function (node) { return node.type === "MATCH_CASE"; };
var isIFunc = function (node) { return node.type === "FUNC"; };
var validateNodeByPos = function (pos) { return function (node) {
    return (node.posStart <= pos && node.posEnd >= pos) ? node : null;
}; };
var findNodeByFunc = function (node, f) {
    if (isIBlock(node)) {
        return f(node.body) || f(node.dec);
    }
    else if (isILet(node) || isIMatch(node) || isIMatchCase(node) || isIFunc(node) || isScript(node) || isDapp(node)) {
        return f(node.expr);
    }
    else if (isIIf(node)) {
        return f(node.cond) || f(node.ifTrue) || f(node.ifFalse);
    }
    else if (isIFunctionCall(node)) {
        return node.args.find(function (node) { return f(node) != null; }) || null;
    }
    else if (isIGetter(node)) {
        return f(node.ref);
    }
    else if (isIMatch(node)) {
        return node.cases.find(function (node) { return f(node) != null; }) || null;
    }
    else {
        return null;
    }
};
function getNodeByOffset(node, pos) {
    var goodChild = findNodeByFunc(node, validateNodeByPos(pos));
    return (goodChild) ? getNodeByOffset(goodChild, pos) : node;
}
exports.getNodeByOffset = getNodeByOffset;
function offsetToRange(startOffset, content) {
    var sliced = content.slice(0, startOffset).split('\n');
    return { row: sliced.length - 1, col: sliced[sliced.length - 1].length - 1 };
}
exports.offsetToRange = offsetToRange;
function rangeToOffset(row, col, content) {
    var split = content.split('\n');
    return Array.from({ length: row }, function (_, i) { return i; }).reduce(function (acc, i) { return acc + split[i].length; }, 0) + col;
}
exports.rangeToOffset = rangeToOffset;
