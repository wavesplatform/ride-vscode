import { IContext, TFunction, TNode, TStruct, TStructField, TType } from '@waves/ride-js';
import { CompletionItem, CompletionItemKind as ItemKind } from 'vscode-languageserver-types';
import suggestions, { isList, isPrimitive, isStruct, isUnion, listToString, unionToString } from '../suggestions';
import { isIGetter, isIRef } from './index';


export const getPostfixFunctions = (type: TType): TFunction[] => {
    return suggestions.functions.filter(({ args }) => {
        if (!args[0] || !type) return false;
        if (isPrimitive(type) && isPrimitive(args[0].type) && type === args[0].type) return true;
        if (isStruct(type) && isStruct(args[0].type) && type.typeName === args[0].type.typeName) return true;
        if (isStruct(type) && isUnion(args[0].type)) {
            let currentType = args[0].type[0];
            if (isStruct(currentType) && type.typeName === currentType.typeName) {
                return true;
            }
        }
        if (args[0].type === 'PARAMETERIZEDUNION(List(TYPEPARAM(84), Unit))' && isUnion(type)) {
            return type.some(item => isStruct(item) && item.typeName === 'Unit')
        }
        return false;
    })
};


export const convertToCompletion = (field: TStructField): CompletionItem => {
    let detail: string = '';
    if (isPrimitive(field.type)) {
        detail = field.type;
    } else if (isList(field.type)) {
        detail = listToString(field.type);
    } else if (isStruct(field.type)) {
        detail = field.type.typeName;
    } else if (isUnion(field.type)) {
        detail = unionToString(field.type);
    }

    return { label: field.name, detail, kind: ItemKind.Field };
};


export const getCompletionDefaultResult = (ctx: IContext[] = []) => [
    ...ctx.map(({ name: label }) => ({ label, kind: ItemKind.Variable })),
    ...suggestions.globalVariables.map(({ name: label, doc: detail }) => ({ label, kind: ItemKind.Variable, detail })),
    ...suggestions.globalSuggestions,
    ...suggestions.types.filter(({ type }) => isStruct(type)).map(({ name: label }) => ({ kind: ItemKind.Class, label })),
];

export function getNodeType(node: TNode) {

    const go = (node: TNode): TStructField[] => {
        if (isIGetter(node)) {
            const def = go(node.ref);
            const field = def.find(({ name }) => name === node.field.value);
            if (!field) return [];
            return intersection(isUnion(field.type) ? field.type : [field.type]);
        } else if (isIRef(node)) {
            //todo add ctx search
            let def = suggestions.globalVariables.find(({ name }) => name === node.name);
            if (!def) return [];
            return intersection(isUnion(def.type) ? def.type : [def.type]);
        }
        return [];
    };

    return go(node);

}


export function intersection(types: TType[]): TStructField[] {
    const items = [...types];
    let structs: TStruct[] = [];
    if (types === [] || items.length === 0) {
        return [];
    }
    let next: TType;
    while (items.length > 0) {
        next = items.pop()!;
        if (isStruct(next)) {
            structs.push(next);
        } else if (isUnion(next)) {
            items.push(...next);
        } else {
            return [];
        }
    }
    const firstArg = structs[0];
    let out = firstArg.fields;
    for (let i = 1; i < structs.length; i++) out = intersect(out, structs[i].fields);
    return out;
}

function intersect(a: TStructField[], b: TStructField[]) {
    let list: string[] = [], out: TStructField[] = [];
    a.forEach((val) => list.push(val.name));
    b.forEach(val => (~list.indexOf(val.name)) ? out.push(val) : false);
    return out;
}
