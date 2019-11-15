'use strict';
exports.__esModule = true;
var vscode_languageserver_1 = require("vscode-languageserver");
var LspServer_1 = require("./LspServer");
var connection = vscode_languageserver_1.createConnection();
new LspServer_1.LspServer(connection);
