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
import suggestions, {isList, isPrimitive, isStruct, isUnion} from '../suggestions';

export const validateByPos = (pos: number, node: IPos & { value: string }) => (node.posStart <= pos && node.posEnd >= pos);

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

export const getFuncHoverByNode = (n: IFunc) => {
    const functionName = n.name.value;
    const args = n.argList;
    console.log('getFuncHoverByNode')
    // console.log('args.length', args.length)
    const argumentString = args.length !== 0
        ? args.map(({argName: {value}, type}) =>
            `${value}: ${
                !type.typeParam
                    ? !!args ? type.typeName.value : ''
                    : `${type.typeName.value}[${type.typeParam.value.typeList.map(x => x.typeName.value).join(' | ')}]`
            }`).join(', ')
        : ''
    // console.log('argumentString', argumentString)
    // console.log('args.length', args.length !== 0 ? args[0].type.typeName.value : '')
    return `${functionName}(${argumentString}): ${getExpressionType(n.expr.resultType)}`;
};

export const getFuncHoverByTFunction = (f: TFunction) => {
    console.log('getFuncHoverByTFunction')
    return `${f.name}(${f.args.map(({name, type}) =>
        `${name}: ${type}`).join(', ')}): ${f.resultType}`;
}

export const getFuncArgNameHover = ({argName: {value: name}, type}: TArgument) => {
    console.log('getFuncArgNameHover');
    // ${type.map(({typeName: {value: name}}) => `${name}`).join(' | ')}
    const argType = !type.typeParam
        ? type.typeName.value
        : `${type.typeName.value}[${type.typeParam.value.typeList.map(x => x.typeName.value).join(' | ')}]`
    return (`${name}: ${argType}`);
}

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
    try {
        let out: string | null = null;
        console.log('node.argList', node.argList)
        node.argList.forEach((arg) => {
            if (validateByPos(pos, arg.argName)) {
                out = getFuncArgNameHover(arg);
            } else {
                // for (const {typeName} of arg.type) {
                const {typeName} = arg.type
                if (validateByPos(pos, typeName)) {
                    const type = suggestions.types.find(({name}) => name === typeName.value);
                    out = type ? getTypeDoc(type) : typeName.value;
                    // break;
                }
                // }
            }
        });
        return out;
    } catch (e) {
        throw new Error(e)
    }
};
