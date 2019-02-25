declare module '@waves/ride-js' {
    const compile: (code: string) => CompilationResult
}

interface CompilationResult {
    ast?: { type:string, value: any }
    error?: string,
    result: ArrayBuffer
}

interface LetDeclarationType {
    name: string
    value: string
}


interface ParamType {
    name: string
    type: string
    required: boolean
    detail: string
}
