/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
    IPCMessageReader, IPCMessageWriter,
    createConnection, IConnection, TextDocumentSyncKind,
    TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
    InitializeParams, InitializeResult, TextDocumentPositionParams,
    CompletionItem, CompletionItemKind, CompletionList, Hover, CodeActionParams, Command,
    SymbolInformation, ReferenceParams, Position, SignatureHelp, ParameterInformation, 
    SignatureInformation, Range, RenameParams, WorkspaceSymbolParams, DocumentFormattingParams,
    TextEdit, Location, Definition, SymbolKind
} from 'vscode-languageserver';

import * as rp from 'request-promise';
import * as fs from 'fs';

// Create a connection for the server. The connection uses 
// stdin / stdout for message passing
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites. 
let workspaceRoot: string;
connection.onInitialize(
    (params) : InitializeResult => {
        workspaceRoot = params.rootPath;
        return {
            capabilities: {
                // Tell the client that the server works in FULL text document sync mode
                textDocumentSync: documents.syncKind,
                // Tell the client that the server support code complete
                completionProvider: {
                    resolveProvider: true,
                     triggerCharacters: [ ".", "(", "," ]
                },
                hoverProvider: true,
                documentSymbolProvider : true,
                workspaceSymbolProvider : true,
                signatureHelpProvider : { triggerCharacters : [ "(", ",", "." ] },
                definitionProvider : true,
                referencesProvider : true,
                documentFormattingProvider : true
            }
        }
    }
);

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(
    (change) => {
        validateTextDocument(change.document);
    }
);

// The settings interface describe the server relevant settings part
interface Settings {
    ewam: EwamSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface EwamSettings {
    url: string;
}

interface tPositionRange {
    line : number,
    column : number
}

interface tCompletionList {
    isComplete : boolean,
    items : tCompletionItem[]
}

interface tCompletionItem {
    name : string,
    documentation : string,
    detail : string,
    insertText : string,
    entity : tEntity
}

interface tEntity {
    label : string,
    ownerName : string,
    exactType : string,
    baseType : string,
    location : string,
    description : string
}

interface tOutlineRange {
    startpos : tPositionRange,
    endpos : tPositionRange
}

interface tOutline {
    range: tOutlineRange,
    annotation : string,
    produceGold : string,
    documentation : string,
    name : string,
    entity: tEntity
}

interface tPosition {
   line : number,
   column : number
}

interface tRange {
   startpos : tPosition,
   endpos : tPosition
}

interface tVariable {
   name : string,
   variableType : string,
   documentation : string,
   range : tRange,
   entity : tEntity
}

interface tParameter {
   name : string,
   documentation : string,
   paramType : string
}

interface tMethod {
   name : string,
   parameters : tParameter[],
   returnType : string,
   documentation : string,
   range : tRange,
   entity : tEntity
}

interface tType {
   name : string,
   documentation : string,
   range : tRange,
   entity : tEntity
}

interface tConstant {
   name : string,
   documentation : string,
   range : tRange,
   entity : tEntity
}

interface tMetaInfo {
   moduleName : string,
   documentation : string,
   variables : tVariable[],
   locals : tVariable[],
   methods : tMethod[],
   constants : tConstant[],
   types : tType[],
   parents : tEntity[],
   childs : tEntity[],
   sisters : tEntity[],
   outlines : tOutline[]
}

interface tWhereUsed {
    name: string,
    ownerName: string,
    theType: string,
    location: string,
    description: string
}

let outlines : tOutline[];
let metainfo : tMetaInfo[];
let ewamPath : string;
let workPath : string; 

// hold the maxNumberOfProblems setting
let url: string;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
    let settings = <Settings>change.settings;
    url = settings.ewam.url || 'http://localhost:8082/';
    // Revalidate any open text documents
    documents.all().forEach(validateTextDocument);
});

function validateTextDocument(textDocument: TextDocument): void {
    let diagnostics: Diagnostic[] = [];
    let lines = textDocument.getText().split(/\r?\n/g);
    let problems = 0;
    let maxNumberOfProblems = 100;
    for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
        let line = lines[i];
        let index = line.indexOf('typescript');
        if (index >= 0) {
            problems++;
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: i, character: index },
                    end: { line: i, character: index + 10 }
                },
                message: `${line.substr(index, 10)} should be spelled TypeScript`
            });
        }
    }
    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((change) => {
    // Monitored files have change in VSCode
    connection.console.log('We received an file change event');
});

// function transform(response:CompletionList): CompletionList {
    
//     for (var item of response.items){
//         if ("name" in item) {
//             item["label"] = item["name"];
//         } else if ("label" in item) {
//             item["name"] = item["label"];
//         }
//     }
    
