import {
    TextDocument, CompletionItemKind,
    Diagnostic, CompletionItem, Position, Range, DiagnosticSeverity, CompletionList, SignatureHelp
} from "vscode-languageserver-types";
import { globalSuggestions, types as fieldsMap, functions as funcsMap } from './suggestions/index'
import { safeCompile } from './safeCompile'


export class LspService {
    public validateTextDocument(document: TextDocument): Diagnostic[] {
        let diagnostics: Diagnostic[] = []
        let result = safeCompile(document.getText())
        const errorText = result.error
        if (errorText) {
            const errRangesRegxp = /\d+-\d+/gm
            const errorRanges: string[] = errRangesRegxp.exec(errorText) || []
            const errors = errorRanges.map(offsets => {
                const [start, end] = offsets.split('-').map(offset => document.positionAt(parseInt(offset)))
                const range = Range.create(start, end)
                return {
                    range,
                    severity: DiagnosticSeverity.Error,
                    message: errorText
                }
            })
            diagnostics.push(...errors)
        }
        return diagnostics
    }

    public completion(document: TextDocument, position: Position) {
        const offset = document.offsetAt(position)
        const character = document.getText().substring(offset - 1, offset)
        const line = document.getText({ start: { line: position.line, character: 0 }, end: position })
        const textBefore = document.getText({ start: { line: 0, character: 0 }, end: position })
        const caseDeclarations = this.findCaseDeclarations(textBefore);
        const matchDeclarations = this.findMatchDeclarations(textBefore)
        let result: CompletionItem[] = [];

        let nonTranzactionsClasses = ['Address', 'Alias', 'Transfer', 'DataEntry', 'GenesisTransaction', 'PaymentTransaction'];
        let transactionClasses = Object.keys(fieldsMap).filter(val => nonTranzactionsClasses.indexOf(val) === -1)

        try {
            let wordBeforeDot = line.match(/([a-zA-z0-9_]+)\.[a-zA-z0-9_]*\b$/)     // get text before dot (ex: [tx].test)

            switch (true) {
                case (character === '.' || wordBeforeDot !== null):                 //autocompletion after clicking on a dot
                    
                    let inputWord = (wordBeforeDot === null)                        //get word before dot or last word in line
                        ? line.match(/\b(\w*)\b\./g).pop().slice(0, -1) 
                        : wordBeforeDot[1];

                    switch (true) {
                        case (['buyOrder', 'sellOrder'].indexOf(inputWord) > -1): 
                            result = fieldsMap['Order'];                            //ExchangeTransaction:'buyOrder', 'sellOrder'
                            break;
                        case (['recipient'].indexOf(inputWord) > -1):               //'recipient'
                            result = [...fieldsMap['Address'], ...fieldsMap['Alias']]; 
                            break;
                        case (['tx'].indexOf(inputWord) > -1):                      // 'tx'
                            result = intersection(...transactionClasses.map(val => fieldsMap[val])); 
                            break;
                        case ([...caseDeclarations].pop() === inputWord):           //case variable:
                            let temp = textBefore.match(/\bcase[ \t]*.*/g).pop()    //get line with last "case" block
                                .match(new RegExp(                                  //search fields in line 
                                    `\\b${Object.keys(fieldsMap).join('\\b|\\b')}\\b`, 'g')
                                    ) 
                                .map(value => fieldsMap[value]);
                            result = intersection(...temp);
                            break;
                        default:
                            this.findLetDeclarations(textBefore).map((val, _, arr) => {
                                if (val.name === inputWord) {
                                    result = fieldsMap[val.value];
                                    arr.length = 0;
                                }
                            });
                            break;
                    }
                    break;
                    //autocompletion after clicking on a colon or pipe
                case ([':', '|'].indexOf(character) !== -1 || line.match(/([a-zA-z0-9_]+)[ \t]*[|:][ \t]*[a-zA-z0-9_]*$/) !== null): 
                    ([...matchDeclarations].pop() === 'tx')                         // if match(tx) else match(!tx)
                        ? result = transactionClasses.map(val => ({ label: val, kind: CompletionItemKind.Class }))  
                        : result = Object.keys(fieldsMap).map(val => ({ label: val, kind: CompletionItemKind.Class })); 
                    break;
                default:
                    result = [
                    // get variables after "let" and globalSuggestions
                        ...getDataByRegexp(textBefore, /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm)
                            .map(val => ({ label: val.name, kind: CompletionItemKind.Variable })),
                        ...globalSuggestions
                    ];
                    break;
            }
        } catch (e) {
            //   console.error(e) 
        }

        return {
            isIncomplete: false,
            items: result
        } as CompletionList
    }

