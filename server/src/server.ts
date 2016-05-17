/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
    IPCMessageReader, IPCMessageWriter,
    createConnection, IConnection, TextDocumentSyncKind,
    TextDocuments, ITextDocument, Diagnostic, DiagnosticSeverity,
    InitializeParams, InitializeResult, TextDocumentIdentifier, TextDocumentPosition,
    CompletionItem, CompletionItemKind, CompletionList, Hover, CodeActionParams, Command,
    SymbolInformation, ReferenceParams, Position, SignatureHelp, ParameterInformation, 
    SignatureInformation, Range, RenameParams, WorkspaceSymbolParams
} from 'vscode-languageserver';

import { Definition, TextDocument, Location } from 'vscode';
// import * as vscode from 'vscode';
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
                signatureHelpProvider : { triggerCharacters : [ "(", ",", "." ] },
                definitionProvider : true,
                referencesProvider : true
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

function validateTextDocument(textDocument: ITextDocument): void {
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

function transform(response:CompletionList): CompletionList {
    
    for (var item of response.items){
        if (item["name"] != undefined)
             item["label"]=item["name"];
    }
    
    return response;
}

// This handler provides the initial list of the completion items.
connection.onCompletion((textDocumentPosition: TextDocumentPosition) : Thenable<CompletionList> => {
   //
    var lines = documents.get(textDocumentPosition.uri).getText().split(/\r?\n/g);

    var position = textDocumentPosition.position;
    var line = lines[position.line];
    var className = textDocumentPosition.uri.substring(
        textDocumentPosition.uri.lastIndexOf('/') + 1, textDocumentPosition.uri.lastIndexOf('.')
    );
    
    var body = {
        implem: {
            name: className,
            ancestor: "",
            content: documents.get(textDocumentPosition.uri).getText()
        },
        lineInfo: {
            lineContent: line,
            lineNumber: position.line,
            columnNumber: position.character
        }
    };

   //var _rp=  rp({ method: 'POST', uri: url + '/api/rest/classOrModule/' + className + '/Suggest', json: true, body: body });
   
   var _rp = rp(
       {    
           method: 'POST',
           uri: url + '/aMRS_ActiveModelService/suggest', 
           json: true,
           body: {body: body}
        });
    //return thenable;
    
    return _rp.then( (response) => transform(response) );
 
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

interface tPositionRange {
    line : number,
    column : number
}


interface tEntity {
    label: string,
    name: string,
    ownerName: string,
    theType: string,
    location: string,
    description: string
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
    kind : number,
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

function createDocFileFor(className) : Thenable<string> {
    
    return connection.sendRequest({ method: "getRootPath" })
    .then( (rootPath : string) => {
        
        let fileName : string =  rootPath.replace(/\\/g, '/') + '/' + className + '.html';
        let content : string = '';
        content += '<html>\n';
        content += '  <head><title>' + className + ' documentation</title></head>\n';
        content += '  <body>\n';
        content += '    <blockquote>';
        content += '      <h1>' + className + ' summary</h1>\n';
        content += '      <p>' + metainfo[className].documentation.replace(/\n/g, "<br/>") + '      </p>\n';
        content += '      <h1>' + className + ' parents</h1>\n';
        
        let indent : string = '';
        
        for (var index = metainfo[className].parents.length - 1; index >=0 ; index--) {
            content += indent + '<a href="file:///' + rootPath + '/'+ 
                metainfo[className].parents[index].label + '.gold">' +
                metainfo[className].parents[index].label + '</a><br/>\n';
                
            indent += '&nbsp;&nbsp;&nbsp;';
        }
        
        content += '      <h1>' + className + ' descendants</h1>\n';
        indent = '';
        
        for (var index = 0; index < metainfo[className].childs.length; index++) {
            content += indent + '<a href="file:///' + rootPath + '/'+ 
                metainfo[className].childs[index].label + '.gold">' +
                metainfo[className].childs[index].label + '</a><br/>\n';
                
            indent += '&nbsp;&nbsp;&nbsp;';
        }
        
        content += '      <h1>' + className + ' sisters</h1>\n';
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
        
        fs.writeFile(fileName, content);
        return fileName;
    });
}

function updateMetaInfoForClass(classname : string, source : string) : Thenable<tMetaInfo> {
    
    var _rp = rp(
    {
        method: 'GET',
        uri: url + '/api/rest/repository/path', 
        json: true
    });
    
    _rp.then( (response) => {
        ewamPath = response._Result;
    });
    
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
    
    metainfo[classname] = {};
    return _rp
    .then( (response) => {
            if (metainfo == undefined) {
                metainfo = [];
            }
            metainfo[classname] = response;
            return createDocFileFor(classname)
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

connection.onHover((textDocumentPosition: TextDocumentPosition) : Thenable<Hover> | Hover => {
    
    var className = textDocumentPosition.uri.substring(
        textDocumentPosition.uri.lastIndexOf('/') + 1, textDocumentPosition.uri.lastIndexOf('.')
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


//Parse
connection.onRequest({method: "parse"} , 
                     (params : {
                        "classname": string,
                        "source": string,
                        "notifyNewSource" : boolean,
                        "textDocument" : TextDocument }) : void => 
{
        
    var _rp= rp(
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
    
    _rp.then( (response) => {
        
        let diagnostics: Diagnostic[] = [];
        
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
        } else {
            if (params.notifyNewSource) {
                updateMetaInfoForClass(params.classname, params.source)
                .then(
                    (meta : tMetaInfo) => {
                        connection.sendRequest(
                            { method: "onParseSuccessful" }, 
                            { docUri: params.textDocument.uri, newSource: response.content}
                        );
                    }
                );
            }
        }
        
        //Successfully parsed or not, send diagnostics anyway. 
        connection.sendDiagnostics({ uri: params.textDocument.uri.external, diagnostics });
    });
});


connection.onRequest({method: "save"} , 
                     (params : {
                        "classname": string,
                        "source": string,
                        "notifyNewSource" : boolean,
                        "textDocument" : TextDocument }) : void => 
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
    
    _rp.then( (response) => {
        
        let diagnostics: Diagnostic[] = [];
        
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
        } else {
            if (params.notifyNewSource) {
                updateMetaInfoForClass(params.classname, params.source)
                .then(
                    (meta : tMetaInfo) => 
                    {
                        connection.sendRequest(
                            { method: "onSaveSuccessful" },
                            { docUri: params.textDocument.uri, newSource: response.content}
                        );
                    }
                );
            }
        }
        
        //Successfully parsed or not, send diagnostics anyway. 
        connection.sendDiagnostics({ uri: params.textDocument.uri.external, diagnostics });
    });
});


/*
    ;VS CODE enum CompletionItemKind {
    ;    Text = 1,
    ;    Method = 2,
    ;    Function = 3,
    ;    Constructor = 4,
    ;    Field = 5,
    ;    Variable = 6,
    ;    Class = 7,
    ;    Interface = 8,
    ;    Module = 9,
    ;    Property = 10,
    ;    Unit = 11,
    ;    Value = 12,
    ;    Enum = 13,
    ;    Keyword = 14,
    ;    Snippet = 15,
    ;    Color = 16,
    ;    File = 17,
    ;    Reference = 18,
    ;}
*/

function getMetaInfoFor(className : string, uri : string) : SymbolInformation[] {
    let result : SymbolInformation[] = [];

    for (var index = 0; index < metainfo[className].variables.length; index++) {
        result.push({
            "name": metainfo[className].variables[index].name + " : " + metainfo[className].variables[index].variableType,
            "kind": 5,
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
            "kind": 2,
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
            "kind": 13,
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
    (docIdentifier : TextDocumentIdentifier) : SymbolInformation[] | Thenable<SymbolInformation[]> => 
    {
        var className = docIdentifier.uri.substring(
            docIdentifier.uri.lastIndexOf('/') + 1, docIdentifier.uri.lastIndexOf('.')
        );
        
        // If class name isn't found, bail out
        if (metainfo == undefined) {
            metainfo = [];
        }
        
        if ( !(className in metainfo) ) {
            return updateMetaInfoForClass(className, "")
            .then((meta : tMetaInfo) => {
                return getMetaInfoFor(className, docIdentifier.uri);
            });
        } else {
            return getMetaInfoFor(className, docIdentifier.uri);
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

connection.onDefinition((position : TextDocumentPosition) : Definition | Thenable<Definition> => 
{
    // export declare type Definition = Location | Location[];
    // export interface Location {
    //     uri: string;
    //     range: Range;
    // }
    let moduleName : string = 
        position.uri.substring(
            position.uri.lastIndexOf('/') + 1, position.uri.lastIndexOf('.') );
    
    let outline : tOutline = getOutlineAt(position.position, moduleName);

    // let repoReq = rp({
    //     method: 'GET',
    //     uri: url + '/api/rest/repository/path', 
    //     json: true });
        
    // outline.entity is defined in a class or module
    // Get definition position inside the owner
    if (outline.entity.theType == "aLocalVarDesc") {
        
        let definitionReq = rp({
            method: 'GET',
            uri: url + '/api/rest/classOrModule/' + outline.entity.ownerName + '/definition/' + outline.name,
            json: true });
        
        
        for (var index = 0; index < metainfo[moduleName].locals.length; index++) {
        
            if (outline.entity.location == metainfo[moduleName].locals[index].entity.location) {
                return {
                    uri: position.uri,
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
            
        // return repoReq
        // .then((repoPath) => {

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
        return null;
    }
});

connection.onReferences((param : ReferenceParams) : Location[] | Thenable<Location[]> => {
    
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
    
    var moduleName = param.uri.substring(
        param.uri.lastIndexOf('/') + 1, param.uri.lastIndexOf('.')
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

connection.onSignatureHelp((docPosition : TextDocumentPosition) : Thenable<SignatureHelp> | SignatureHelp => {
        
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
    
    let moduleName : string = docPosition.uri.substring(
            docPosition.uri.lastIndexOf('/') + 1, docPosition.uri.lastIndexOf('.') );
    var lines = documents.get(docPosition.uri).getText().split(/\r?\n/g);
    var position = docPosition.position;
    var line = lines[docPosition.position.line];

    
    var body = {
        implem: {
            name: moduleName,
            ancestor: "",
            content: documents.get(docPosition.uri).getText()
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

connection.onWorkspaceSymbol( 
    (params : WorkspaceSymbolParams) : SymbolInformation[] | Thenable<SymbolInformation[]> => 
    {
        // export interface WorkspaceSymbolParams {
        //     /**
        //      * A non-empty query string
        //      */
        //     query: string;
        // }
        
        return null;
    }
);

connection.onRenameRequest( (RenameParams) => { return null;} );

connection.onCodeAction( (params : CodeActionParams) : Command[] => {return null;});

// Listen on the connection
connection.listen();