//     return response;
// }

// This handler provides the initial list of the completion items.
connection.onCompletion(
    (textDocumentPosition: TextDocumentPositionParams) : Thenable<CompletionList> => {
   
    var lines = documents.get(textDocumentPosition.textDocument.uri).getText().split(/\r?\n/g);

    var position = textDocumentPosition.position;
    var line = lines[position.line];
    var className = textDocumentPosition.textDocument.uri.substring(
        textDocumentPosition.textDocument.uri.lastIndexOf('/') + 1, textDocumentPosition.textDocument.uri.lastIndexOf('.')
    );
    
    var body = {
        implem: {
            name: className,
            ancestor: "",
            content: documents.get(textDocumentPosition.textDocument.uri).getText()
        },
        lineInfo: {
            lineContent: line,
            lineNumber: position.line,
            columnNumber: position.character
        }
    };
    
   var _rp = rp(
       {    
           method: 'POST',
        //    uri: url + '/aMRS_ActiveModelService/suggest',
           uri: url + '/api/rest/classOrModule/' + className + '/suggest', 
           json: true,
           body: body
        });
    
    return _rp.then( (response : tCompletionList) => {
        
        for (let index : number = 0; index < response.items.length; index++) {
            response.items[index]["kind"] = getCompletionKindFromEntityClass(response.items[index].entity.baseType);
        }
        return response;
    });
 
});

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.uri} opened.`);
});

connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});

connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.uri} closed.`);
});
*/

function getHtmlDocFor(className) : Thenable<string> {
    
    return connection.sendRequest({ method: "getRootPath" })
    .then( (rootPath : string) => {
        
        let fileName : string =  rootPath.replace(/\\/g, '/') + '/' + className + '.html';
        let content : string = '';
        content += '<html>\n';
        content += '  <head><title>' + className + ' documentation</title></head>\n';
        content += '  <body>\n';
        content += '    <blockquote>';
        content += '      <h1 style="color: red;">' + className + ' summary</h1>\n';
        content += '      <p>' + metainfo[className].documentation.replace(/\n/g, "<br/>") + '      </p>\n';
        
        content += '      <h1 style="color: red;">' + className + ' parents</h1>\n';
        
        let indent : string = '';
        
        for (var index = metainfo[className].parents.length - 1; index >=0 ; index--) {
            content += indent + '<a href="file:///' + rootPath + '/'+ 
                metainfo[className].parents[index].label + '.gold">' +
                metainfo[className].parents[index].label + '</a><br/>\n';
                
            indent += '&nbsp;&nbsp;&nbsp;';
        }
        
        content += '      <h1 style="color: red;">' + className + ' descendants</h1>\n';
        content += '      <ul>\n';
        indent = '';
        
        for (var index = 0; index < metainfo[className].childs.length; index++) {
            content += indent + '        <li><a href="file:///' + rootPath + '/'+ 
                metainfo[className].childs[index].label + '.gold">' +
                metainfo[className].childs[index].label + '</a></li>\n';
                
            // indent += '&nbsp;&nbsp;&nbsp;';
        }
        
        content += '      </ul>\n';
        
        
        content += '      <h1 style="color: red;">' + className + ' sisters</h1>\n';
        content += '      <ul>\n';
        indent = '';
        
        for (var index = 0; index <  metainfo[className].sisters.length; index++) {
            content += '        <li><a href="file:///' + rootPath + '/'+ 
                metainfo[className].sisters[index].label + '.gold">' +
                metainfo[className].sisters[index].label + '</a></li>\n';
        }
        
        content += '      </ul>\n';

        content += '    </blockquote>';
        content += '  </body>\n';
        content += '</html>\n';
        
        // fs.writeFile(fileName, content);
        return content;
    });
}

function updateMetaInfoForClass(classname : string, source : string) : Thenable<tMetaInfo> {

    // var _rp = rp(
    // {
    //     method: 'GET',
    //     uri: url + '/api/rest/repository/path', 
    //     json: true
    // });
    
    // _rp.then( (response) => {
    //     ewamPath = response._Result;
    // });
    
    var _rp = rp(
    {
        method: 'GET',
        uri: url + '/api/rest/classOrModule/' + classname + '/metainfo', 
        body: {
            "name": classname,
            "ancestor": "",
            "content": source
        },
        json: true
    });
    
    return _rp
    .then( (response) => {
        if (metainfo == undefined) {
            metainfo = [];
        }
        metainfo[classname] = response;
        return getHtmlDocFor(classname)
    .then( (result : string) => {
        connection.console.log('Successfully updated meta-information. \n' + response);
        return metainfo[classname];
    })
    })
    .catch( (response) => {
        delete metainfo[classname];
        connection.console.log('Error while updating meta-information. \n' + response);
    });       
}

