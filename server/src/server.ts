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
   TextEdit, Location, Definition, SymbolKind, NotificationType, WorkspaceEdit, DidChangeConfigurationParams
} from 'vscode-languageserver';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let rp = require('request-promise');

// Create a connection for the server. The connection uses 
// stdin / stdout for message passing
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// hold the maxNumberOfProblems setting
let url: string;

// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites.
// Note the servers and client are re-initialized if the root path changes, thus, workspaceRoot
// always contains the current root folder. 
let workspaceRoot: string;

interface tRepositoryParams {
   repository_url: string;
   basePath: string;
   workspace_subdir: string;
   dependencies_subdir: string;
}

let repoParams: tRepositoryParams;
let extension: string = ".god";
let isUpdatingMetaInfo: Boolean;

// The settings interface describe the server relevant settings part
interface Settings {
   ewam: EwamSettings;
};

// These are the example settings we defined in the client's package.json
// file
interface EwamSettings {
   url: string;
};

interface tPositionRange {
   line: number,
   column: number
};

interface tCompletionList {
   isComplete: boolean,
   items: tCompletionItem[]
};

interface tCompletionItem {
   name: string,
   documentation: string,
   detail: string,
   insertText: string,
   entity: tEntity
};

interface tEntity {
   name: string,
   ownerName: string,
   exactType: string,
   baseType: string,
   location: string,
   description: string
};

interface tOutlineRange {
   startpos: tPositionRange,
   endpos: tPositionRange
};

interface tOutline {
   range: tOutlineRange,
   annotation: string,
   produceGold: string,
   documentation: string,
   name: string,
   entity: tEntity
};

interface tPosition {
   line: number,
   column: number
};

interface tRange {
   startpos: tPosition,
   endpos: tPosition
};

interface tVariable {
   name: string,
   variableType: string,
   documentation: string,
   range: tRange,
   entity: tEntity
};

interface tParameter {
   name: string,
   documentation: string,
   paramType: string
};

interface tMethod {
   name: string,
   parameters: tParameter[],
   returnType: string,
   documentation: string,
   range: tRange,
   entity: tEntity
};

interface tType {
   name: string,
   documentation: string,
   range: tRange,
   entity: tEntity
};

interface tConstant {
   name: string,
   documentation: string,
   range: tRange,
   entity: tEntity
};

interface tClassInfo {
   lastKnownImplemVersion: number;
   metaInfo: tMetaInfo;
};

interface tMetaInfo {
   moduleName: string;
   documentation: string;
   variables: tVariable[];
   locals: tVariable[];
   methods: tMethod[];
   constants: tConstant[];
   types: tType[];
   parents: tEntity[];
   childs: tEntity[];
   sisters: tEntity[];
   outlines: tOutline[];
};

interface tWhereUsed {
   name: string,
   ownerName: string,
   theType: string,
   location: string,
   description: string
};

interface tMethodAtLineParam {
   "classname": string,
   "line": number 
};

interface tParseParam {
   "classname": string,
   "source": string,
   "notifyNewSource": boolean,
   "uri": string
};

let classInfo: { [modulename: string]: tClassInfo; } = {};
let ewamPath: string;
let workPath: string;


connection.onInitialize(
   (params): InitializeResult => {
      connection.console.log("Initialization : " + params.rootPath);

      workspaceRoot = params.rootPath;

      repoParams = {
         "repository_url": "",
         "basePath": params.rootPath,
         "workspace_subdir": "",
         "dependencies_subdir": ".dependencies"
      }

      isUpdatingMetaInfo = false;

      return {
         capabilities: {

            // Tell the client that the server works in FULL text document sync mode
            textDocumentSync: documents.syncKind,
            // Tell the client that the server support code complete
            completionProvider: {
               resolveProvider: false,
               triggerCharacters: [".", "(", ",", ":", "["]
            },
            hoverProvider: true,
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            signatureHelpProvider: { triggerCharacters: ["(", ",", "."] },
            definitionProvider: true,
            referencesProvider: true,
            documentFormattingProvider: true,
            renameProvider: true
         }
      };
   }
);

connection.onShutdown(
   () => {
      saveCache();
   }
);

connection.onExit(
   () => {
      saveCache();
   }
);

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
   validateTextDocument(change.document);
});

// documents.onDidSave((change) => {
//    let className : string = change.document.uri.substring(
//       change.document.uri.lastIndexOf('\\'),
//       change.document.uri.lastIndexOf('.')
//    );

//    updateMetaInfoForClass(className, '');
// });

// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
   console.log("Loading configuration");

   let settings = <Settings>change.settings;
   url = settings.ewam.url || 'http://1.2.3.4:1/';
   // Revalidate any open text documents
   documents.all().forEach(validateTextDocument);
   
   loadCache();
   refreshBundleCache();
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
   // connection.console.log('We received an file change event');
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
   (textDocumentPosition: TextDocumentPositionParams): Thenable<CompletionList> => {

      // console.log("Completion request: " + JSON.stringify(textDocumentPosition));
      var lines = documents.get(textDocumentPosition.textDocument.uri).getText().split(/\r?\n/g);

      var position = textDocumentPosition.position;
      var line = lines[position.line];
      var className = textDocumentPosition.textDocument.uri.substring(
         textDocumentPosition.textDocument.uri.lastIndexOf('/') + 1, textDocumentPosition.textDocument.uri.lastIndexOf('.')
      );

      var suggestParams = {
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

      var _rp = rp({
         method: 'POST',
         uri: url + '/ewam/api/rest/classOrModule/' + className + '/suggest',
         json: true,
         body: { "suggestParams": suggestParams }
      });

      return _rp.then((response: tCompletionList) => {
         // console.log("Completion response...." /* + JSON.stringify(response)*/ );

         let result: CompletionList = {
            "isIncomplete": !response.isComplete,
            "items": []
         };

         for (let index: number = 0; index < response.items.length; index++) {
            result.items.push({
               "label": response.items[index].name,
               "kind": getCompletionKindFromEntityClass(response.items[index].entity.baseType),
               "detail": response.items[index].detail,
               "documentation": response.items[index].documentation,
               "insertText": response.items[index].insertText
            });
            
            // console.log("   " + JSON.stringify({
            //    "label": response.items[index].label,
            //    "kind": getCompletionKindFromEntityClass(response.items[index].entity.baseType),
            //    "detail":  response.items[index].detail,
            //    "documentation": response.items[index].documentation,
            //    "insertText": response.items[index].insertText
            // }) + "\n");
         }

         // console.log("Completion result: " + JSON.stringify(result));

         return result;
      }).catch((rejectReason) => {
         connection.window.showErrorMessage("Error: " + rejectReason);
         return {
            "isIncomplete": true,
            "items": []
         };
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

function getHtmlDocFor(className): string {
   let fileName: string = repoParams.basePath.replace(/\\/g, '/') + '/' + className + '.html';
   let content: string = '';
   content += '<html>\n';
   content += '  <head><title>' + className + ' documentation</title></head>\n';
   content += '  <body>\n';
   content += '    <blockquote>';
   content += '      <h3 style="color: #ffffff;">' + className + ' summary</h3>\n';
   content += '      <p>' + classInfo[className].metaInfo.documentation.replace(/\n/g, "<br/>") + '      </p>\n';

   content += '      <h3 style="color: #ffffff;">' + className + ' parents</h3>\n';

   let indent: string = '';

   for (var index = classInfo[className].metaInfo.parents.length - 1; index >= 0; index--) {
      content += indent + '<a style="color: #338eff;" href="file:///' +
         getModulePath(classInfo[className].metaInfo.parents[index].name) + '\\' +
         classInfo[className].metaInfo.parents[index].name + '.god">' +
         classInfo[className].metaInfo.parents[index].name + '</a><br/>\n';

      indent += '&nbsp;&nbsp;&nbsp;';
   }

   content += '      <h3 style="color: #ffffff;">' + className + ' descendants</h3>\n';
   content += '      <ul>\n';
   indent = '';

   for (var index = 0; index < classInfo[className].metaInfo.childs.length; index++) {
      content += indent + '        <li><a style="color: #338eff;" href="file:///' +
         getModulePath(classInfo[className].metaInfo.childs[index].name) + '\\' +
         classInfo[className].metaInfo.childs[index].name + '.god">' +
         classInfo[className].metaInfo.childs[index].name + '</a></li>\n';

      // indent += '&nbsp;&nbsp;&nbsp;';
   }

   content += '      </ul>\n';


   content += '      <h3 style="color: #ffffff;">' + className + ' sisters</h3>\n';
   content += '      <ul>\n';
   indent = '';

   for (var index = 0; index < classInfo[className].metaInfo.sisters.length; index++) {
      content += '        <li><a style="color: #338eff;" href="file:///' +
         getModulePath(classInfo[className].metaInfo.sisters[index].name) + '\\' +
         classInfo[className].metaInfo.sisters[index].name + '.god">' +
         classInfo[className].metaInfo.sisters[index].name + '</a></li>\n';
   }

   content += '      </ul>\n';

   content += '    </blockquote>';
   content += '  </body>\n';
   content += '</html>\n';

   // fs.writeFile(fileName, content);
   return content;
}

function updateLastImplemVersion(className: string) {

   // console.log("updateLastImplemVersion...");
   var _rp = rp(
      {
         method: 'GET',
         uri: url + '/ewam/api/rest/classOrModule/' + className + '/entityStatus',
         json: true
      });

   return _rp.then((statusResponse) => {
      // console.log("Got new implem version for \"" + className + "\": " + JSON.stringify(statusResponse["implemVersion"]));
      classInfo[className].lastKnownImplemVersion = statusResponse["implemVersion"];
      //  console.log("New implem version for \"" + className + "\": " + classInfo[className].lastKnownImplemVersion + " | " + JSON.stringify(classInfo[className].metaInfo));
   }).catch((rejectReason) => {
      connection.window.showErrorMessage("Error: " + rejectReason);
   });

}

function updateMetaInfoForClass(classname: string, source: string): Thenable<tMetaInfo> {

   if (isUpdatingMetaInfo == true || classname == undefined || classname == '') {
        //let dummyMetaInfo : tMetaInfo;
        let dummyPromise : Thenable<tMetaInfo>;
        //let dummyPromise = new Promise(() => { return dummyMetaInfo });
        return dummyPromise;
   }

   var _rp = rp(
      {
         method: 'GET',
         uri: url + '/ewam/api/rest/classOrModule/' + classname + '/metainfo',
         // body: {
         //    "implem" : {
         //       "name": classname,
         //       "ancestor": "",
         //       "content": source
         //    }
         // },
         json: true
      });

   isUpdatingMetaInfo = true;

   return _rp.then((response) => {
      // if (classInfo == undefined) {
      //    classInfo = [];
      // }
      if (!(classname in classInfo)) {
         classInfo[classname] = {
            "lastKnownImplemVersion": -1,
            "metaInfo": response
         };
      } else {
         classInfo[classname].metaInfo = response;
      }

      let htmlDoc = getHtmlDocFor(classname);
      // connection.console.log('Successfully updated meta-information. \n' + JSON.stringify(response));
      isUpdatingMetaInfo = false;

      return classInfo[classname].metaInfo;
   }).catch((rejectReason) => {
      connection.window.showErrorMessage("Error: " + rejectReason);
      // delete classInfo[classname].metaInfo;
      // connection.console.log('Error while updating meta-information. \n' /*+ rejectReason*/ );
      isUpdatingMetaInfo = false;
   });
}

function getOutlineAt(position: Position, modulename: string): tOutline {
   let result: tOutline = null;

   if (classInfo[modulename].metaInfo == null || classInfo[modulename].metaInfo == undefined) {
      return null;
   }

   for (var index = 0; index < classInfo[modulename].metaInfo.outlines.length; index++) {

      if (position.line < classInfo[modulename].metaInfo.outlines[index].range.startpos.line ||
         position.line > classInfo[modulename].metaInfo.outlines[index].range.endpos.line)
         continue;

      if (position.line == classInfo[modulename].metaInfo.outlines[index].range.startpos.line &&
         position.character < classInfo[modulename].metaInfo.outlines[index].range.startpos.column)
         continue;

      if (position.line == classInfo[modulename].metaInfo.outlines[index].range.endpos.line &&
         position.character > classInfo[modulename].metaInfo.outlines[index].range.endpos.column)
         continue;

      result = classInfo[modulename].metaInfo.outlines[index];
   }

   return result;
}

connection.onHover((textDocumentPosition: TextDocumentPositionParams): Thenable<Hover> | Hover => {

   var className = textDocumentPosition.textDocument.uri.substring(
      textDocumentPosition.textDocument.uri.lastIndexOf('/') + 1, textDocumentPosition.textDocument.uri.lastIndexOf('.')
   );

   // console.log('onHover: ' + className + ' : ' + textDocumentPosition.textDocument.uri);

   if (classInfo == undefined) {
      classInfo = {};
   }

   if (!(className in classInfo)) {
      updateMetaInfoForClass(className, "")
         .then(
         (meta: tMetaInfo) => {
            let outline: tOutline = getOutlineAt(textDocumentPosition.position, className);

            if (outline == null || outline == undefined)
               return null;

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
      let outline: tOutline = getOutlineAt(textDocumentPosition.position, className);

      if (outline == null || outline == undefined)
         return null;

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

connection.onRequest({ method: "loadCache" },
   () => {
      loadCache();
      return;
   });

function loadCache() {
   console.log("Loading metainfo cache from '" + workspaceRoot + "\\.tmp\\ewamcache.json'");

   if (fs.existsSync(workspaceRoot + "\\.tmp\\ewamcache.json")) {
      let cacheString: string = fs.readFileSync(workspaceRoot + "\\.tmp\\ewamcache.json", 'utf8');

      try {
         classInfo = JSON.parse(cacheString);
      } catch (deSerializationError) {
         console.log("Error loading cache: " + deSerializationError);
      }
   }
}

connection.onRequest({ method: "saveCache" },
   () => {
      saveCache();
      return;
   });

function saveCache() {
   console.log("Saving metainfo cache to '" + workspaceRoot + "\\.tmp\\ewamcache.json' ...");

   if (classInfo == undefined) {
      return;
   }

   try {

      if (!fs.existsSync(workspaceRoot + "\\.tmp\\")) {
         fs.mkdir(workspaceRoot + "\\.tmp\\");
      }

      fs.writeFileSync(workspaceRoot + "\\.tmp\\ewamcache.json", JSON.stringify(classInfo));
   } catch (saveError) {
      console.log("Error saving cache file '" + workspaceRoot + "\\.tmp\\ewamcache.json' : " + saveError);
   }
}

//Parse
connection.onRequest<tParseParam, tParseResult, {}> ({ method: "parse" }, (params: tParseParam) : Thenable<tParseResult> => {
   var _rp = rp(
      {
         method: 'POST',
         uri: url + '/ewam/api/rest/classOrModule/' + params.classname + '/parse',
         body:
         {
            "implem": {
               "name": params.classname,
               "ancestor": "",
               "content": params.source
            }
         },
         json: true
      });

   //  console.log(JSON.stringify(params));

   return _rp.then((response) => {
      let diagnostics: Diagnostic[] = [];

      let result: tParseResult = { docUri: '', newSource: '' };

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
            //  console.log("params: " + JSON.stringify(params));
            //  console.log("result: " + JSON.stringify(result));
         }
      }

      return result;
   }).catch((rejectReason) => {
      connection.window.showErrorMessage("Error: " + rejectReason);
   });
});

connection.onRequest<tParseParam, tParseResult, {}> ({ method: "save" },
   (params: tParseParam): Thenable<tParseResult> => {
      connection.console.log("Saving " + params.classname + " to tgv...");

      var _rp = rp({
         method: 'POST',
         uri: url + '/ewam/api/rest/classOrModule/' + params.classname + '/save',
         body:
         {
            "implem": {
               "name": params.classname,
               "ancestor": "",
               "content": params.source
            }
         },
         json: true
      });

      return _rp.then((response) => {

         let diagnostics: Diagnostic[] = [];

         let result: tParseResult = { docUri: '', newSource: '' };

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
            updateLastImplemVersion(params.classname);

            if (params.notifyNewSource) {
               updateMetaInfoForClass(params.classname, params.source);
               result.docUri = params.uri;
               result.newSource = response.content;
            }
         }

         //Successfully parsed or not, send diagnostics anyway. 
         connection.sendDiagnostics({ uri: params.uri, diagnostics });

         return result;

      }).catch((rejectReason) => {
         connection.window.showErrorMessage("Error: " + rejectReason);
      });
   });


function getMethodAtLine(className: string, line: number): string | Thenable<string> {

   let method: tMethod;
   let result: string = "";

   if (classInfo == undefined) {
      classInfo = {};
   }

   if (classInfo[className].metaInfo == undefined) {
      return updateMetaInfoForClass(className, "")
         .then(
         (meta: tMetaInfo) => {

            for (var index = 0; index < classInfo[className].metaInfo.methods.length; index++) {

               method = classInfo[className].metaInfo.methods[index];

               if (method.range.startpos.line - 1 < line) {
                  result = method.name;
               }

               if (method.range.endpos.line - 1 > line) {
                  if (index > 0) {
                     result = classInfo[className].metaInfo.methods[index - 1].name;
                  }
                  break;
               }
            }

            //  connection.console.log("result: " + result);
            return result;
         }
         );
   } else {

      for (var index = 0; index < classInfo[className].metaInfo.methods.length; index++) {

         method = classInfo[className].metaInfo.methods[index];

         if (method.range.startpos.line - 1 < line) {
            result = method.name;
         }

         if (method.range.endpos.line - 1 > line) {
            if (index > 0) {
               result = classInfo[className].metaInfo.methods[index - 1].name;
            }
            break;
         }
      }

      //   connection.console.log("result: " + result);
      return result;
   }
}

connection.onRequest<tMethodAtLineParam, string, {}> ({ method: "getMethodAtLine" },
   (params: tMethodAtLineParam): string | Thenable<string> => {
      // connection.console.log("getMethodAtLine " + params.classname + " " + params.line);
      return getMethodAtLine(params.classname, params.line);
   }
);

connection.onRequest({ method: "LoadMetaInfo" },
   (params: { "moduleName": string }): string | Thenable<string> => {
      // connection.console.log("LoadMetaInfo " + params.moduleName);
      return updateMetaInfoForClass(params.moduleName, "").then(() => { return ""; });
   }
);

connection.onRequest({ method: "RefreshMetaInfo" },
   (params: { "moduleName": string }): string | Thenable<string> => {
      // connection.console.log("server RefreshMetaInfo " + params.moduleName);
      return updateMetaInfoForClass(params.moduleName, "").then(() => { return ""; });
   }
);

connection.onRequest({ method: "DeleteMetaInfo" },
   (params: { "moduleName": string }): string | Thenable<string> => {
      // connection.console.log("DeleteMetaInfo " + params.moduleName);
      delete classInfo[params.moduleName].metaInfo;
      return "";
   }
);

function getMetaInfoFor(className: string, uri: string): SymbolInformation[] {
   let result: SymbolInformation[] = [];

   for (var index = 0; index < classInfo[className].metaInfo.variables.length; index++) {
      result.push({
         "name": classInfo[className].metaInfo.variables[index].name + " : " + classInfo[className].metaInfo.variables[index].variableType,
         "kind": getSymbolKindFromEntityClass(classInfo[className].metaInfo.variables[index].entity.baseType),
         "location": {
            "uri": uri,
            "range": {
               "start": {
                  "line": classInfo[className].metaInfo.variables[index].range.startpos.line,
                  "character": classInfo[className].metaInfo.variables[index].range.startpos.column
               },
               "end": {
                  "line": classInfo[className].metaInfo.variables[index].range.endpos.line,
                  "character": classInfo[className].metaInfo.variables[index].range.endpos.column
               }
            }
         },
         "containerName": className
      });
   }

   for (var index = 0; index < classInfo[className].metaInfo.methods.length; index++) {

      let parameters: string = '';

      for (var paramRank = 0; paramRank < classInfo[className].metaInfo.methods[index].parameters.length; paramRank++) {
         if (paramRank >= 1)
            parameters += ', ';

         parameters += classInfo[className].metaInfo.methods[index].parameters[paramRank].name + ' : ' +
            classInfo[className].metaInfo.methods[index].parameters[paramRank].paramType
      }

      result.push({
         "name": classInfo[className].metaInfo.methods[index].name + '(' + parameters + ')',
         "kind": getSymbolKindFromEntityClass(classInfo[className].metaInfo.methods[index].entity.baseType),
         "location": {
            "uri": uri,
            "range": {
               "start": {
                  "line": classInfo[className].metaInfo.methods[index].range.startpos.line,
                  "character": classInfo[className].metaInfo.methods[index].range.startpos.column
               },
               "end": {
                  "line": classInfo[className].metaInfo.methods[index].range.endpos.line,
                  "character": classInfo[className].metaInfo.methods[index].range.endpos.column
               }
            }
         },
         "containerName": className
      });
   }

   for (var index = 0; index < classInfo[className].metaInfo.types.length; index++) {
      result.push({
         "name": classInfo[className].metaInfo.types[index].name,
         "kind": getSymbolKindFromEntityClass(classInfo[className].metaInfo.types[index].entity.baseType),
         "location": {
            "uri": uri,
            "range": {
               "start": {
                  "line": classInfo[className].metaInfo.types[index].range.startpos.line,
                  "character": classInfo[className].metaInfo.types[index].range.startpos.column
               },
               "end": {
                  "line": classInfo[className].metaInfo.types[index].range.endpos.line,
                  "character": classInfo[className].metaInfo.types[index].range.endpos.column
               }
            }
         },
         "containerName": className
      });
   }

   return result;

}

connection.onDocumentSymbol(
   (docIdentifier: TextDocumentPositionParams): SymbolInformation[] | Thenable<SymbolInformation[]> => {
      var className = docIdentifier.textDocument.uri.substring(
         docIdentifier.textDocument.uri.lastIndexOf('/') + 1, docIdentifier.textDocument.uri.lastIndexOf('.')
      );

      // If class name isn't found, bail out
      if (classInfo == undefined) {
         classInfo = {};
      }

      if (!(className in classInfo)) {
         return updateMetaInfoForClass(className, "")
            .then((meta: tMetaInfo) => {
               return getMetaInfoFor(className, docIdentifier.textDocument.uri);
            });
      } else {
         return getMetaInfoFor(className, docIdentifier.textDocument.uri);
      }
   }
);

function FindDefinition(identifier: string, ownerName: string): Thenable<tRange> {
   return updateMetaInfoForClass(ownerName, "").then(
      (meta: tMetaInfo): tRange => {
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
   (position: TextDocumentPositionParams): Definition | Thenable<Definition> => {
      // export declare type Definition = Location | Location[];
      // export interface Location {
      //     uri: string;
      //     range: Range;
      // }
      let moduleName: string =
         position.textDocument.uri.substring(
            position.textDocument.uri.lastIndexOf('/') + 1, position.textDocument.uri.lastIndexOf('.'));

      let outline: tOutline = getOutlineAt(position.position, moduleName);

      if (outline == null || outline == undefined) {
         return null;
      }

      // outline.entity is defined in a class or module
      // Get definition position inside the owner
      if (outline.entity.exactType == "aLocalVarDesc") {

         for (var index = 0; index < classInfo[moduleName].metaInfo.locals.length; index++) {

            if (outline.entity.location == classInfo[moduleName].metaInfo.locals[index].entity.location) {
               return {
                  uri: position.textDocument.uri,
                  range: {
                     "start": {
                        "line": classInfo[moduleName].metaInfo.locals[index].range.startpos.line,
                        "character": classInfo[moduleName].metaInfo.locals[index].range.startpos.column
                     },
                     "end": {
                        "line": classInfo[moduleName].metaInfo.locals[index].range.endpos.line,
                        "character": classInfo[moduleName].metaInfo.locals[index].range.endpos.column
                     }
                  }
               };
            }
         }


      } else if (outline.entity.ownerName != "") {

         let definitionReq = rp({
            method: 'GET',
            uri: url + '/ewam/api/rest/classOrModule/' + outline.entity.ownerName + '/definition/' + outline.name,
            json: true
         });

         let contentReq = rp({
            method: 'GET',
            uri: url + '/ewam/api/rest/classOrModule/' + outline.entity.ownerName,
            json: true
         });

         let repoPath = repoParams.basePath.replace(/\\/g, '/');
         return definitionReq
            .then((defRange: tRange) => {
               // Retrive the owner content
               return contentReq.then((response) => {

                  let outFileName: string = getModulePath(outline.entity.ownerName) + "\\" + outline.entity.ownerName + extension;
                  outFileName = path.normalize(outFileName);

                  if (fs.existsSync(outFileName.replace(/\\/g, '/'))) {
                     fs.chmod(outFileName.replace(/\\/g, '/'), '0666');
                  }
                  fs.writeFile(outFileName.replace(/\\/g, '/'), response["content"]);
                  
                  return {
                     uri: "file:///" + outFileName.replace(/\\/g, '/'),
                     range: {
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
               }).catch((rejectReason) => {
                  connection.window.showErrorMessage("Error: " + rejectReason);
               });
            }).catch((rejectReason) => {
               connection.window.showErrorMessage("Error: " + rejectReason);
            });

      } else {
         // outline.entity a class or module
         // Give difinition of the class, with position 0

         let contentReq = rp({
            method: 'GET',
            uri: url + '/ewam/api/rest/classOrModule/' + outline.name,
            json: true
         });

         let repoPath = repoParams.basePath.replace(/\\/g, '/');
         // Retrive the owner content
         return contentReq.then((response) => {

            let outFileName: string = getModulePath(outline.name) + "\\" + outline.name + extension;
            outFileName = path.normalize(outFileName);
            
            if (fs.existsSync(outFileName.replace(/\\/g, '/'))) {
               fs.chmod(outFileName.replace(/\\/g, '/'), '0666');
            }
            fs.writeFile(outFileName.replace(/\\/g, '/'), response["content"]);

            return {
               uri: "file:///" + outFileName.replace(/\\/g, '/'),
               range: {
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
         }).catch((rejectReason) => {
            connection.window.showErrorMessage("Error: " + rejectReason);
         });
      }
   });

connection.onReferences(
   (param: ReferenceParams): Location[] | Thenable<Location[]> => {

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

      let metaClass = classInfo[moduleName].metaInfo;

      let outline: tOutline = getOutlineAt(param.position, moduleName);

      let ownerName: string = outline.entity.ownerName;
      if (outline.entity.ownerName == undefined || outline.entity.ownerName == "") {
         ownerName = "Nil";
      }

      let whereUsedReq = rp({
         method: 'GET',
         uri: url + '/ewam/api/rest/entity/' + ownerName + '/' + outline.entity.name + '/WhereUsed',
         json: true
      });

      //let fileName : string = repoParams.basePath.replace(/\\/g, '/') + '/' + moduleName + '.gold';
      let fileName: string = getModulePath(moduleName) + "\\" + moduleName + extension;
      fileName = fileName.replace(/\\/g, '/');

      return whereUsedReq
         .then((whereUsedResult: tWhereUsed[]): Location[] => {
            let result: Location[] = [];

            for (let index = 0; index < whereUsedResult.length; index++) {
               ;
               result.push({
                  "uri": 'file:///' + (getModulePath(whereUsedResult[index].name) + "/" + whereUsedResult[index].name + extension).replace(/\\/g, '/'),
                  //repoParams.basePath + '/' + whereUsedResult[index].name + '.gold',
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

connection.onSignatureHelp(
   (docPosition: TextDocumentPositionParams): Thenable<SignatureHelp> | SignatureHelp => {

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

      let moduleName: string = docPosition.textDocument.uri.substring(
         docPosition.textDocument.uri.lastIndexOf('/') + 1, docPosition.textDocument.uri.lastIndexOf('.'));
      var lines = documents.get(docPosition.textDocument.uri).getText().split(/\r?\n/g);
      var position = docPosition.position;
      var line = lines[docPosition.position.line];


      var signatureParams = {
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
         uri: url + '/ewam/api/rest/classOrModule/' + moduleName + '/signaturehelp/',
         body: { "signatureParams": signatureParams },
         json: true
      });

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
         .then((response: signatureHelpResult): SignatureHelp => {
            let result: SignatureHelp = {
               signatures: [],
               activeSignature: 0,
               activeParameter: 0
            };

            result.activeSignature = response.activeMethod;
            result.activeParameter = response.activeParam;

            for (var methIndex = 0; methIndex < response.methods.length; methIndex++) {

               let method: SignatureInformation = {
                  label: "",
                  documentation: "",
                  parameters: []
               };
               method.documentation = response.methods[methIndex].documentation;
               method.label = response.methods[methIndex].declaration;

               for (var paramIndex = 0; paramIndex < response.methods[methIndex].parameters.length; paramIndex++) {
                  let param: ParameterInformation = {
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
         }).catch((rejectReason) => {
            connection.window.showErrorMessage("Error: " + rejectReason);
         });
   });

connection.onRequest({ method: "getModuleDocumentation" },
   (params: { "moduleName": string }): string | Thenable<string> => {
      if (classInfo == undefined) {
         classInfo = {};
      }

      if (!(params.moduleName in classInfo)) {
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
   (params: DocumentFormattingParams): TextEdit[] => {

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

function getSymbolKindFromEntityClass(entityClass: string): number {

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

   let result: number = -1;

   switch (entityClass) {
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

function getCompletionKindFromEntityClass(entityClass: string): number {

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

   let result: number = -1;

   switch (entityClass) {
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
   (params: WorkspaceSymbolParams): SymbolInformation[] | Thenable<SymbolInformation[]> => {
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
         uri: url + '/ewam/api/rest/searchEntities',
         body: { "searchParams": {"q":params.query, "_class": true, "_module":true} },
         json: true
      });

      return contentReq
         .then((entities: tEntity[]) => {

            let fileName: string = "";
            let symbols: SymbolInformation[] = [];

            for (let index: number = 0; index < entities.length; index++) {
               let entity: tEntity = entities[index];

               if (entity.exactType == "aModuleDef" || entity.exactType == "aClassDef") {
                  fileName = repoParams.basePath.replace(/\\/g, '/') + '/' + entity.name + '.gold';
               } else {
                  fileName = repoParams.basePath.replace(/\\/g, '/') + '/' + entity.ownerName + '.gold';
               }

               let symbol: SymbolInformation = {
                  "name": entity.name,
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
         }).catch((rejectReason) => {
            connection.window.showErrorMessage("Error: " + rejectReason);
         });
   }
);

let bundleCacheRefreshing: Boolean = false;
let bundleCache;

interface tModuleBundle {
   bundle: string;
   delivery: string;
   dependency: boolean;
}

let moduleBundleCache: { [modulename: string]: tModuleBundle; };

function updateModuleBundleCache() {

   if (moduleBundleCache == undefined) {
      moduleBundleCache = {};
   }

   let nbEntities: number = 0;

   for (let i = 0; i < bundleCache.projectPackages.length; i++) {

      let bundle = bundleCache.projectPackages[i];
      for (let j = 0; j < bundle.deliveries.length; j++) {

         let delivery = bundle.deliveries[j];
         nbEntities += delivery.entities.length;
         for (let k = 0; k < delivery.entities.length; k++) {

            let entity = delivery.entities[k];
            if (entity.exactType == "aModuleImplem" || entity.exactType == "aClassImplem" ||
               entity.exactType == "aModuleDef" || entity.exactType == "aClassDef") {
               moduleBundleCache[entity.name] = {
                  "bundle": bundle.name,
                  "delivery": delivery.name,
                  "dependency": false
               };
            }
         }
      }
   }

   // connection.console.log("size of moduleBundleCache : " + moduleBundleCache.length);

   for (let i = 0; i < bundleCache.dependencyPackages.length; i++) {

      let bundle = bundleCache.dependencyPackages[i];
      for (let j = 0; j < bundle.deliveries.length; j++) {

         let delivery = bundle.deliveries[j];
         nbEntities += delivery.entities.length;
         for (let k = 0; k < delivery.entities.length; k++) {

            let entity = delivery.entities[k];
            if (entity.exactType == "aModuleImplem" || entity.exactType == "aClassImplem" ||
               entity.exactType == "aModuleDef" || entity.exactType == "aClassDef") {

               moduleBundleCache[entity.name] = {
                  "bundle": bundle.name,
                  "delivery": delivery.name,
                  "dependency": true
               };
            }
         }
      }
   }

   // connection.console.log("NbEntities read : " + nbEntities);
   // connection.console.log("size of moduleBundleCache : " + Object.keys(moduleBundleCache).length);
   // connection.console.log("moduleBundleCache access test : " + moduleBundleCache["aWEXIdAllocatorChecker"].bundle);
}

function refreshBundleCache() {

   bundleCacheRefreshing = true;

   if (moduleBundleCache == undefined) {
      moduleBundleCache = {};
   }

   function readBundleIndex () {

      console.log("Loading bundle cache from " + repoParams.basePath + "/bundleIndex.json");

      let data = fs.readFileSync(repoParams.basePath + "/bundleIndex.json", 'utf8');

      if (data != "") {
         bundleCache = JSON.parse(data);
         // Feed the "metainfo" variable
         updateModuleBundleCache();
         bundleCacheRefreshing = false;
         return true;
      } else {
         bundleCacheRefreshing = false;
         return false;
      }
   }
   
   // if we can't find a bundleIndex.json, generate it from local eWam service.
   if (!fs.existsSync(repoParams.basePath + "/bundleIndex.json")) {
      console.log(repoParams.basePath + "/bundleIndex.json not found, generating from local service")

      generatePackagesIndex().then(() => {
         readBundleIndex();
      });
   } else {
      readBundleIndex();
   }

}

function findModulePath (moduleName : string) : string {

   if (!(moduleName in moduleBundleCache)) {
      return repoParams.basePath + "\\.unbundled\\";
   }

   let moduleBundle: tModuleBundle = moduleBundleCache[moduleName];

   if (moduleBundle.dependency) {
      return repoParams.basePath + "\\" + repoParams.dependencies_subdir + "\\" + moduleBundle.bundle + "\\" + moduleBundle.delivery;
   } else {
      return repoParams.basePath + "\\" + repoParams.workspace_subdir + "\\" + moduleBundle.bundle + "\\" + moduleBundle.delivery;
   }
}

function getModulePath(moduleName: string) : string {
   return findModulePath(moduleName);
}

connection.onRequest<{ "moduleName": string }, string, {}> ({ method: "getModulePath" },
   (params: { "moduleName": string }) : string => {
      return getModulePath(params.moduleName);
   });

   

function generatePackagesIndex () : Thenable<Boolean> {
   let buildPackageIndex = rp({
      method: 'POST',
      uri: url + '/ewam/api/rest/repository/generatePackagesIndex',
      body: { 
         "repoParam": {
            "repository_url": repoParams.repository_url,
            "basePath": repoParams.basePath,
            "workspace_subdir": repoParams.workspace_subdir,
            "dependencies_subdir": repoParams.dependencies_subdir
         }
      },
      json: true
   });

   return buildPackageIndex.then((response) => {
      return true;
   }).catch((rejectReason) => {
      connection.window.showErrorMessage("Error: " + rejectReason);
   });
}

connection.onRequest<{}, Boolean, {}>({ method: "buildDependenciesRepo" },
   () => {
      return buildDependenciesRepo();
   });

function buildDependenciesRepo(): Thenable<Boolean> {
   let buildRepoReq = rp({
      method: 'POST',
      uri: url + '/ewam/api/rest/repository/buildDependenciesRepo',
      body: {
         "repoParam": {
            "repository_url": repoParams.repository_url,
            "basePath": repoParams.basePath,
            "workspace_subdir": repoParams.workspace_subdir,
            "dependencies_subdir": repoParams.dependencies_subdir
         }
      },
      json: true
   });

   return buildRepoReq.then((response) => {
      return true;
   }).catch((rejectReason) => {
      connection.window.showErrorMessage("Error: " + rejectReason);
   });

}

connection.onRequest<{}, Boolean, {}>({ method: "syncWorkspaceRepo" },
   () => {
      return syncWorkspaceRepo();
   });

function syncWorkspaceRepo(): Thenable<Boolean> {
   let buildWorkspaceReq = rp({
      method: 'POST',
      uri: url + '/ewam/api/rest/repository/buildProjectRepoFromIndex',
      body: {
         "repoParam": {
            "repository_url": repoParams.repository_url,
            "basePath": repoParams.basePath,
            "workspace_subdir": repoParams.workspace_subdir,
            "dependencies_subdir": repoParams.dependencies_subdir
         }
      },
      json: true
   });

   return buildWorkspaceReq.then((response) => {
      return true;
   }).catch((rejectReason) => {
      connection.window.showErrorMessage("Error: " + rejectReason);
   });

}

connection.onRequest<{ "moduleName": string }, number, {}> ({ method: "getLastknownImplemVersion" },
   (param: { "moduleName": string }): number => {
      return getLastknownImplemVersion(param.moduleName);
   });

function getLastknownImplemVersion(className: string): number {
   let result: number = -1;

   if (!(className in classInfo)) {
      return -1;
   }

   if (classInfo[className].lastKnownImplemVersion == undefined) {
      // console.log("undefined !!" + JSON.stringify(classInfo[className].metaInfo));
      return -1;
   }

   result = classInfo[className].lastKnownImplemVersion;

   return result;
}

connection.onCodeAction((params: CodeActionParams): Command[] => { return null; });

connection.onDocumentFormatting((params: DocumentFormattingParams): TextEdit[] => {
   return null;
});

connection.onRenameRequest((params: RenameParams): WorkspaceEdit => {

   let className: string = params.textDocument.uri.substring(
      params.textDocument.uri.lastIndexOf('/') + 1, params.textDocument.uri.lastIndexOf('.')
   );

   let entityOutline: tOutline = getOutlineAt(params.position, className);

   if (entityOutline == undefined || entityOutline == null) {
      connection.window.showWarningMessage("Sorry, no symbol found at this position.")
      return { "changes": {} };
   }

   let ownerName: string = entityOutline.entity.ownerName;

   if (ownerName == "") {
      ownerName = "Nil";
   }

   let renameReq = rp({
      method: 'POST',
      uri: url + '/ewam/api/rest/entity/' + ownerName + '/' + entityOutline.entity.name + '/rename',
      body: {
         "renameParams": {
            "newName": params.newName,
            "repoParam": {
               "repository_url": repoParams.repository_url,
               "basePath": repoParams.basePath,
               "workspace_subdir": repoParams.workspace_subdir,
               "dependencies_subdir": repoParams.dependencies_subdir
            }
         }
      },
      json: true
   });

   connection.window.showInformationMessage("Propagating rename in source code, please wait...");

   return renameReq.then((response) => {
      let result: WorkspaceEdit = { changes: {} };

      // We are renaming a class or module, we need to change it's metainfo, and rename the associated file too ...
      if (entityOutline.entity.exactType == "aModuleDef" || entityOutline.entity.exactType == "aClassDef") {

         if (entityOutline.name in classInfo) {
            classInfo[params.newName] = classInfo[entityOutline.name];
            delete classInfo[entityOutline.name];
            updateMetaInfoForClass(params.newName, "");
         }

         // let oldFileName : string = getModulePath(entityOutline.name) + "\\" + entityOutline.name + ".god";
         // let newFileName : string = oldFileName.substring(0, oldFileName.lastIndexOf("\\")) + "\\" +  params.newName + ".god";

      } else {
         updateMetaInfoForClass(className, "");
      }


      connection.window.showInformationMessage("Rename successfully completed.");

      return result;
   }).catch((rejectReason) => {
      connection.window.showErrorMessage("Error: " + rejectReason);
      let result: WorkspaceEdit = { changes: {} };
      return result;
   });
});

// Listen on the connection
connection.listen();
