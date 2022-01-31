import { Files } from "vscode-languageserver";
import {TextDocument} from "vscode-languageserver-types";
import * as fs from 'fs'
import { URI } from 'vscode-uri'
import * as path from 'path'

export interface IFileContentProvider {
    getContent(filePath: string, relativeTo: string): string
}

export class FileContentProvider implements IFileContentProvider{
    constructor(private inmemoryStorage:Record<string, TextDocument>){}

    getContent(filePath: string, relativeTo: string) {
        if (relativeTo != null){
            const folder = Files.uriToFilePath(relativeTo)!.split('/').slice(0, -1).join('/')
            filePath = path.resolve(__dirname, folder, filePath)
        }
        const uri = URI.file(filePath).toString();
        
        if (this.inmemoryStorage[uri] != null){
            return this.inmemoryStorage[uri].getText()
        } else {
            return fs.readFileSync(filePath).toString()
        }
    }
}
