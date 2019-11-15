"use strict";
exports.__esModule = true;
var vscode_languageserver_types_1 = require("vscode-languageserver-types");
var suggestions = require("./suggestions.json");
var ride_js_1 = require("@waves/ride-js");
var Suggestions = /** @class */ (function () {
    function Suggestions() {
        var _this = this;
        this.types = ride_js_1.getTypes();
        this.functions = ride_js_1.getFunctionsDoc();
        this.globalVariables = ride_js_1.getVarsDoc();
        this.globalSuggestions = [];
        this.updateSuggestions = function (stdlibVersion, isTokenContext) {
            var _a, _b, _c, _d;
            var types = ride_js_1.getTypes(stdlibVersion, isTokenContext);
            var functions = ride_js_1.getFunctionsDoc(stdlibVersion, isTokenContext);
            var globalVariables = ride_js_1.getVarsDoc(stdlibVersion, isTokenContext);
            _this.types.length = 0;
            _this.functions.length = 0;
            _this.globalVariables.length = 0;
            _this.globalSuggestions.length = 0;
            (_a = _this.types).push.apply(_a, types);
            (_b = _this.functions).push.apply(_b, functions);
            (_c = _this.globalVariables).push.apply(_c, globalVariables);
            (_d = _this.globalSuggestions).push.apply(_d, suggestions.directives.map(function (directive) { return ({ label: directive, kind: vscode_languageserver_types_1.CompletionItemKind.Reference }); }).concat(suggestions.keywords.map(function (label) { return ({ label: label, kind: vscode_languageserver_types_1.CompletionItemKind.Keyword }); }), suggestions.snippets.map(function (_a) {
                var label = _a.label;
                return ({ label: label, kind: vscode_languageserver_types_1.CompletionItemKind.Snippet });
            }), functions.map(function (_a) {
                var name = _a.name, doc = _a.doc;
                return ({ detail: doc, kind: vscode_languageserver_types_1.CompletionItemKind.Function, label: name });
            })));
        };
        this.updateSuggestions();
    }
    return Suggestions;
}());
exports["default"] = new Suggestions();