    public hover(document: TextDocument, position: Position) {
        const word = getWordByPos(document.getText().split('\n')[position.line], position.character);
        let result = [];
        if (funcsMap[word])
        result.push(`**${word}** (\n
            ${funcsMap[word].params.map((p:ParamType) => `\n * ${`${p.label}${p.required ? "":"?"}:`+
                ` ${p.type} - ${p.description}`} \n`)}\n) : ${funcsMap[word].type} \n>_${funcsMap[word].doc}_`);
        return {
            contents: result
        };
    }


    public signatureHelp(document: TextDocument, position: Position) :SignatureHelp {

        const offset = document.offsetAt( position );
        const character = document.getText().substring( offset - 1, offset );

        let out: SignatureHelp = { //empty SignatureHelp
            activeParameter: null,
            activeSignature: null,
            signatures: [],
        };

        if ( character === ")" ) 
            return out;

        try {
            const textBefore = document.getText( { start: { line: 0, character: 0 }, end: position } );
            const lastFunction = textBefore.match( /\b([a-zA-z0-9_]*)\b[ \t]*\(/g ); //get function calls
            const word = ( lastFunction.pop().slice( 0, -1) ); //get last function call
            let result = [];
            if ( funcsMap[word] )
                result.push({
                    //get label in format: functionName (parameter1, parameter2 ...)
                    label: `${word}(${funcsMap[word].params.map((p:ParamType) => `${p.label}${p.required ? "":"?"}:`+
                        ` ${p.type}`).join(', ')}): ${funcsMap[word].type}`,
                    documentation: funcsMap[word].doc,
                    parameters: funcsMap[word].params.map((p:ParamType) => ({ label: `${p.label}${p.required ? "":"?"}:`+
                        ` ${p.type}`, documentation: p.description }))
                });
            out = {
                //get comma`s count inside brackets
                activeParameter: ( textBefore.split(lastFunction.pop()).pop().split(',').length - 1 ) ,
                activeSignature: 0,
                signatures: result,
            };
        } catch (e) { }

        return out;
    }

    public completionResolve(item: CompletionItem) {
        return item
    }

    private findLetDeclarations(text: string): LetDeclarationType[] {
        let rx = new RegExp(`\\b${Object.keys(fieldsMap).join('\\b|\\b')}\\b`, 'g');//this regexp looks for fields
        return [
                    //this regexp looks for variables
            ...getDataByRegexp(text, /^[ \t]*let[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*=[ \t]*([^\n]+)/gm)  
        ].filter(val => {
            let match = val.value.match(rx)
            if (match !== null) {
                val.value = match[0] || ''
                return val
            } else return false
        })
    }

    private findMatchDeclarations(text: string) {
        const re = /\bmatch[ \t]*\([ \t]*([a-zA-z0-9_]+)[ \t]*\)/gm;                //this regexp looks for "match" blocks
        const declarations = [];
        let myMatch;
        while ((myMatch = re.exec(text)) !== null) {
            declarations.push(myMatch[1]);
        }
        return declarations;
    }

    private findCaseDeclarations(text: string): string[] {
        const re = /\bcase[ \t]+([a-zA-z][a-zA-z0-9_]*)[ \t]*:/gm                   //this regexp looks for "case" blocks
        const declarations: string[] = []
        let myMatch;

        while ((myMatch = re.exec(text)) !== null) {
            declarations.push(myMatch[1])
        }

        return declarations
    }
}

interface LetDeclarationType {
    name: string
    value: string
}


interface ParamType {
    label: string
    type: string
    required: boolean
    description: string
}

function intersection(...args: any): CompletionItem[] {
    let out = args[0];
    for (let i = 1; i < args.length; i++) out = intersect(out, args[i])
    return out
}

function intersect(a: CompletionItem[], b: CompletionItem[]) {
    let list: string[] = [], out: CompletionItem[] = [];
    a.forEach((val) => list.push(val.label));
    b.forEach(val => (list.indexOf(val.label) > -1) ? out.push(val) : false);
    return out
}

function getDataByRegexp(text: string, re: RegExp): LetDeclarationType[] {
    const declarations = [];
    let myMatch;
    while ((myMatch = re.exec(text)) !== null) {
        declarations.push({ name: myMatch[1], value: myMatch[2] });
    }
    return declarations;
}

function getWordByPos(string: string, character: number) {
    let sep = ['"', '\'', '*', '(', ')', '{', '}', '[', ']', '!', '<', '>', '|', '\\', '/', '.', ',', ':', ';', '&', ' ', '=', '\t']
    let start = 0, end = string.length
    for (let i = character; i <= string.length; i++) {
        if (sep.indexOf(string[i]) > -1) {
            end = i
            break
        }
    }
    for (let i = character; i >= 0; i--) {
        if (sep.indexOf(string[i]) > -1) {
            start = ++i
            break
        }
    }
    return string.substring(start, end)
}
