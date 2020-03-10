import {
    IFunc,
    IPos,
    TArgument,
    TExprResultType,
    TFunction,
    TList,
    TStruct,
    TStructField,
    TUnion
} from '@waves/ride-js';
import suggestions, { isList, isPrimitive, isStruct, isUnion } from '../suggestions';

export const validateByPos = (pos: number, node: IPos) => (node.posStart <= pos && node.posEnd >= pos);

export const getExpressionType = (resultType: TExprResultType): string => {
    if ('type' in resultType) {
        return resultType.type;
    }
    if ('unionTypes' in resultType) {
        return resultType.unionTypes.map((t: TExprResultType) => getExpressionType(t)).join(' | ');
    }
    if ('listOf' in resultType) {
        return `${getExpressionType(resultType.listOf)}[]`;
    }
    return '';
};

export const getFuncHoverByNode = (n: IFunc) => `${n.name.value}(${n.argList.map(({argName: {value}, typeList}) =>
    `${value}: ${typeList.map(({typeName: {value}}) => value).join('|')}`).join(', ')}): ${getExpressionType(n.expr.resultType)}`;
export const getFuncHoverByTFunction = (f: TFunction) => `${f.name}(${f.args.map(({name, type}) =>
    `${name}: ${type}`).join(', ')}): ${f.resultType}`;
export const getFuncArgNameHover = ({argName: {value: name}, typeList}: TArgument) => `${name}: ${
    typeList.map(({typeName: {value: name}}) => `${name}`).join(' | ')}`;

export const getTypeDoc = (item: TStructField, isRec?: Boolean): string => {
    const type = item.type;
    let typeDoc = 'Unknown';
    switch (true) {
        case isPrimitive(type):
            typeDoc = type as string;
            break;
        case isStruct(type):
            typeDoc = isRec ? (type as TStruct).typeName :
                `**${(type as TStruct).typeName}**(\n- ` + (type as TStruct).fields
                    .map((v) => `${v.name}: ${getTypeDoc(v, true)}`).join('\n- ') + '\n\n)';
            break;
        case isUnion(type):
            typeDoc = (type as TUnion).map(field => isStruct(field) ? field.typeName : field).join('|');
            break;
        case isList(type):
            typeDoc = `LIST[ ` +
                `${((type as TList).listOf as TStruct).typeName || (type as TList).listOf}]`;
            break;
    }
    return typeDoc;
};

export const getFuncArgumentOrTypeByPos = (node: IFunc, pos: number): string | null => {
    let out: string | null = null;
    node.argList.forEach((arg) => {
        if (validateByPos(pos, arg.argName)) {
            out = getFuncArgNameHover(arg);
        } else {
            for (const {typeName} of arg.typeList) {
                if (validateByPos(pos, typeName)) {
                    const type = suggestions.types.find(({name}) => name === typeName.value);
                    out = type ? getTypeDoc(type) : typeName.value;
                    break;
                }
            }
        }
    });
    return out;
};
