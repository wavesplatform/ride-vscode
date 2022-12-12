import { caseRegexp, isStruct, isUnion, letRegexp, Suggestions } from "../suggestions";
import { TStruct, TStructField, TType } from "@waves/ride-js";
import { getLastArrayElement, intersection } from "../utils";
import {getDataByRegexp, TDecl, unique} from "./complitionUtils";
export const suggestions = new Suggestions();
const { regexps, types, functions, globalVariables } = suggestions;

export type TPosition = {
    row: number
    col: number
};

export type TVarDecl = {
    name: string,
    type: TType,
    doc?: string
    pos?: TPosition
};

type TContext = {
    vars: TVarDecl[]
    start: TPosition
    end: TPosition
    children: TContext[]
}

export class Context {

    context: TContext = {
        vars: [],
        start: { row: 0, col: 0 },
        end: { row: 0, col: 0 },
        children: []
    };

    variables: TVarDecl[] = [];

    text: string = '';

    updateContext(text: string) {
        if (this.text !== text) this.findContextDeclarations(text);
    }

    getVariable = (name: string): (TVarDecl | undefined) =>
        this.variables.find(({ name: varName }) => varName === name);

    getVariablesByPos = (p: TPosition): TVarDecl[] => this.getVariablesRec(this.context, p);

    getContextByPos = (p: TPosition): TContext => this.getContextRec(this.context, p);

    private getContextRec = (c: TContext, p: TPosition): TContext => {
        const newCtx: TContext | undefined = c.children.find(({ start, end }) => this.comparePos(start, end, p));
        return (newCtx !== undefined) ? this.getContextRec(newCtx, p) : c;
    };


    private getVariablesRec(c: TContext, p: TPosition): TVarDecl[] {

        const out: TVarDecl[] = c.vars;
        const childCtx = c.children.find(({ start, end }) => this.comparePos(start, end, p));
        if (childCtx) out.push(...this.getVariablesRec(childCtx, p));
        return out;
    }

    private comparePos(start: TPosition, end: TPosition, p: TPosition): boolean {
        if (start.row < p.row && end.row > p.row) return true;
        else if (start.row === p.row && start.col <= p.col - 1) return true;
        else if (end.row === p.row && end.col >= p.col - 1) return true;
        return false
    }

