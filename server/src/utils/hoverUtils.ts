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
    const argumentString = args.length !== 0
        ? args.map(({argName: {value}, type}) =>
            `${value}: ${
                !type.typeParam
                    ? !!args ? type.typeName.value : ''
                    : `${type.typeName.value}[${type.typeParam.value.typeList.map(x => x.typeName.value).join(' | ')}]`
            }`).join(', ')
        : ''
    return `*${functionName}*(${argumentString}): ${getExpressionType(n.expr.resultType)}`;
};

export const getFunctionCallHover = (n: IFunctionCall): string => {
    const name = n.name.value
    // @ts-ignore
    const args = n.args.length !== 0 ? n.args.map((x, i) => {
        // @ts-ignore
        return `arg${i+1}: ${convertResultType(x.resultType.type || x.resultType)}`
    }).join(', ') : ''
    // @ts-ignore
    return `**${name}**(${args}): ${convertResultType(n.resultType)}`
}

export const getFuncHoverByTFunction = (functions: TFunction[]) => {
    const res = functions.map(f => {
        const args = f.args.map(({name, type, doc}) => {
            if (Array.isArray(type)) {
                // @ts-ignore
                const types = type.map((x: any) => x.typeName || x)
                return `${name}: ${types.join(' | ')} — ${doc} \n`
            } else return `${name}: ${type} — ${doc} \n`
        })
        return `**${f.name}**(${args.join('\n')}): ${convertResultType(f.resultType)} \n — ${f.doc}`;
    })
    return res
}

export const getFuncArgNameHover = ({argName: {value: name}, type}: TArgument) => {
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
        node.argList.forEach((arg) => {
            if (validateByPos(pos, arg.argName)) {
                out = getFuncArgNameHover(arg);
            } else {
                const {typeName} = arg.type
                if (validateByPos(pos, typeName)) {
                    const type = suggestions.types.find(({name}) => name === typeName.value);
                    out = type ? getTypeDoc(type) : typeName.value;
                }
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
            const res: string[] = []
            recursiveFunc((type as TList).listOf, res)
            result.push(`List[${res.join(', ')}]`)
        }
        //struct
        if ((type as TStruct).typeName !== undefined) {
            result.push((type as TStruct).typeName)
        }
        //union
        if ((type as any).unionTypes !== undefined) {
            // @ts-ignore
            recursiveFunc(type.unionTypes, result)
        }
    }

    recursiveFunc(type, result)
    return result.join(', ')
}

export function getWordByPos(string: string, character: number) {
    const text = string.substring(0, character - 1);
    let n = text.replace(/[\[\]?.,\/#!$%\^&\*;:{}=\\|_~()]/g, "").split(" ");
    return n[n.length - 1];
}