function getOutlineAt(position : Position, modulename : string) : tOutline {
    let result : tOutline = null;
    
    for (var index = 0; index < metainfo[modulename].outlines.length; index++) {
        
        if (position.line < metainfo[modulename].outlines[index].range.startpos.line || 
            position.line > metainfo[modulename].outlines[index].range.endpos.line)
            continue;
            
        if (position.line == metainfo[modulename].outlines[index].range.startpos.line && 
            position.character < metainfo[modulename].outlines[index].range.startpos.column)
            continue;
            
        if (position.line == metainfo[modulename].outlines[index].range.endpos.line && 
            position.character > metainfo[modulename].outlines[index].range.endpos.column)
            continue;
            
        result = metainfo[modulename].outlines[index];
    }
    
    return result;
}

connection.onHover((textDocumentPosition: TextDocumentPositionParams) : Thenable<Hover> | Hover => {
    
    var className = textDocumentPosition.textDocument.uri.substring(
        textDocumentPosition.textDocument.uri.lastIndexOf('/') + 1, textDocumentPosition.textDocument.uri.lastIndexOf('.')
    );
    
    if (metainfo == undefined) {
        metainfo = [];
    }
    
    if ( !(className in metainfo) ) {
        updateMetaInfoForClass(className, "")
        .then(
            (meta : tMetaInfo) => {
                let outline : tOutline = getOutlineAt(textDocumentPosition.position, className);
                 
                return {
                    "range": {
                        "start": {
                            "line": outline.range.startpos.line,
                            "character": outline.range.startpos.column
                        },
                        "end": {
                            "line": outline.range.endpos.line,
                            "character": outline.range.endpos.column
                        }
                    },
                    "contents": [
                        outline.documentation,
                        { "language": "gold", "value": outline.annotation }
                    ]
                }
            }
        );
    } else {
        let outline : tOutline = getOutlineAt(textDocumentPosition.position, className);
            
        return {
            "range": {
                "start": {
                    "line": outline.range.startpos.line,
                    "character": outline.range.startpos.column
                },
                "end": {
                    "line": outline.range.endpos.line,
                    "character": outline.range.endpos.column
                }
            },
            "contents": [
                outline.documentation,
                { "language": "gold", "value": outline.annotation }
            ]
        }
    }
    
    
    
});


interface tParseResult {
    docUri: string,
    newSource: string 
};

//Parse
connection.onRequest({method: "parse"}, 
                     (params : {
                        "classname": string,
                        "source": string,
                        "notifyNewSource" : boolean,
                        "uri" : string }) : Thenable<tParseResult> => 
{
        
    var _rp = rp(
    {
        method: 'POST',
        uri: url + '/api/rest/classOrModule/' + params.classname + '/parse',
        body: 
        {
            "name": params.classname,
            "ancestor": "",
            "content": params.source
        },
        json: true
    });
    
    return _rp.then( (response) => {
        let diagnostics: Diagnostic[] = [];
        
        let result : tParseResult = {docUri:'', newSource:''};
        
        if ("errors" in response && response.errors.length > 0) {
            
            let errors = response["errors"];
            
            for (var index = 0; index < errors.length; index++) {
                diagnostics.push({
                    "severity": DiagnosticSeverity.Error,
                    "range": {
                        "start": { "line": errors[index].line, "character": 0 /*errors[index].offSet-1*/ },
                        "end": { "line": errors[index].line + 1, "character": 0 /*errors[index].offSet*/ }
                    },
                    "message": errors[index].msg
                });
            }
            
            //Successfully parsed or not, send diagnostics anyway. 
            connection.sendDiagnostics({ uri: params.uri, diagnostics });
            
        } else {
            
            //Successfully parsed or not, send diagnostics anyway.
            connection.sendDiagnostics({ uri: params.uri, diagnostics });
            
            if (params.notifyNewSource) {
                updateMetaInfoForClass(params.classname, params.source);
                
                result.docUri = params.uri;
                result.newSource = response.content;
            }
        }
        
        return result;
    });
});