    private defineType(name: string, value: string, pos?: TPosition): TVarDecl {
        value = value.replace(/#.*$/, '');
        let out: TVarDecl = { name, pos, type: 'Unknown' };
        let match: RegExpMatchArray | null, split: string[];
        const variable = this.getVariable(value);
        if (variable) out.type = variable.type;
        else if (Number(value.toString().replace(/_/g, '')).toString() !== 'NaN') {
            out.type = 'Int';
        } else if ((match = value.match(/\b(base58|base64|base16)\b[ \t]*'(.*)'/)) != null) {
            out.type = 'ByteVector';
        } else if (/.*\b&&|==|!=|>=|>\b.*/.test(value) || /\btrue|false\b/.test(value)) {
            out.type = 'Boolean';
        } else if ((match = value.match(/^[ \t]*"(.+)"[ \t]*/)) != null) {
            out.type = 'String';
        } else if ((split = value.split('|')).length > 1) {
            out.type = {
                typeName: 'Union',
                fields: intersection(types.filter(({ name }) => ~split.indexOf(name)).map(i => i.type))
            }
        } else if ((match = value.match(regexps.functionsRegExp)) != null) {
            (match[1] === 'extract')
                ? out.type = this.getExtractDoc(value, 'TYPEPARAM(84)')
                : out.type = functions.find(({ name }) => name === match![1])!.resultType;
        } else if ((match = value.match(regexps.typesRegExp)) != null) {
            out.type = types.find(type => match != null && type.name === match[0])!.type;
        } else if ((match = value.match(/^[ \t]*\[(.+)][ \t]*$/)) != null) {
            let uniqueType = unique(match[1].split(',')
                .map(type => this.defineType('', type).type));
            out.type = (uniqueType.length === 1) ? { listOf: uniqueType[0] } : { listOf: "any" };
        } else if ((split = value.split('.')).length > 1) {
            const type = this.getLadderType(split);
            out.type = type.type;
            if ((match = getLastArrayElement(split).match(regexps.functionsRegExp)) != null) {
                let func = functions.find(({ name }) => match != null && name === match[1]);
                if (func) out.type = func.resultType
            }
        } else if (value === 'Callable') {
            let type = types.find(item => item.name === 'Invocation');
            out = { name: name, type: type != null ? type.type : out.type }
        } else if (value === 'Verifier') {
            let type = types.find(item => item.name === 'Transaction');
            out = { name: name, type: type != null ? type.type : out.type }
        }

        return out
    };

    private getLadderType(inputWords: string[], isExtract?: boolean): TStructField {
        const extractUnit = (type: TType): TType => isExtract && isUnion(type)
            ? type.filter((item) => !(isStruct(item) && item.typeName === 'Unit'))
            : type;

        let declVariable = this.getVariable(inputWords[0]);
        if (declVariable == null || !declVariable.type) return { name: 'Unknown', type: 'Unknown' };
        if (isUnion(declVariable.type)) declVariable.type = {
            typeName: 'Union',
            fields: intersection(declVariable.type)
        };
        let out = { name: declVariable.name, type: extractUnit(declVariable.type) };
        for (let i = 1; i < inputWords.length; i++) {
            let actualType;
            if (isStruct(out.type)) actualType = out.type.fields.find(type => type.name === inputWords[i]);
            if (actualType && actualType.type) out = { ...actualType, type: extractUnit(actualType.type) }
        }

        return out;
    }

    private getContextFrame(p: TPosition, rows: string[], vars?: TVarDecl[]): TContext {
        let out: TContext = {
            vars: vars || [],
            start: { row: p.row, col: p.col },
            end: { row: rows.length - 1, col: rows[rows.length - 1].length },
            children: []
        };
        let bracket = 1;
        let isStop = false;
        for (let i = p.row; i < rows.length; i++) {

            let childrenVariables: TVarDecl[] = [];
            if (~rows[i].indexOf('{-#') || ~rows[i].indexOf(' #-}')) continue;
            if (bracket === 1) {
                const vars = this.getVariables(rows[i], i);
                out.vars.push(...vars);
                childrenVariables = this.getChildrenVariables(rows[i], i);
                this.variables.push(...vars, ...childrenVariables)
            }

            for (let j = ((i === p.row) ? (p.col + 1) : 0); j < rows[i].length; j++) {

                if (rows[i][j] === '}') bracket--;

                if (rows[i][j] === '{') {
                    const child = this.getContextFrame({ row: i, col: j }, rows, childrenVariables);
                    out.children.push(child);
                    i = child.end.row;
                    j = child.end.col;
                }

                if (bracket === 0) {
                    out.end.row = i;
                    out.end.col = j + 1;
                    isStop = true;
                    break;
                }
            }
            if (isStop) break;
        }
        return out;
    }

    private getVariables = (string: string, row: number) => [
        ...getDataByRegexp(string, letRegexp),
    ]
        .map(({ name, value, namePos: col }) => this.defineType(name, value, row && col ? { row, col } : undefined));

    private getChildrenVariables = (string: string, row: number) => [
        ...getDataByRegexp(string, /@(Verifier|Callable)[ \t]*\((.+)\)/g)
            .map(item => ({ ...item, name: item.value, value: item.name })),
        ...getDataByRegexp(string, caseRegexp),
        ...this.getFuncArgs(string)
    ]
        .map(({ name, value, valuePos: col }) => this.defineType(name, value, row && col ? { row, col } : undefined));

    private getFuncArgs(row: string): TDecl[] {
        const out: TDecl[] = [];
        getDataByRegexp(row, /func[ \t]*(.*)\([ \t]*(.*)[ \t]*\)[ \t]*=[ \t]*{/g).forEach(({ value, valuePos: pos, row }) =>
            value.split(/[ \t]*,[ \t]*/).forEach(v => {
                    const split = v.split(/[ \t]*:[ \t]*/);
                    const valuePos = value.indexOf(v) !== -1 && pos ? value.indexOf(v) + pos : undefined;

                    if (split[0] && split[1]) out.push({ name: split[0] || '', value: split[1] || '', valuePos, row })
                }
            )
        );
        return out
    }

    private findContextDeclarations(text: string) {
        const rows = text.split('\n');
        this.variables.length = 0;
        this.variables.push(...globalVariables);
        const out = this.getContextFrame({ row: 0, col: 0 }, rows, globalVariables);
        this.context = out;
        return out;
    }

    private getExtractDoc = (value: string, type: string): TType => {
        let extractData = value.match(/(.+)\.extract/) ||
            value.match(/extract[ \t]*\([ \t]*([a-zA-z0-9_.()"]*)[ \t]*\)/) || [];
        let out: TType = type, match: RegExpMatchArray | null;
        if (extractData.length < 2) return out;
        if (extractData[1] && (match = extractData[1].match(regexps.functionsRegExp)) != null) {
            let resultType = functions.find(({ name }) => name === match![1])!.resultType;
            if (resultType && isUnion(resultType)) {
                out = resultType.filter(type => (type as TStruct)!.typeName !== 'Unit')
            }
        } else {
            out = this.getLadderType(extractData[1].split('.'), true).type;
        }
        return out
    };

}
