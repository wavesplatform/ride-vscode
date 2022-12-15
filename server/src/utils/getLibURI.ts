import path = require("path");
import {Files} from "vscode-languageserver";

function search_largest_substr() {
    let str_min = arguments[0];
    const list = [];
    for (let n = 1; n < arguments.length; n++) {
        if (str_min.length < arguments[n].length) {
            list.push(arguments[n]);
            continue;
        }
        list.push(str_min);
        str_min = arguments[n];
    }
    for (let l = str_min.length; l > 0; l--) {

        for (let p = 0; p <= str_min.length - l; p++) {
            const substr = str_min.slice(p, p + l);
            let isFound = true;
            for (let i = 0; i < list.length; i++) {
                if (list[i].indexOf(substr) >= 0)
                    continue;
                isFound = false;
                break;
            }
            if (isFound)
                return substr;
        }
    }
    return "";
}

export const getLibURI = (uri: string, libPath: string): string => {
    const pathToLib = path.resolve(libPath)
    console.log('pathToLib', pathToLib)
    // @ts-ignore
    const subStr = search_largest_substr(uri, (Files.uriToFilePath(uri) || '').replace(/\\/, '/'))
    const uriRoot = uri.replace(subStr, '')
    return uriRoot + pathToLib
}