connection.onRequest({method: "save"} , 
                     (params : {
                        "classname": string,
                        "source": string,
                        "notifyNewSource" : boolean,
                        "uri" : string }) : Thenable<tParseResult> => 
{
        
    var _rp= rp(
    {
        method: 'POST',
        uri: url + '/api/rest/classOrModule/' + params.classname + '/save',
        body: 
        {
            "name": params.classname,
            "ancestor": "",
            "content": params.source
        },
        json: true
    });
    
    return _rp.then( (response) => {
        
        let diagnostics: Diagnostic[] = [];
        
        let result : tParseResult = {docUri:'', newSource:''};
        
        if ("errors" in response && response.errors.length > 0) {
            
            let errors = response["errors"];
            
            for (var index = 0; index < errors.length; index++) {
                diagnostics.push({
                    "severity": DiagnosticSeverity.Error,
                    "range": {
                        "start": { "line": errors[index].line, "character": 0 /*errors[index].offSet-1*/ },
                        "end": { "line": errors[index].line + 1, "character": 0 /*errors[index].offSet*/ }
                    },
                    "message": errors[index].msg
                });
            }
            
            //Successfully parsed or not, send diagnostics anyway. 
            connection.sendDiagnostics({ uri: params.uri, diagnostics });
            
        } else {
            
            //Successfully parsed or not, send diagnostics anyway. 
            connection.sendDiagnostics({ uri: params.uri, diagnostics });
            
            if (params.notifyNewSource) {
                updateMetaInfoForClass(params.classname, params.source);
                result.docUri = params.uri;
                result.newSource = response.content;
            }
        }
        
        return result;
        
    });
});

function getMetaInfoFor(className : string, uri : string) : SymbolInformation[] {
    let result : SymbolInformation[] = [];

    for (var index = 0; index < metainfo[className].variables.length; index++) {
        result.push({
            "name": metainfo[className].variables[index].name + " : " + metainfo[className].variables[index].variableType,
            "kind": getCompletionKindFromEntityClass(metainfo[className].variables[index].entity.theType),
            "location": {
                "uri": uri,
                "range": {
                    "start": {
                        "line": metainfo[className].variables[index].range.startpos.line,
                        "character": metainfo[className].variables[index].range.startpos.column
                    },
                    "end": {
                        "line": metainfo[className].variables[index].range.endpos.line,
                        "character": metainfo[className].variables[index].range.endpos.column
                    }
                }
            },
            "containerName": className
        });
    }
    
    for (var index = 0; index < metainfo[className].methods.length; index++) {
        
        let parameters : string = '';
        
        for (var paramRank = 0; paramRank < metainfo[className].methods[index].parameters.length; paramRank++) {
            if (paramRank >= 1)
                parameters += ', ';
                
            parameters += metainfo[className].methods[index].parameters[paramRank].name + ' : ' + 
                metainfo[className].methods[index].parameters[paramRank].paramType
        }
        
        result.push({
            "name": metainfo[className].methods[index].name + '(' + parameters + ')',
            "kind": getCompletionKindFromEntityClass(metainfo[className].methods[index].entity.theType),
            "location": {
                "uri": uri,
                "range": {
                    "start": {
                        "line": metainfo[className].methods[index].range.startpos.line,
                        "character": metainfo[className].methods[index].range.startpos.column
                    },
                    "end": {
                        "line": metainfo[className].methods[index].range.endpos.line,
                        "character": metainfo[className].methods[index].range.endpos.column
                    }
                }
            },
            "containerName": className
        });
    }
    
    for (var index = 0; index < metainfo[className].types.length; index++) {
        result.push({
            "name": metainfo[className].types[index].name,
            "kind": getCompletionKindFromEntityClass(metainfo[className].types[index].entity.theType),
            "location": {
                "uri": uri,
                "range": {
                    "start": {
                        "line": metainfo[className].types[index].range.startpos.line,
                        "character": metainfo[className].types[index].range.startpos.column
                    },
                    "end": {
                        "line": metainfo[className].types[index].range.endpos.line,
                        "character": metainfo[className].types[index].range.endpos.column
                    }
                }
            },
            "containerName": className
        });
    }
    
    return result;

}

connection.onDocumentSymbol( 
    (docIdentifier : TextDocumentPositionParams) : SymbolInformation[] | Thenable<SymbolInformation[]> => 
    {
        var className = docIdentifier.textDocument.uri.substring(
            docIdentifier.textDocument.uri.lastIndexOf('/') + 1, docIdentifier.textDocument.uri.lastIndexOf('.')
        );
        
        // If class name isn't found, bail out
        if (metainfo == undefined) {
            metainfo = [];
        }
        
        if ( !(className in metainfo) ) {
            return updateMetaInfoForClass(className, "")
            .then((meta : tMetaInfo) => {
                return getMetaInfoFor(className, docIdentifier.textDocument.uri);
            });
        } else {
            return getMetaInfoFor(className, docIdentifier.textDocument.uri);
        }
    }
);

