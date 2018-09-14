declare module '@waves/ride-js' {
    const compile: (code: string) => CompilationResult
}

interface CompilationResult {
    ast?: { type:string, value: any }
    error?: string,
    result: ArrayBuffer
}