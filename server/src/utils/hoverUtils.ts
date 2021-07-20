import {
    IFunc,
    IFunctionCall,
    IPos,
    TArgument,
    TExprResultType,
    TFunction,
    TList,
    TStruct,
    TStructField,
    TType,
    TUnion
} from '@waves/ride-js';
import suggestions, {isList, isPrimitive, isStruct, isUnion} from '../suggestions';

export const validateByPos = (pos: number, node: IPos & { value: string }) => node.posStart <= pos && node.posEnd >= pos;

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
    return `${functionName}(${argumentString}): ${getExpressionType(n.expr.resultType)}`;
};

export const getFunctionCallHover = (n: IFunctionCall): string => {
    const name = n.name.value
    // @ts-ignore
    const args = n.args.length !== 0 ? n.args.map(x => `${x.resultType.type.toLowerCase()}: ${x.resultType.type}`).join(', ') : ''

    // @ts-ignore
    return `${name}(${args}): ${n.resultType.type}`
}

export const getFuncHoverByTFunction = (f: TFunction) => {
    // console.log('f', JSON.stringify(f))
    const args = f.args.map(({name, type}) => {
        if (Array.isArray(type)) {
            const types = type.map((x: any) => x.typeName)
            return `${name}: ${types.join(' | ')}`
        } else return `${name}: ${type}`
    })
    return `${f.name}(${args.join(', ')}): ${convertResultType(f.resultType)}`;
}

export const getFuncArgNameHover = ({argName: {value: name}, type}: TArgument) => {
    console.log('getFuncArgNameHover');
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
        // console.log('node.argList', node.argList)
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

export function convertResultType(type: TType): string {
    const result: string[] = []

    function recursiveFunc(type: TType, result: string[]) {
        //primitive
        if (typeof type === 'string') {
            result.push(type)
        }
        //union
        if (Array.isArray(type)) {
            type.map(x => recursiveFunc(x, result))
        }
        //list
        if ((type as TList).listOf !== undefined) {
            const result: string[] = []
            // @ts-ignore
            recursiveFunc((type as TList).listOf, result)
            result.push(`List[${result.join(', ')}]`)
        }
        //struct
        if ((type as TStruct).typeName !== undefined) {
            result.push((type as TStruct).typeName)
        } else {
            console.log('type', type)
        }
    }

    recursiveFunc(type, result)

    return result.join(', ')
}