function FindDefinition(identifier : string, ownerName : string) : Thenable<tRange>
{
    return updateMetaInfoForClass(ownerName, "").then(
        (meta : tMetaInfo) : tRange => {
            for (var index = 0; index < meta.outlines.length; index++) {
                
                if (meta.methods[index].name == identifier) {
                    return meta.methods[index].range;
                    
                } else if (meta.variables[index].name == identifier) {
                    return meta.variables[index].range;
                    
                } else if (meta.constants[index].name == identifier) {
                    return meta.constants[index].range;
                    
                } else if (meta.types[index].name == identifier) {
                    return meta.types[index].range;
                    
                }
            }
            return null; 
        }
    );
}

connection.onDefinition(
    (position : TextDocumentPositionParams) : Definition | Thenable<Definition> => {
    // export declare type Definition = Location | Location[];
    // export interface Location {
    //     uri: string;
    //     range: Range;
    // }
    let moduleName : string = 
        position.textDocument.uri.substring(
            position.textDocument.uri.lastIndexOf('/') + 1, position.textDocument.uri.lastIndexOf('.') );
    
    let outline : tOutline = getOutlineAt(position.position, moduleName);

    // let repoReq = rp({
    //     method: 'GET',
    //     uri: url + '/api/rest/repository/path', 
    //     json: true });
        
    // outline.entity is defined in a class or module
    // Get definition position inside the owner
    if (outline.entity.exactType == "aLocalVarDesc") {
        
        let definitionReq = rp({
            method: 'GET',
            uri: url + '/api/rest/classOrModule/' + outline.entity.ownerName + '/definition/' + outline.name,
            json: true });
        
        
        for (var index = 0; index < metainfo[moduleName].locals.length; index++) {
        
            if (outline.entity.location == metainfo[moduleName].locals[index].entity.location) {
                return {
                    uri: position.textDocument.uri,
                    range : {
                        "start": {
                            "line": metainfo[moduleName].locals[index].range.startpos.line,
                            "character": metainfo[moduleName].locals[index].range.startpos.column
                        },
                        "end": {
                            "line": metainfo[moduleName].locals[index].range.endpos.line,
                            "character": metainfo[moduleName].locals[index].range.endpos.column
                        }
                    }
                };
            }
        }
                
        
    } else if (outline.entity.ownerName != "") {
        
        let definitionReq = rp({
            method: 'GET',
            uri: url + '/api/rest/classOrModule/' + outline.entity.ownerName + '/definition/' + outline.name,
            json: true });
            
        let contentReq = rp({
            method: 'GET',
            uri: url + '/api/rest/classOrModule/' + outline.entity.ownerName,
            json: true });
                    
        return connection.sendRequest({ method: "getRootPath" })
        .then( (rootPath : string) => {
            let repoPath = rootPath.replace(/\\/g, '/');
            return definitionReq
        .then((defRange : tRange) => {
            // Retrive the owner content
            return contentReq
        .then((response) => {
            fs.writeFile(repoPath + "/" + outline.entity.ownerName + ".gold", response["content"]);
            
            return {
                uri: "file:///" + repoPath + "/" + outline.entity.ownerName + ".gold",
                range : {
                    "start": {
                        "line": defRange.startpos.line,
                        "character": defRange.startpos.column
                    },
                    "end": {
                        "line": defRange.endpos.line,
                        "character": defRange.endpos.column
                    }
                }
            };
        });
        });        
        });
        
    } else {
    // outline.entity a class or module
    // Give difinition of the class, with position 0
    
        let contentReq = rp({
            method: 'GET',
            uri: url + '/api/rest/classOrModule/' + outline.name,
            json: true });
            
        return connection.sendRequest({ method: "getRootPath" })
        .then( (rootPath : string) => {
            let repoPath = rootPath.replace(/\\/g, '/');
            // Retrive the owner content
            return contentReq
        .then((response) => { 
            fs.writeFile(repoPath + "/" + outline.name + ".gold", response["content"]);
            
            return {
                uri: "file:///" + repoPath + "/" + outline.name + ".gold",
                range : {
                    "start": {
                        "line": 0,
                        "character": 0
                    },
                    "end": {
                        "line": 0,
                        "character": 0
                    }
                }
            };
        });
        });
    }
});

