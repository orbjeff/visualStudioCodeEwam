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
    CompletionItem, CompletionItemKind, CompletionList, Hover, CodeActionParams, Command
} from 'vscode-languageserver';

import { TextDocument } from 'vscode';

import * as rp from 'request-promise';

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
                    resolveProvider: true
                },
                hoverProvider: true,
                documentSymbolProvider : true,
                signatureHelpProvider : { triggerCharacters : [ "(" ] },
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
   
   var _rp= rp(
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


interface tOutline {
    beginLine: number,
    beginColumn: number,
    endLine : number,
    endColumn : number,
    annotation : string,
    name : string
}

interface tOutlines {
    name : string,
    outLines : tOutline[]
}

let outlines : tOutlines[];


function updateOutlinesForClass(classname : string, source : string) : void {
    
    var _rp= rp(
    {
        method: 'GET',
        uri: url + '/api/rest/classOrModule/' + classname + '/Outlines', 
        body: {
            "name": classname,
            "ancestor": "",
            "content": source
        },
        json: true
    });
    
    _rp.then( (response) => {
            outlines[classname] = response;
            return outlines[classname];
        })
        .catch( (response) => {
            connection.console.log('Error while updating outlines. \n' + response);
        });
        
}

connection.onHover((textDocumentPosition: TextDocumentPosition) : Hover => {
    
    var className = textDocumentPosition.uri.substring(
        textDocumentPosition.uri.lastIndexOf('/') + 1, textDocumentPosition.uri.lastIndexOf('.')
    );
    
    if (outlines == undefined) {
        outlines = [];
    }
    
    if ( !(className in outlines) ) {
        return null;
    }
    
    var result : Hover;
    
    for (var index = 0; index < outlines[className].outlines.length; index++) {
        if (textDocumentPosition.position.line >= outlines[className].outlines[index].beginLine &&
            textDocumentPosition.position.line <= outlines[className].outlines[index].endLine && 
            textDocumentPosition.position.character >= outlines[className].outlines[index].beginColumn &&
            textDocumentPosition.position.character <= outlines[className].outlines[index].endColumn)
        {
            result = {
                "range": {
                    "start": {
                        "line": outlines[className].outlines[index].beginLine,
                        "character": outlines[className].outlines[index].beginColumn
                    },
                    "end": {
                        "line": outlines[className].outlines[index].endLine,
                        "character": outlines[className].outlines[index].endColumn
                    }
                },
                "contents": [
                    outlines[className].outlines[index].documentation,
                    { "language": "gold", "value": outlines[className].outlines[index].annotation }
                ]
            }
            break;
        }
    }
    
    return result;
});


//Parse
connection.onRequest(
    {method: "parse"} , 
    (params : {"classname": string, "source": string, notifyNewSource : boolean, textDocument : TextDocument} ) : void => {
        
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
            updateOutlinesForClass(params.classname, params.source);
            if (params.notifyNewSource) {
                connection.sendRequest(
                    { method: "onParseSuccessful" }, 
                    { docUri: params.textDocument.uri, newSource: response.content}
                );
            }
            
        }
        
        //Successfully parsed or not, send diagnostics anyway. 
        connection.sendDiagnostics({ uri: params.textDocument.uri.external, diagnostics });
    });
});





// Listen on the connection
connection.listen();