connection.onReferences(
    (param : ReferenceParams) : Location[] | Thenable<Location[]> => {
    
    // export interface Location {
    //     uri: string;
    //     range: Range;
    // }
    
    // export interface TextDocumentIdentifier {
    //     uri: string;
    //     languageId: string;
    // }
    // export interface TextDocumentPosition extends TextDocumentIdentifier {
    //     position: Position;
    // }
    // export interface ReferenceContext {
    //     includeDeclaration: boolean;
    // }
    // export interface ReferenceParams extends TextDocumentPosition {
    //     context: ReferenceContext;
    // }
    
    
    // Where used API
    
    var moduleName = param.textDocument.uri.substring(
        param.textDocument.uri.lastIndexOf('/') + 1, param.textDocument.uri.lastIndexOf('.')
    );
    
    let metaClass = metainfo[moduleName];
    
    let outline : tOutline = getOutlineAt(param.position, moduleName);

    let whereUsedReq = rp({
    method: 'GET',
    uri: url + '/api/rest/entity/' + outline.entity.ownerName + '/' + outline.entity.label + '/WhereUsed',
    json: true });
    
    
    return connection.sendRequest({ method: "getRootPath" })
    .then( (rootPath : string) => {
        let fileName : string =  rootPath.replace(/\\/g, '/') + '/' + moduleName + '.gold';
        
        return whereUsedReq
        .then( (whereUsedResult : tWhereUsed[]) : Location[] => {
            let result : Location[] = [];

            for(let index = 0; index < whereUsedResult.length; index++) {;
                result.push({
                    "uri": 'file:///' + rootPath + '/' + whereUsedResult[index].name + '.gold',
                    "range": { 
                        "start": {
                            "line": 0,
                            "character": 0
                        },
                        "end": {
                            "line": 1,
                            "character": 0
                        }
                    }
                });
            }
            
            return result;
        });
    });
    
});

connection.onSignatureHelp(
    (docPosition : TextDocumentPositionParams) : Thenable<SignatureHelp> | SignatureHelp => {
        
    // export interface ParameterInformation {
    //     /**
    //      * The label of this signature. Will be shown in
    //      * the UI.
    //      */
    //     label: string;
    //     /**
    //      * The human-readable doc-comment of this signature. Will be shown
    //      * in the UI but can be omitted.
    //      */
    //     documentation?: string;
    // }

    // /**
    //  * Represents the signature of something callable. A signature
    //  * can have a label, like a function-name, a doc-comment, and
    //  * a set of parameters.
    //  */
    // export interface SignatureInformation {
    //     /**
    //      * The label of this signature. Will be shown in
    //      * the UI.
    //      */
    //     label: string;
    //     /**
    //      * The human-readable doc-comment of this signature. Will be shown
    //      * in the UI but can be omitted.
    //      */
    //     documentation?: string;
    //     /**
    //      * The parameters of this signature.
    //      */
    //     parameters?: ParameterInformation[];
    // }

    // /**
    //  * Signature help represents the signature of something
    //  * callable. There can be multiple signature but only one
    //  * active and only one active parameter.
    //  */
    // export interface SignatureHelp {
    //     /**
    //      * One or more signatures.
    //      */
    //     signatures: SignatureInformation[];
    //     /**
    //      * The active signature.
    //      */
    //     activeSignature?: number;
    //     /**
    //      * The active parameter of the active signature.
    //      */
    //     activeParameter?: number;
    // }    
        
        
    // export interface ParameterInformation {
    //     label: string;
    //     documentation?: string;
    // }
    
    // export interface SignatureInformation {
    //     label: string;
    //     documentation?: string;
    //     parameters?: ParameterInformation[];
    // }
    
    // export interface SignatureHelp {
    //     signatures: SignatureInformation[];
    //     activeSignature?: number;
    //     activeParameter?: number;
    // }
    
    let moduleName : string = docPosition.textDocument.uri.substring(
            docPosition.textDocument.uri.lastIndexOf('/') + 1, docPosition.textDocument.uri.lastIndexOf('.') );
    var lines = documents.get(docPosition.textDocument.uri).getText().split(/\r?\n/g);
    var position = docPosition.position;
    var line = lines[docPosition.position.line];

    
    var body = {
        implem: {
            name: moduleName,
            ancestor: "",
            content: documents.get(docPosition.textDocument.uri).getText()
        },
        lineInfo: {
            lineContent: line,
            lineNumber: position.line,
            columnNumber: position.character
        }
    };
    
    let signatureReq = rp({
        method: 'POST',
        uri: url + '/api/rest/classOrModule/' + moduleName + '/signaturehelp/',
        body: body,
        json: true });
        
    interface signatureHelpResult {
        "methods": 
        [
            {
                "name": string,
                "parameters": [
                    {
                    "name": string,
                    "documentation": string,
                    "paramType": string,
                    "declaration": string
                    }
                ],
                "returnType": string,
                "documentation": string,
                "declaration": string,
                "range": {
                    "startpos": {
                    "line": number,
                    "column": number
                    },
                    "endpos": {
                    "line": number,
                    "column": number
                    }
                }
            }
        ],
        "activeMethod": number,
        "activeParam": number
    }
        
    return signatureReq
        .then((response : signatureHelpResult) : SignatureHelp => {
            let result : SignatureHelp = {
                signatures: [],
                activeSignature: 0,
                activeParameter: 0
            };
            
            result.activeSignature = response.activeMethod;
            result.activeParameter = response.activeParam;
            
            for (var methIndex = 0; methIndex < response.methods.length; methIndex++) {
                
                let method : SignatureInformation = {
                    label: "",
                    documentation: "",
                    parameters: []
                };
                method.documentation = response.methods[methIndex].documentation;
                method.label = response.methods[methIndex].declaration;
                
                for (var paramIndex = 0; paramIndex < response.methods[methIndex].parameters.length; paramIndex++) {
                    let param : ParameterInformation = {
                        label: "",
                        documentation: ""
                    };
                    
                    param.documentation = response.methods[methIndex].parameters[paramIndex].documentation;
                    param.label = response.methods[methIndex].parameters[paramIndex].declaration;
                    
                    method.parameters.push(param);
                }
                
                result.signatures.push(method);
            }
            
            return result;
        });
});

connection.onRequest({method: "getModuleDocumentation"} , 
    (params : {"moduleName": string }) : string | Thenable<string> => {
        if (metainfo == undefined) {
            metainfo = [];
        }
        
        if ( !(params.moduleName in metainfo) ) {
            return updateMetaInfoForClass(params.moduleName, "")
            .then(
                (success) => {
                    return getHtmlDocFor(params.moduleName);
                }
            );
        } else {
            return getHtmlDocFor(params.moduleName);
        }
    }
);

connection.onDocumentFormatting(
    (params : DocumentFormattingParams) : TextEdit[] => {
        
        return null;
    }
)


/* Improve getSymbolKindFromEntityClass and getCompletionKindFromEntityClass using this : 

    function EntityClassToKind(theEntity : aEntity) return Int1
    uses aVarDesc, aConstDesc, aSubRangeType, aBooleanType, aSetType, aRecordVarDesc, 
        aMethodDesc, aClassDef, aScenario
    
    var theType : aType
    
    if member(theEntity, aMethodDesc)
        if Upcase(theEntity.Name) = 'INIT'
            _Result = 4
        elseif aMethodDesc(theEntity).GetResultingType = Nil
            ;_Result = 2 ;<= produces a strange icon in vscode for suggestions
            _Result = 3
        else
            _Result = 3
        endIf
    elseif member(theEntity, aRecordVarDesc)
        _Result = 5
    elseif member(theEntity, aVarDesc)
        theType = aVarDesc(theEntity).GetIdentifierType
        if theType.KindofType in [kListOfInstances, kPointer, kInstance, kFloatingListOfReftos, 
            kRefTo, kListOfRefTos]
            _Result = 18
        elseif member(theType, aSubRangeType) or member(theType, aBooleanType) or member(theType, 
            aSetType)
            _Result = 13
        else
            _Result = 6
        endIf
    elseif member(theEntity, aClassDef)
        _Result = 7
    elseif member(theEntity, aModuleDef)
        _Result = 9
    elseif member(theEntity, aConstDesc)
        _Result = 12
    elseif member(theEntity, aScenario)
        _Result = 8
    else
        _Result = 1
    endIf
    endFunc

 */

function getSymbolKindFromEntityClass(entityClass : string) : number {
    
    // /**
    //  * A symbol kind.
    //  */
    // export declare enum SymbolKind {
    //     File = 1,
    //     Module = 2,
    //     Namespace = 3,
    //     Package = 4,
    //     Class = 5,
    //     Method = 6,
    //     Property = 7,
    //     Field = 8,
    //     Constructor = 9,
    //     Enum = 10,
    //     Interface = 11,
    //     Function = 12,
    //     Variable = 13,
    //     Constant = 14,
    //     String = 15,
    //     Number = 16,
    //     Boolean = 17,
    //     Array = 18,
    // }
    
    let result : number = -1;
    
    switch(entityClass) {
        case "method":
            result = SymbolKind.Method;
            break;
        case "function":
            result = SymbolKind.Function;
            break;
        case "variable":
            result = SymbolKind.Variable;
            break;
        case "field":
            result = SymbolKind.Field;
            break;
        case "module":
            result = SymbolKind.Module;
            break;
        case "class":
            result = SymbolKind.Class;
            break;
        case "constant":
            result = SymbolKind.Constant;
            break;
        case "enum":
            result = SymbolKind.Enum;
            break;
        case "other":
        default:
            result = SymbolKind.Namespace;
            break;
    }
    
    return result;
}

function getCompletionKindFromEntityClass(entityClass : string) : number {
    
    // /**
    //  * The kind of a completion entry.
    //  */
    // export declare enum CompletionItemKind {
    //     Text = 1,
    //     Method = 2,
    //     Function = 3,
    //     Constructor = 4,
    //     Field = 5,
    //     Variable = 6,
    //     Class = 7,
    //     Interface = 8,
    //     Module = 9,
    //     Property = 10,
    //     Unit = 11,
    //     Value = 12,
    //     Enum = 13,
    //     Keyword = 14,
    //     Snippet = 15,
    //     Color = 16,
    //     File = 17,
    //     Reference = 18,
    // }
    
    let result : number = -1;
    
    switch(entityClass) {
        case "method":
            // CompletionItemKind.Method seems to give a strange icon in suggestions...
            // result = CompletionItemKind.Method;
            result = CompletionItemKind.Function;
            break;
        case "function":
            result = CompletionItemKind.Function;
            break;
        case "variable":
            result = CompletionItemKind.Variable;
            break;
        case "field":
            result = CompletionItemKind.Field;
            break;
        case "module":
            result = CompletionItemKind.Module;
            break;
        case "class":
            result = CompletionItemKind.Class;
            break;
        case "constant":
            result = CompletionItemKind.Value;
            break;
        case "enum":
            result = CompletionItemKind.Enum;
            break;
        case "reference":
            result = CompletionItemKind.Reference
            break;
        case "other":
        default:
            result = CompletionItemKind.Keyword;
            break;
    }
    
    return result;
}

connection.onWorkspaceSymbol( 
    (params : WorkspaceSymbolParams) : SymbolInformation[] | Thenable<SymbolInformation[]> => 
    {
        // export interface WorkspaceSymbolParams {
        //     /**
        //      * A non-empty query string
        //      */
        //     query: string;
        // }
        
        // /**
        //  * Represents information about programming constructs like variables, classes,
        //  * interfaces etc.
        //  */
        // export interface SymbolInformation {
        //     /**
        //      * The name of this symbol.
        //      */
        //     name: string;
        //     /**
        //      * The kind of this symbol.
        //      */
        //     kind: number;
        //     /**
        //      * The location of this symbol.
        //      */
        //     location: Location;
        //     /**
        //      * The name of the symbol containing this symbol.
        //      */
        //     containerName?: string;
        // }
        
        // /**
        //  * Represents a location inside a resource, such as a line
        //  * inside a text file.
        //  */
        // export interface Location {
        //     uri: string;
        //     range: Range;
        // }
        
        // /**
        //  * A range in a text document expressed as (zero-based) start and end positions.
        //  */
        // export interface Range {
        //     /**
        //      * The range's start position
        //      */
        //     start: Position;
        //     /**
        //      * The range's end position
        //      */
        //     end: Position;
        // }

        // /**
        //  * Position in a text document expressed as zero-based line and character offset.
        //  */
        // export interface Position {
        //     /**
        //      * Line position in a document (zero-based).
        //      */
        //     line: number;
        //     /**
        //      * Character offset on a line in a document (zero-based).
        //      */
        //     character: number;
        // }
        
        let contentReq = rp({
            method: 'GET',
            uri: url + '/api/rest/searchEntities?q=' + params.query,
            json: true });
        
        return contentReq
        .then( (entities : tEntity[]) => {
            
        return connection.sendRequest({ method: "getRootPath" })
        .then( (rootPath : string) => {
            
            let fileName : string = "";
            let symbols : SymbolInformation[] = [];
            
            for (let index : number = 0; index < entities.length; index++ ) {
                let entity : tEntity = entities[index];
                
                if (entity.exactType == "aModuleDef" || entity.exactType == "aClassDef") { 
                    fileName = rootPath.replace(/\\/g, '/') + '/' + entity.label + '.gold';
                } else {
                    fileName = rootPath.replace(/\\/g, '/') + '/' + entity.ownerName + '.gold';
                }
                
                let symbol : SymbolInformation = {
                    "name": entity.label,
                    "kind": getSymbolKindFromEntityClass(entity.baseType),
                    "containerName": entity.ownerName,
                    "location": {
                        "uri": "file:///" + fileName,
                        "range": {
                            "start": {
                                "line": 0,
                                "character": 0
                            },
                            "end": {
                                "line": 0,
                                "character": 0
                            }
                        } 
                    }
                }
                
                symbols.push(symbol);
            };
            
            return symbols;
        });
            
        });
    }
);

connection.onRenameRequest( (RenameParams) => { return null;} );

connection.onCodeAction( (params : CodeActionParams) : Command[] => {return null;});

// Listen on the connection
connection.listen();