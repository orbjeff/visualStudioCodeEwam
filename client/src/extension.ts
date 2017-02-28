// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
'use strict';

import { LanguageClient, LanguageClientOptions, ErrorAction, CloseAction, SettingMonitor, ServerOptions, TransportKind }
   from 'vscode-languageclient';

import { Message, RequestHandler, NotificationHandler, RequestType, NotificationType, Trace, Event } from 'vscode-jsonrpc';

import { languages, Diagnostic, DiagnosticSeverity, TextDocumentContentProvider } from 'vscode';

import * as vscode from 'vscode';
import * as axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

declare var require: any;

let rp = require('request-promise');
let url = require('url');
let http = require('http');

let EXTENSION = '.god';
let scenarioBarItem: vscode.StatusBarItem;
let checkInBarItem: vscode.StatusBarItem;
let checkOutBarItem: vscode.StatusBarItem;
let reimplemBarItem: vscode.StatusBarItem;
let parseBarItem: vscode.StatusBarItem;
let classtreeBarItemMain: vscode.StatusBarItem;
let parsingErrorDecorationType: vscode.TextEditorDecorationType;
let breakPointDecorationType: vscode.TextEditorDecorationType;
let config: vscode.WorkspaceConfiguration;
let lastParse: number;
let languageClient: LanguageClient;
let saving: boolean = false;
let parsePlanned: boolean = false;
let extensionContext: vscode.ExtensionContext;

let fileWatcher: vscode.FileSystemWatcher;

// Settings : 
// // The settings interface describe the server relevant settings part
// interface Settings {
// 	languageServerExample: ExampleSettings;
// }
// 
// // These are the example settings we defined in the client's package.json
// // file
// interface ExampleSettings {
// 	maxNumberOfProblems: number;
// }
// 
// // hold the maxNumberOfProblems setting
// let maxNumberOfProblems: number;
// // The settings have changed. Is send on server activation
// // as well.
// connection.onDidChangeConfiguration((change) => {
// 	let settings = <Settings>change.settings;
// 	maxNumberOfProblems = settings.languageServerExample.maxNumberOfProblems;
// 	if (maxNumberOfProblems == undefined) {
// 		connection.console.log('Undefined configuration value: maxNumberOfProblems\n');
// 	} 
// 	maxNumberOfProblems = maxNumberOfProblems || 100;
// 	// Revalidate any open text documents
// 	documents.all().forEach(validateTextDocument);
// });

function openIDE() : Thenable<Boolean> {
   return axios.default.get(config.get('url') + '/system/OpenIDE')
   .then( (response) => {
      if (response.data == true) {
         return true;
      } else {
         return false;
      }
   }).catch((rejectReason) => {
      vscode.window.showErrorMessage("Error: " + rejectReason);
      return false;
   });
}

function stopService() : Thenable<Boolean> {
   return axios.default.post(config.get('url') + '/ewam/api/rest/system/stopservice')
   .then( (response) => {
      if (response.data == true) {
         return true;
      } else {
         return false;
      }
   }).catch((rejectReason) => {
      vscode.window.showErrorMessage("Error: " + rejectReason);
      return false;
   });
}

function refreshFromTGV (doc? : vscode.TextDocument) {

   if (doc == undefined || !doc) {
      if (vscode.window.activeTextEditor != undefined) {
         doc = vscode.window.activeTextEditor.document;
      } else {
         return;
      }
   }

   let moduleName: string = getOpenClassName(doc);

   openClass(moduleName);
   RefreshMetaInfo(moduleName);
}

function isGoldDocument(fileUri: vscode.Uri) : Boolean {
   let filePath : string = fileUri.toString();
   let extension : string = filePath.substring(filePath.lastIndexOf('.') + 1);

   return (extension == 'god' || extension == 'gold');
}

function isOpenedInWorkspace(fileUri: vscode.Uri): Boolean {
   let result: Boolean = false;

   let filePath : string = path.normalize(fileUri.toString());

   vscode.workspace.textDocuments.forEach((document : vscode.TextDocument) => {
      let openedFilePath : string = path.normalize(document.uri.toString());

      // console.log("isOpenedInWorkspace " + openedFilePath + " " + filePath);

      if (openedFilePath == filePath) {
         result = true;
         return;
      }
   });

   return result;
}

function GetClassNameFromPath(path : string) : string {
   let moduleName: string = path.substring(
            path.lastIndexOf('\\') + 1, path.lastIndexOf('.'));
   return moduleName;
}

function LoadMetaInfo(moduleName: string) {
   return languageClient.sendRequest(
      { method: "LoadMetaInfo" },
      { params: { "moduleName": moduleName } }
   )
      .then(
      () => { }
      );
}

function RefreshMetaInfo(moduleName: string) {
   // console.log("client RefreshMetaInfo " + moduleName);
   return languageClient.sendRequest(
      { method: "RefreshMetaInfo" },
      { moduleName: moduleName }
   )
      .then(
      () => { }
      );
}

function DeleteMetaInfo(moduleName: string) {
   return languageClient.sendRequest(
      { method: "DeleteMetaInfo" },
      { params: { "moduleName": moduleName } }
   )
      .then(
      () => { }
      );
}

function dummyCommand() {
   let cacheString: string = fs.readFileSync(vscode.workspace.rootPath + "\\.tmp\\ewamcache.json", 'utf8');

   console.log("dgfndfklgfdklgnkldfgn\n" + cacheString + "\nflsdjgdjhgdfhkh");
}

function compareFiles(localModulePath: string, moduleName: string, tgvSource: string): any {

   let leftFile: vscode.Uri = vscode.Uri.parse("file:" + vscode.workspace.rootPath + "/.tmp/" + moduleName + ".tgv.god");
   let rightFile: vscode.Uri = vscode.Uri.parse("file:" + localModulePath + "/" + moduleName + ".god");

   try {
      if (fs.existsSync(leftFile.fsPath)) {
         fs.unlinkSync(leftFile.fsPath);
      }
      fs.writeFileSync(leftFile.fsPath, tgvSource);
      // setReadOnly(leftFile.fsPath);
   } catch (writeError) {
      console.log("Couldn't write " + leftFile.fsPath + " \n" + writeError);
   }

   let result: any;

   try {

      let compareAlreadyOpen: Boolean = false;

      for (let index = 0; index < vscode.workspace.textDocuments.length; index++) {
         let document: vscode.TextDocument = vscode.workspace.textDocuments[index];
         if (document.fileName == leftFile.fsPath) {
            compareAlreadyOpen = true;
         }
      }

      if (!compareAlreadyOpen) {
         vscode.window.showInformationMessage("Source code from TGV has changed ! Compare and modify your version before saving (right pan).");

         let result = vscode.commands.executeCommand(
            "vscode.diff",
            leftFile,
            rightFile,
            "TGV (" + leftFile.fsPath.substring(leftFile.fsPath.lastIndexOf("\\") + 1) + ") | local (" + rightFile.fsPath.substring(rightFile.fsPath.lastIndexOf("\\") + 1) + ")"
         ).then((resParam) => {
            // vscode.window.showInformationMessage("gruik !");
         });
      }
   } catch (compareError) {
      console.log("Couldn't compare " + leftFile.fsPath + " and " + rightFile.fsPath + "\n" + compareError);
   }

   return result;
}

function SyncAll() {

   SyncTGV().then((result: any) => {
      SyncGit().then(() => {
         buildDependenciesRepo().then((result: any) => { });
      });
   });
}

function getMethodAtLine(line: number, doc?: vscode.TextDocument): Thenable<string> {

   if (!doc) {
      doc = vscode.window.activeTextEditor.document;
   }

   return languageClient.sendRequest(
      { method: "getMethodAtLine" },
      {
         "classname": getOpenClassName(doc),
         "line": line
      }
   )
      .then(
      (methodName: string) => {
         // console.log("... " + methodName);
         return methodName;
      }
      );
}

function runContext() {
   // Get Context (class name, method name)
   let activeEditor: vscode.TextEditor = vscode.window.activeTextEditor;

   if (activeEditor == undefined || activeEditor == null || !activeEditor)
      return;

   let cursorPosition: vscode.Selection = activeEditor.selection;

   let className: string = getOpenClassName(activeEditor.document);

   vscode.window.showQuickPick(
      [
         "try class",
         "try method",
         "try scenario"
      ]
   ).then((choice: string) => {

      config = vscode.workspace.getConfiguration('ewam');

      if (choice == "try class") {
         axios.default.post(config.get('url') + '/ewam/api/rest/tryClass/' + className, {})
            .then((response: any) => {

            })
            .catch((rejectReason: any) => {
               vscode.window.showErrorMessage("Error: " + rejectReason);
            });

      } else if (choice == "try method") {

         getMethodAtLine(cursorPosition.start.line, activeEditor.document)
            .then((methodName: string) => {
               if (methodName == "") {

                  vscode.window.showWarningMessage("Cursor doesn't seem to be on a method. Place the cursor on the method you want to test.")

               } else {

                  axios.default.post(config.get('url') + '/ewam/api/rest/tryMethod/' + className + '/' + methodName, {})
                     .then((response: any) => {

                     })
                     .catch((rejectReason: any) => {
                        vscode.window.showErrorMessage("Error: " + rejectReason);
                     });

               }
            });

      } else if (choice == "try scenario") {

         axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + className + '/scenarios', {})
            .then((response: any) => {
               vscode.window.showQuickPick(getRenamedData(response.data))
                  .then((selection) => {
                     axios.default.post(config.get('url') + '/ewam/api/rest/tryScenario/' + className + '/' + selection["name"], {})
                  });
            })
            .catch((rejectReason: any) => {
               vscode.window.showErrorMessage("Error: " + rejectReason);
            });

      }

      console.log(choice);
   });

   // Ask what run wanted : 
   //  - class
   //      -> ask current class or other class
   //      -> other class : list of classes
   //  - method
   //      -> list method with current method on top
   //  - scenario
   //      -> list scenarios
   // in case of scenario show

}

function SyncGit(): any {
   vscode.window.showInformationMessage("Synchronizing git...");
   return vscode.commands.executeCommand("workbench.action.git.sync").then(() => {
      vscode.window.showInformationMessage("Git sync done.");
   });
}

function SyncTGV(): any {
   vscode.window.showInformationMessage(
      "Syncing your environment's TGVs...");

   return axios.default.post(config.get('url') + '/ewam/api/rest/repository/synchronize', {})
      .then((response: any) => {
         vscode.window.showInformationMessage("TGV sync done.");
      }).catch((rejectReason: any) => {
         vscode.window.showErrorMessage("Error: " + rejectReason);
      });
}

function buildDependenciesRepo(): any {
   vscode.window.showInformationMessage(
      "Loading dependencies, this may take a few minutes, please be patient...");

   vscode.window.showInformationMessage(
      "You will be notified when loading is finished.");

   return languageClient.sendRequest({ method: "buildDependenciesRepo" }, {})
      .then((params: any) => {
         vscode.window.showInformationMessage("Finished loading dependencies.");
      });
}

function syncWorkspaceRepo() {
   vscode.window.showInformationMessage(
      "Synchronizing workspace, this may take a few minutes, please be patient...");
   vscode.window.showInformationMessage("You will be notified when loading is finished.");

   languageClient.sendRequest({ method: "syncWorkspaceRepo" }, {})
      .then((params: any) => {
         vscode.window.showInformationMessage("Finished synchronizing workspace.");
      });
}

function downloadFile() {
   // App variables
   var file_url = 'http://home.pantoufle.pl/Star Wars - Timothy Zahn Trylogy.7z';
   //https://github.com/MphasisWyde/WydeActiveModelerAPI/raw/master/Bundle/WXeWamAPI/Upgrade_V1/WXeWamAPI.Tgv

   var DOWNLOAD_DIR = 'D:/Wyde-TFS/visualStudioCodeEwam/client/';

   // Function to download file using HTTP.get
   var options = {
      host: url.parse(file_url).host,
      port: 80,
      path: url.parse(file_url).pathname
   };

   var file_name = url.parse(file_url).pathname.split('/').pop();
   var file = fs.createWriteStream(DOWNLOAD_DIR + file_name);

   http.get(options, function (res) {
      res.on('data', function (data) {
         file.write(data);
      }).on('end', function () {
         file.end();
         // console.log(file_name + ' downloaded to ' + DOWNLOAD_DIR);
      });
   });
}

function setDecoForStopPoints(methods) {

   var decos = [];
   var activeEditor = vscode.window.activeTextEditor;
   var text = activeEditor.document.getText();

   for (var method of methods) {
      var i = text.search('function ' + method);
      if (i == -1)
         i = text.search('procedure ' + method);
      var start = activeEditor.document.positionAt(i);
      var end = activeEditor.document.positionAt(i + 10);
      var r = new vscode.Range(start, end);
      decos.push({ range: r, hoverMessage: 'Break point on ' + method });
   }
   activeEditor.setDecorations(breakPointDecorationType, decos);
}

function refreshUI() {
   var name = getOpenClassName();

   if (name != '') {
      axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + name + '/entityStatus')
      .then(function (response) {
         if (response.data["checkedOut"]) {
            checkInBarItem.show();
            checkOutBarItem.hide();
            scenarioBarItem.show();
            reimplemBarItem.show();
            parseBarItem.show()
            //fs.fstat()
            //vscode.window.activeTextEditor.document.uri.fsPath
         } else {
            checkInBarItem.hide();
            checkOutBarItem.show();
            scenarioBarItem.hide();
            reimplemBarItem.hide();
            parseBarItem.hide();
         }
         setDecoForStopPoints(response.data["stopPoints"]);
      }).catch((rejectReason: any) => {
         vscode.window.showErrorMessage(rejectReason);
      });
   }
}

function recursiveMkdir(path: string) {
   let dirs = path.split("\\");

   let curPath: string = "";

   for (let dir in dirs) {
      curPath += dirs[dir] + "\\";

      try {
         fs.accessSync(curPath);
      } catch (err) {
         fs.mkdirSync(curPath);
      }
   }
}

function openClass(name: string) {
   if (!vscode.workspace.rootPath) {
      vscode.window.showErrorMessage("eWam open: Cannot work without opened folder");
      return;
   }
   
   axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + name)
      .then((response) => {
         languageClient.sendRequest(
            { method: "getModulePath" },
            { "moduleName": name }
         ).then((modulePath: string) => {
            let fileName: string = modulePath + "\\" + name + EXTENSION;
            fileName = path.normalize(fileName);
            
            try {
               fs.accessSync(modulePath)
            } catch (err) {
               recursiveMkdir(modulePath);
            };

            if (fs.existsSync(fileName)) {
               fs.chmod(fileName, '0666');
            }

            let responseData : string = response.data['content'];

            fs.writeFile(fileName, responseData, function (err) {
               if (err) throw err;

               vscode.workspace.openTextDocument(fileName)
                  .then((document) => {
                     vscode.window.showTextDocument(document);
                     refreshUI();
                  });
            });
         });
      })
      .catch((rejectReason: any) => {
         vscode.window.showErrorMessage("Error: " + rejectReason);
      });
}

function setReadOnly(fileName: string) {
   fs.chmodSync(fileName, '0444');
}

function setReadWrite(fileName: string) {
   fs.chmodSync(fileName, '0666');
}

function loadCache() {
   return languageClient.sendRequest(
      { method: "loadCache" },
      { param: {} }
   )
      .then(
      () => { }
      );
}

function saveCache() {
   return languageClient.sendRequest(
      { method: "saveCache" },
      { param: {} }
   )
      .then(
      () => { }
      );
}

function getLastknownImplemVersion(className: string): Thenable<number> {
   let result: number = -1;

   return languageClient.sendRequest(
      { method: "getLastknownImplemVersion" },
      { "moduleName": className }
   ).then((versionNumber: number) => {
      return versionNumber;
   });
}

function getImplemVersion(currentSource: string): number {
   let implemVersionPos: number = currentSource.indexOf('(Implem Version:') + 16;
   let implemVersion: number = + currentSource.substring(
      implemVersionPos,
      currentSource.indexOf(')', implemVersionPos));

   return implemVersion;
}

function getDefVersion(currentSource: string): number {
   let defVersionPos: number = currentSource.indexOf('(Def Version:') + 13;
   let defVersion: number = + currentSource.substring(
      defVersionPos,
      currentSource.indexOf(')', defVersionPos));

   return defVersion;
}

function isCheckOut(className: string): Thenable<Boolean> {

   return axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + className + '/entityStatus')
      .then((statusResponse) => {
         if (statusResponse.data["checkedOut"]) {
            return true;
         } else {
            return false;
         }
      }).catch((rejectReason: any) => {
         vscode.window.showErrorMessage("Error: " + rejectReason);
         return false;
      });
}

function checkStatus(doc?: vscode.TextDocument) {

   if (doc == undefined || !doc) {
      if (vscode.window.activeTextEditor != undefined) {
         doc = vscode.window.activeTextEditor.document;
      } else {
         return;
      }
   }

   let className: string = getOpenClassName(doc);

   // Retrieve status
   return isCheckOut(className)
      .then((checkedOut: Boolean) => {
         if (!checkedOut) {
            setReadOnly(doc.fileName);
            // vscode.window.showWarningMessage("'" + className + "' isn't checked out. Modifications won't be saved in TGVs, and will be lost after next \"Open Entity\" !")

         }
      });
}

function checkBeforeSave(doc?: vscode.TextDocument): Thenable<any> {

   if (doc == undefined || !doc) {
      if (vscode.window.activeTextEditor != undefined) {
         doc = vscode.window.activeTextEditor.document;
      } else {
         return;
      }
   }

   let className: string = getOpenClassName(doc);
   let currentSource: string = doc.getText();

   return isCheckOut(className).then((checkedOut) => {

      if (checkedOut) {

         return languageClient.sendRequest(
            { method: "getModulePath" },
            { "moduleName": className }
         ).then((modulePath: string) => {

            let fileName = modulePath + "\\" + className + EXTENSION;

            // get last known implem version for this class
            return languageClient.sendRequest({ method: "getLastknownImplemVersion" }, { "moduleName": className })
               .then((lastKnownImplem: number) => {

                  // Retrieve status to get current implem
                  return axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + className + '/entityStatus')
                     .then((statusResponse) => {

                        // Compare remote version to local version => Diff if differs
                        // let defVersion : number = getDefVersion(currentSource); 
                        // let implemVersion : number = getImplemVersion(currentSource);

                        // TGV source changed !
                        if (lastKnownImplem != -1 && lastKnownImplem != statusResponse.data["implemVersion"]) {

                           // Retrieve TGV source code version
                           return axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + className)
                              .then((sourceResponse) => {
                                 let tgvSource : string = sourceResponse.data["content"];
                                 return compareFiles(modulePath, className, tgvSource);
                              }).catch((rejectReason: any) => {
                                 vscode.window.showErrorMessage("Error: " + rejectReason);
                              });
                        } else {
                           if (fs.existsSync(modulePath + "\\" + className + ".tgv" + EXTENSION)) {
                              fs.unlink(modulePath + "\\" + className + ".tgv" + EXTENSION);
                           }
                        }
                     }).catch((rejectReason: any) => {
                        vscode.window.showErrorMessage("Error: " + rejectReason);
                     });
               });
         });
      } else {
         vscode.window.showWarningMessage(className + " isn't checked out, you can't save your changes.");
      }
   });
}

function GenericPostOperation(name: string, op: string) {

   axios.default.post(config.get('url') + '/ewam/api/rest/classOrModule/' + name + '/' + op, {})
      .then(function (response) {
         refreshUI();
      })
      .catch((rejectReason: any) => {
         vscode.window.showErrorMessage("Error: " + rejectReason);
      });
}

function checkOutClass(name: string) {

   axios.default.post(config.get('url') + '/ewam/api/rest/classOrModule/' + name + '/checkOut', {})
      .then(function (response) {
         refreshUI();
         languageClient.sendRequest(
            { method: "getModulePath" },
            { "moduleName": name }
         ).then((modulePath: string) => {
            setReadWrite(modulePath + "\\" + name + ".god");
         });
      })
      .catch((rejectReason: any) => {
         vscode.window.showErrorMessage("Error: " + rejectReason);
      });

}

function checkInClass(name: string) {
   config = vscode.workspace.getConfiguration('ewam');
   axios.default.post(config.get('url') + '/ewam/api/rest/classOrModule/' + name + '/checkIn', {})
      .then(function (response) {
         // console.log(vscode.workspace.rootPath);
         var fileName = vscode.workspace.rootPath + '\\' + name + EXTENSION;

         const spawn = require('child_process').spawn;
         const ls = spawn('git', ['commit', fileName, '-m', '"Message"'],
            { cwd: vscode.workspace.rootPath, env: process.env });

         ls.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
         });
         refreshUI();
      })
      .catch((rejectReason: any) => {
         vscode.window.showErrorMessage("Error: " + rejectReason);
      });
}

function getOpenClassName(doc?: vscode.TextDocument) {
   if (doc == undefined || !doc) {
      if (vscode.window.activeTextEditor != undefined) {
         doc = vscode.window.activeTextEditor.document;
      } else {
         return;
      }
   }

   var fpath = doc.fileName.replace(/^.*[\\\/]/, '');
   return fpath.substring(fpath.lastIndexOf('/') + 1, fpath.lastIndexOf('.'));
}

function parse(notifyNewSource: Boolean = false, doc?: vscode.TextDocument) {

   if (!doc) {
      doc = vscode.window.activeTextEditor.document;
   }

   languageClient.sendRequest(
      { method: "parse" },
      {
         "classname": getOpenClassName(doc),
         "source": doc.getText(),
         "notifyNewSource": notifyNewSource,
         "uri": doc.uri.toString()
      }
   ).then(
      (params: { newSource: string, docUri: string }) => {
         if (params.docUri == '' && params.newSource == '')
            return;

         var editor: vscode.TextEditor = null;

         // Look for the editor we parsed
         for (var index = 0; index < vscode.window.visibleTextEditors.length; index++) {
            if (vscode.window.visibleTextEditors[index].document.uri.toString() === params.docUri) {
               editor = vscode.window.visibleTextEditors[index];
               break;
            }
         }

         if (editor == null)
            return;

         editor.edit(
            editBuilder => {
               var start: vscode.Position = new vscode.Position(0, 0);
               var lastLine: number = editor.document.lineCount - 1;

               var end: vscode.Position = editor.document.lineAt(lastLine).range.end;
               var range: vscode.Range = new vscode.Range(start, end);

               editBuilder.replace(range, params.newSource);
               parseBarItem.color = 'white';
            }
         );

         let moduleName: string = params.docUri.substring(
            params.docUri.lastIndexOf('/') + 1, params.docUri.lastIndexOf('.'));

         moduleDocumentationProvider.update(
            vscode.Uri.parse('ewam://modules/' + moduleName + '/module-preview'));
      }
      );

   refreshUI();
}

function save(notifyNewSource: Boolean = false, doc?: vscode.TextDocument) {

   saving = true;

   if (!doc) {
      doc = vscode.window.activeTextEditor.document;
   }
   let moduleName: string = getOpenClassName(doc);
   let source: string = doc.getText();

   checkBeforeSave(doc).then(() => {

      languageClient.sendRequest(
         { method: "save" },
         {
            "classname": moduleName,
            "source": source,
            "notifyNewSource": notifyNewSource,
            "uri": doc.uri.toString()
         }
      ).then(
         (params: { newSource: string, docUri: string }) => {
            if (params.docUri == '' && params.newSource == '') {
               saving = false;
               return;
            }

            let editor: vscode.TextEditor = null;

            // Look for the editor we parsed
            for (var index = 0; index < vscode.window.visibleTextEditors.length; index++) {
               if (vscode.window.visibleTextEditors[index].document.uri.toString() === params.docUri) {
                  editor = vscode.window.visibleTextEditors[index];
                  break;
               }
            }

            if (editor == null) {
               saving = false;
               return;
            }

            editor.edit(
               editBuilder => {
                  var start: vscode.Position = new vscode.Position(0, 0);
                  var lastLine: number = editor.document.lineCount - 1;

                  var end: vscode.Position = editor.document.lineAt(lastLine).range.end;
                  var range: vscode.Range = new vscode.Range(start, end);

                  editBuilder.replace(range, params.newSource);
                  refreshUI();
                  parseBarItem.color = 'white';
               }
            ).then((value: boolean) => {
               editor.document.save().then(
                  () => {
                     saving = false;
                  },
                  (reason: any) => {
                     saving = false;
                  });
            });
         },
         (reason: any) => {
            saving = false;
         }
         );
   });
}

function classTree() {

   let editor = vscode.window.activeTextEditor;
   let uri = editor.document.uri.path

   var moduleName = uri.substring(
      uri.lastIndexOf('/') + 1, uri.lastIndexOf('.')
   );

   if (!vscode.workspace.rootPath) {
      vscode.window.showErrorMessage("eWam Class Tree: Cannot work without opened folder");
      return;
   }

   axios.default.post(config.get('url') + '/ewam/api/rest/classOrModule/' + moduleName + '/showInTree')
      .then(function (response) {
         // console.log(response);
      })
      .catch((rejectReason: any) => {
         vscode.window.showErrorMessage("Error: " + rejectReason);
      });

}

class ModuleDocumentationContentProvider implements vscode.TextDocumentContentProvider {

   // onDidChange: vscode.Event<vscode.Uri>;
   private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

   provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): string | Thenable<string> {
      let moduleName: string = uri.path.substring(
         uri.path.indexOf('/') + 1, uri.path.lastIndexOf('/module-preview')
      );

      return getModuleDocumentation(moduleName);
   }

   get onDidChange(): vscode.Event<vscode.Uri> {
      return this._onDidChange.event;
   }

   public update(uri: vscode.Uri) {
      this._onDidChange.fire(uri);
   }

};

let moduleDocumentationProvider: ModuleDocumentationContentProvider;

function showModuleDocumentation(moduleName: string): Thenable<any> {

   let previewUri = vscode.Uri.parse('ewam://modules/' + moduleName + '/module-preview');
   // let previewUri = vscode.Uri.parse('file:///' + vscode.workspace.rootPath + '/' + moduleName + '.html');

   return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two)
      .then(
      (success) => { },
      (reason) => { vscode.window.showErrorMessage(reason); });
}

function getModuleDocumentation(moduleName: string): string | Thenable<string> {
   return languageClient.sendRequest(
      { "method": "getModuleDocumentation" },
      { "moduleName": moduleName }
   );
}

interface getScenarioCallBack { (className: string, scenarioName: string): void }

function getRenamedData(data): any[] {
   
   for (let index : number = 0; index < data.length; index++) {
      data[index]["label"] = data[index]["name"];
   }
   
   return data;
}

function getDataAsString(response): string {
   return response.data;
}

function getScenario(classname: string, callBack: getScenarioCallBack) {

   axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + classname + '/scenarios')
      .then(function (response) {

         vscode.window.showQuickPick(getRenamedData(response.data))
            .then((selection) => {
               callBack(classname, selection["name"])
            });
      })
      .catch((rejectReason: any) => {
         vscode.window.showErrorMessage("Error: " + rejectReason);
      });
}

function newClass(parentClass: string) {
   if (parentClass != undefined) {
      vscode.window.showInputBox({ prompt: 'Class name', value: '' })
         .then(name => {
            if (name != undefined) {
               axios.default.put(config.get('url') + '/ewam/api/rest/classOrModule/' + name + '/create', 
                  {
                     "implem" : { "content": "", "ancestor": parentClass, "name": name }
                  }
               )
               .then(function (response) {
                  // console.log(response);
                  openClass(name);
               })
               .catch((rejectReason: any) => {
                  vscode.window.showErrorMessage("Class couldn't be created, check the class name is correct and doesn't already exist. (Error: " + rejectReason + ")" );
               });
            }
         });
   }

}

function newModule() {
   vscode.window.showInputBox({ prompt: 'Module name', value: '' })
      .then(name => {
         if (name != undefined) {
            axios.default.put(config.get('url') + '/ewam/api/rest/classOrModule/' + name + '/create',
               {
                  "implem": { "content": '', "ancestor": "", "name": name }
               })
               .then(function (response) {
                  // console.log(response);
                  openClass(name);
               }).catch((rejectReason: any) => {
                  vscode.window.showErrorMessage("Error: " + rejectReason);
               });
         }
      });
}

function editScenario(classname: string, scenarioName: string) {

   axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + classname + '/scenarios/' + scenarioName)
      .then(function (response) {

      })
      .catch((rejectReason: any) => {
         vscode.window.showErrorMessage("Error: " + rejectReason);
      });
}

function metaInfo() {
   var classname = '';
   var editor = vscode.window.activeTextEditor;
   if (!editor) {
   } else {
      var selection = editor.selection;
      classname = editor.document.getText(selection);
   }
   if (classname == '') {
      classname = getOpenClassName();
   }
   if (classname != '') {
      vscode.window.showQuickPick(['Variables', 'Methods', 'Parents', 'Descendants', 'Sisters', 'Types'], { placeHolder: 'What meta data do you want?' }).then(choice => {
         if (choice != undefined) {
            axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + classname + '/' + choice)
               .then(function (response) {
                  vscode.window.showQuickPick(getRenamedData(response.data)).then(selected => {
                     if (selected != undefined) {
                        if (choice == 'Variables') {
                           // vscode.window.showQuickPick(['Override']).then(action => {
                           //     axios.default.get(config.get('url') + choice)
                           //     .then(variable => {
                           //         editor = vscode.window.activeTextEditor;
                           //         editor.edit(editBuilder => {
                           //             // var start = new vscode.Position(0, 0);                                                         
                           //             // var end = new vscode.Position(0, 1);
                           //             // var range = new vscode.Range(start, end);
                           //             var selection = editor.selection;
                           //             editBuilder.replace(selection, "\n" + getDataAsString(variable) + " override\n");
                           //         });
                           //     });
                           // });
                        } else if (choice == 'Methods') {
                           vscode.window.showQuickPick(['Override', 'Toggle Break Point']).then(action => {
                              if (action == 'Toggle Break Point') {
                                 // axios.default.post(config.get('url') + selected.location + '/breakPoint', {})
                                 // rest/classOrModule/{name}/methods/{methodName}/breakPoint */
                                 console.log(config.get('url') + '/ewam/api/rest/classOrModule/' + classname + '/methods/' + selected.label + '/breakPoint');
                                 axios.default.post(config.get('url') + '/ewam/api/rest/classOrModule/' + classname + '/methods/' + selected.label + '/breakPoint', {})
                                    .then((method) => {

                                       refreshUI();
                                    });
                              } else if (action == 'Override') {
                                 //axios.default.get(config.get('url') + selected.location)
                                 axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + classname + '/methods/' + selected.label, {})
                                    .then((response) => {

                                       editor = vscode.window.activeTextEditor;
                                       editor.edit(editBuilder => {
                                          // var start = new vscode.Position(0, 0);                                                         
                                          // var end = new vscode.Position(0, 1);
                                          // var range = new vscode.Range(start, end);
                                          var selection = editor.selection;
                                          editBuilder.replace(selection, "\n" + response.data["signature"] + " override\nend\n");
                                       }
                                       );
                                    });
                              }
                           });
                        } else if (choice == 'Parents' || choice == 'Descendants' || choice == 'Sisters') {
                           openClass(selected.label);
                        }
                     }
                  });

               })
               .catch((rejectReason: any) => {
                  vscode.window.showErrorMessage("Error: " + rejectReason);
               });
         }
      });
   }
}

interface searchClassCallBack { (className: string): void }

function interact(uri: string) {
   vscode.window.showQuickPick(['interact', 'checkOut', 'checkIn', 'deliver'], { placeHolder: 'What operation do you want?' })
      .then(choice => {
         if (choice == 'interact') {
            config = vscode.workspace.getConfiguration('ewam');
            axios.default.get(config.get('url') + uri + '/' + choice)
               .then(function (response) {
               }).catch((rejectReason: any) => {
                  vscode.window.showErrorMessage("Error: " + rejectReason);
               });
         } else if (choice != undefined) {
            config = vscode.workspace.getConfiguration('ewam');
            axios.default.post(config.get('url') + uri + '/' + choice)
               .then(function (response) {
               }).catch((rejectReason: any) => {
                  vscode.window.showErrorMessage("Error: " + rejectReason);
               });
         }
      });
}

interface tScenarioType {
   className: string,
   name: string
}

interface tPossibleScenarioTypes {
   primaryTypes: tScenarioType[],
   secondaryTypes: tScenarioType[]
}

function createNewScenario(className: string) {

   let doCreateScen = (className: string, scenarioType: string) => {

      vscode.window.showInputBox({ prompt: "Name for scenario (optional)" })
         .then((scenarioName: string) => {

            let _rp = rp({
               method: 'PUT',
               uri: config.get('url') + '/ewam/api/rest/classOrModule/' + className + '/createScenario/' + scenarioType,
               json: true,
               body: { "scenarioName": scenarioName }
            });

            _rp.then(() => {
            }).catch((rejectReason) => {
               vscode.window.showErrorMessage("Error: " + rejectReason);
            });
         });


   }

   let _rp = rp(
      {
         method: 'GET',
         uri: config.get('url') + '/ewam/api/rest/classOrModule/' + className + '/possibleScenario/',
         json: true
      });

   _rp.then((possibleScenarios: tPossibleScenarioTypes) => {
      let primaryScenList: vscode.QuickPickItem[] = [];
      let secondaryScenList: vscode.QuickPickItem[] = [];

      for (let index: number = 0; index < possibleScenarios.primaryTypes.length; index++) {
         primaryScenList.push({
            label: possibleScenarios.primaryTypes[index].name,
            description: possibleScenarios.primaryTypes[index].className
         });
      }

      for (let index: number = 0; index < possibleScenarios.secondaryTypes.length; index++) {
         secondaryScenList.push({
            label: possibleScenarios.secondaryTypes[index].name,
            description: possibleScenarios.secondaryTypes[index].className
         });
      }

      vscode.window.showQuickPick(primaryScenList, { placeHolder: "What scenario type ?" })
         .then((value: vscode.QuickPickItem) => {
            if (value.label == "Other...") {
               vscode.window.showQuickPick(secondaryScenList, { placeHolder: "What scenario type ?" })
                  .then((value: vscode.QuickPickItem) => {
                     doCreateScen(className, value.description);
                  });
            } else {
               doCreateScen(className, value.description);
            }
         });
   }).catch((rejectReason) => {
      vscode.window.showErrorMessage("Error: " + rejectReason);
   });
}

/**
 * Search for a class	
 *
 * @param criteria string The message to show.
 * @return the class name selected.
 * when the message was dismissed.
 */
function searchClass(callBackFunc: searchClassCallBack, promptText: string = 'Class name or criteria') {
   var editor = vscode.window.activeTextEditor;
   var text = '';
   if (!editor) {
      text = '';
   } else {
      var selection = editor.selection;
      text = editor.document.getText(selection);
   }

   config = vscode.workspace.getConfiguration('ewam');
   vscode.window.showInputBox({ prompt: promptText, value: text })
      .then(criteria => {
         if (criteria == undefined) {
            //cancelled
            return;
         }

         if (criteria == '') {
            //cancelled
            vscode.window.showWarningMessage("You must provide an ancestor !");
            return;
         }

         axios.default.get(config.get('url') + '/ewam/api/rest/searchEntities',
            {
               data: { "searchParams": { "q": criteria+"*", "_class": true, "_module":true } }
            })
            .then(function (response) {
               // console.log(response);
               if (getRenamedData(response.data).length == 0) {
                  vscode.window.showWarningMessage(criteria + " not found.");
               } else {
                  vscode.window.showQuickPick(getRenamedData(response.data))
                  .then((selection) => {
                     if (selection != undefined) {
                        if (selection.exactType == "aClassDef" || selection.exactType == "aReimplemModuleDef" ||
                           selection.exactType == "aModuleDef" || selection.exactType == "aReimplemClassDef") {
                           callBackFunc(selection.label);
                        } else {
                           interact(selection.location);
                        }

                     }
                  });
               }
            })
            .catch((rejectReason: any) => {
               vscode.window.showErrorMessage("Error: " + rejectReason);
            });
      }
      );
}

function run() {
   config = vscode.workspace.getConfiguration('ewam');

   let launchMode: string = config.get('applicationLauncher')['mode'];
   let launchClass: string = config.get('applicationLauncher')['class'];
   let launchItem: string = config.get('applicationLauncher')['item'];

   if (launchMode == 'class') {

      axios.default.post(
         config.get('url') + '/ewam/api/rest/tryClass/' + launchClass)
         .then((response) => { })
         .catch((rejectReason: any) => {
            vscode.window.showErrorMessage("Error: " + rejectReason);
         });

   } else if (launchMode == 'method') {

      axios.default.post(
         config.get('url') + '/ewam/api/rest/tryMethod/' + launchClass + '/' + launchItem,
         config.get('applicationLauncherParams'))
         .then((response) => { })
         .catch((rejectReason: any) => {
            vscode.window.showErrorMessage("Error: " + rejectReason);
         });

   } else if (launchMode == 'scenario') {

      axios.default.post(
         config.get('url') + '/ewam/api/rest/tryScenario/' + launchClass + '/' + launchItem)
         .then((response) => { })
         .catch((rejectReason: any) => {
            vscode.window.showErrorMessage("Error: " + rejectReason);
         });

   }

}

export function activate(context: vscode.ExtensionContext) {

   console.log('"ewamvscadaptor" is now active');
   extensionContext = context;

   config = vscode.workspace.getConfiguration('ewam');

   // The server is implemented in node
   let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
   // The debug options for the server
   let debugOptions = { execArgv: ["--nolazy", "--debug=6004"] };

   // If the extension is launch in debug mode the debug server options are use
   // Otherwise the run options are used
   let serverOptions: ServerOptions = {
      run: { module: serverModule, transport: TransportKind.ipc },
      debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
   }

   // Options to control the language client
   let clientOptions: LanguageClientOptions = {
      // Register the server for plain text documents
      documentSelector: ['gold'],
      synchronize: {
         // Synchronize the setting section 'ewam' to the server
         configurationSection: 'ewam',
         // Notify the server about file changes to '.clientrc files contain in the workspace
         fileEvents: vscode.workspace.createFileSystemWatcher('**/.gold')
      },

      errorHandler: {

         error(error: Error, message: Message, count: number): ErrorAction {
            console.log(error);
            console.log(message);
            console.log(count);
            return ErrorAction.Continue;
         },

         closed(): CloseAction {
            return CloseAction.Restart;
         }

      }
      // export interface ErrorHandler {
      //     /**
      //      * An error has occurred while writing or reading from the connection.
      //      *
      //      * @param error - the error received
      //      * @param message - the message to be delivered to the server if know.
      //      * @param count - a count indicating how often an error is received. Will
      //      *  be reset if a message got successfully send or received.
      //      */
      //     error(error: Error, message: Message, count: number): ErrorAction;
      //     /**
      //      * The connection to the server got closed.
      //      */
      //     closed(): CloseAction;
      // }
   }

   // Create the language client and start the client.
   languageClient = new LanguageClient('Ewam VSServer', 'ewam-server', serverOptions, clientOptions);

   /*languageClient.onRequest({method: "onParseSuccessful"}, 
       (params: {newSource: string, docUri: string} ) => {
           var editor: vscode.TextEditor = null;
           
           // Look for the editor we parsed
           for (var index = 0; index < vscode.window.visibleTextEditors.length; index++) {
               if (vscode.window.visibleTextEditors[index].document.uri.toString() === params.docUri)
               {
                   editor = vscode.window.visibleTextEditors[index];
                   break;
               }
           }
           
           if (editor == null)
               return;
           
           editor.edit(
               editBuilder => {
                   var start: vscode.Position = new vscode.Position(0, 0);
                   var lastLine: number = editor.document.lineCount - 1;
                   
                   var end: vscode.Position = editor.document.lineAt(lastLine).range.end;
                   var range: vscode.Range = new vscode.Range(start, end);
                   
                   editBuilder.replace(range, params.newSource);
                   refreshUI();
                   parseBarItem.color = 'white';
               }
           );
           
           let moduleName : string = params.docUri.substring(
               params.docUri.lastIndexOf('/') + 1, params.docUri.lastIndexOf('.'));
               
           moduleDocumentationProvider.update(
               vscode.Uri.parse('ewam://modules/' + moduleName + '/module-preview'));
       }
   ); */

   /*languageClient.onRequest({method: "onSaveSuccessful"}, 
       (params: {newSource: string, docUri: string} ) => {
           var editor: vscode.TextEditor = null;
           
           // Look for the editor we parsed
           for (var index = 0; index < vscode.window.visibleTextEditors.length; index++) {
               if (vscode.window.visibleTextEditors[index].document.uri.toString() === params.docUri)
               {
                   editor = vscode.window.visibleTextEditors[index];
                   break;
               }
           }
           
           if (editor == null)
               return;
           
           editor.edit(
               editBuilder => {
                   var start: vscode.Position = new vscode.Position(0, 0);
                   var lastLine: number = editor.document.lineCount - 1;
                   
                   var end: vscode.Position = editor.document.lineAt(lastLine).range.end;
                   var range: vscode.Range = new vscode.Range(start, end);
                   
                   editBuilder.replace(range, params.newSource);
                   refreshUI();
                   parseBarItem.color = 'white';
               }
           ).then((value : boolean) => {
               editor.document.save();
           });
       }
   );*/

   languageClient.onRequest({ method: "getRootPath" },
      (params: any): string => {
         return vscode.workspace.rootPath;
      }
   );

   /*languageClient.onNotification({method: "showNotification"}, 
      (params : {type:string, message:string}) => {
         if (params.type == "error") {
            vscode.window.showErrorMessage(params.message);
         } else if (params.type == "warning") {
            vscode.window.showWarningMessage(params.message);
         } else if (params.type == "information") {
            vscode.window.showInformationMessage(params.message);
         }
      }
   );*/

   let disposable = languageClient.start();

   // Push the disposable to the context's subscriptions so that the 
   // client can be deactivated on extension deactivation
   context.subscriptions.push(disposable);

   var pathIcon = context.asAbsolutePath('images\\dot.png');
   parsingErrorDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(128,64,64,0.5)',
      overviewRulerLane: vscode.OverviewRulerLane.Right
   });
   breakPointDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: pathIcon
   });

   var myOutputChannel = vscode.window.createOutputChannel('eWam');
   myOutputChannel.append('eWam plugin started');

   disposable = vscode.commands.registerCommand('ewam.openEntity', function () {
      searchClass(openClass);
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.checkIn', function () {
      checkInClass(getOpenClassName());
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.checkOut', function () {
      checkOutClass(getOpenClassName());
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.deliver', function () {
      GenericPostOperation(getOpenClassName(), 'deliver');
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.parse', function () {
      parse(true);
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.reimplem', function () {
      GenericPostOperation(getOpenClassName(), 'ManageReimplem');
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.newClass', function () {
      searchClass(newClass, 'Parent class name');
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.newModule', function () {
      newModule();
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.metaInfo', function () {
      metaInfo();
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.scenario', function () {
      getScenario(getOpenClassName(), editScenario);
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.run', function () {
      run();
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.classTree', function () {
      classTree();
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.showModuleDocumentation', function () {
      let docPath = vscode.window.activeTextEditor.document.uri.path;
      var className = docPath.substring(
         docPath.lastIndexOf('/') + 1, docPath.lastIndexOf('.')
      );

      return showModuleDocumentation(className);
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.buildDependenciesRepo', function () {
      buildDependenciesRepo();
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.syncWorkspaceRepo', function () {
      syncWorkspaceRepo();
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.try', function () {
      runContext();
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.syncTGV', function () {
      SyncTGV();
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.syncAll', function () {
      SyncAll();
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.syncGit', function () {
      SyncGit();
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.dummyCommand', function () {
      dummyCommand();
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.refreshFromTGV', function () {
      refreshFromTGV();
   });
   context.subscriptions.push(disposable);

   //  disposable = vscode.commands.registerCommand('ewam.diffTest', function() {
   //      diffTest();
   //  });
   //  context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.createScenario', function () {
      createNewScenario(getOpenClassName());
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.setReadOnly', function () {
      setReadOnly(vscode.window.activeTextEditor.document.fileName);
   });
   context.subscriptions.push(disposable);

   disposable = vscode.commands.registerCommand('ewam.openIDE', function () {
      openIDE();
   });
   context.subscriptions.push(disposable);
   
   disposable = vscode.commands.registerCommand('ewam.stopService', function () {
      stopService();
   });
   context.subscriptions.push(disposable);
   

   parseBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6);
   parseBarItem.text = '$(beaker) Parse'
   parseBarItem.tooltip = 'Parse class';
   parseBarItem.command = 'ewam.parse';
   parseBarItem.show();

   classtreeBarItemMain = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
   classtreeBarItemMain.text = '$(clippy) Class Tree'
   classtreeBarItemMain.tooltip = 'Show Class Tree';
   classtreeBarItemMain.command = 'ewam.classTree';
   classtreeBarItemMain.show();

   var statusBarItemMain = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6);
   statusBarItemMain.text = '$(inbox) Open'
   statusBarItemMain.tooltip = 'Open entity';
   statusBarItemMain.command = 'ewam.openEntity';
   statusBarItemMain.show();

   statusBarItemMain = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6);
   statusBarItemMain.text = '$(info) Class Info'
   statusBarItemMain.tooltip = 'Metamodel information';
   statusBarItemMain.command = 'ewam.metaInfo';
   statusBarItemMain.show();

   checkOutBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6);
   checkOutBarItem.text = '$(cloud-download) Check Out'
   checkOutBarItem.tooltip = 'Check out';
   checkOutBarItem.command = 'ewam.checkOut';

   checkInBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6);
   checkInBarItem.text = '$(cloud-upload) Check In'
   checkInBarItem.tooltip = 'Check in Class';
   checkInBarItem.command = 'ewam.checkIn';

   reimplemBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6);
   reimplemBarItem.text = '$(jersey) Reimplem'
   reimplemBarItem.tooltip = 'Reimplem';
   reimplemBarItem.command = 'ewam.reimplem';

   reimplemBarItem.show();

   statusBarItemMain = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
   statusBarItemMain.text = '$(plus) New Class'
   statusBarItemMain.tooltip = 'New Class';
   statusBarItemMain.command = 'ewam.newClass';
   statusBarItemMain.show();

   statusBarItemMain = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
   statusBarItemMain.text = '$(triangle-right) Run'
   statusBarItemMain.tooltip = 'Run Application';
   statusBarItemMain.command = 'ewam.run';
   statusBarItemMain.show();

   scenarioBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6);
   scenarioBarItem.text = '$(hubot) Scenarios'
   scenarioBarItem.tooltip = 'Edit scenarios';
   scenarioBarItem.command = 'ewam.scenario';

   vscode.workspace.onWillSaveTextDocument(
      (event: vscode.TextDocumentWillSaveEvent) => {
         if (event.document.languageId == "gold") {

         }
      }
   );

   vscode.workspace.onDidChangeTextDocument(
      (event: vscode.TextDocumentChangeEvent) => {

         if (event.document.languageId == "gold") {

            let now: number = new Date().getTime();

            if (parsePlanned)
               return;

            if (lastParse == undefined || now - lastParse > 1000) {
               parse(false, event.document);
               lastParse = now;
            } else {
               setTimeout(
                  () => {
                     parse(false, event.document);
                     parsePlanned = false;
                     lastParse = now;
                  },
                  1000
               );
               parsePlanned = true;
            }
         }
      }
   );

   vscode.workspace.onWillSaveTextDocument(
      (saveEvt: vscode.TextDocumentWillSaveEvent) => {
         // console.log('opened document');
         let document: vscode.TextDocument = saveEvt.document;
         if (document.languageId == "gold" && saving == false) {
            // console.log('... a Gold document !');
            save(true, document);
         } else {
            saving = false;
         }
      }
   );

   vscode.workspace.onDidOpenTextDocument(
      (document: vscode.TextDocument) => {
         // console.log('opened document ' + document.fileName + '\n');
         if (document.languageId == "gold") {
            // console.log('... a Gold document !');


            // Retrieve the latest source code, if we haven't modified the original version
            // ...

            // Get the current parsing errors
            parse(false, document);
            RefreshMetaInfo(GetClassNameFromPath(document.uri.fsPath));
         }
      }
   );

   vscode.window.onDidChangeActiveTextEditor(
      (editor: vscode.TextEditor) => {
         // console.log('focus on document ' + editor.document.fileName + '\n');
         if (editor.document.languageId == "gold") {
            // console.log('... a Gold document !');
            //  getLastknownImplemVersion(getOpenClassName(editor.document))
            //  .then((implemNumber : number) => {
            //     console.log("Currently known implemVersion: " + implemNumber);
            //  });
            checkStatus(editor.document);
            parse(false, editor.document);
            RefreshMetaInfo(GetClassNameFromPath(editor.document.uri.fsPath));
         }
      }
   );


   vscode.languages.setLanguageConfiguration("gold", { "comments": { "lineComment": ";" } });

   moduleDocumentationProvider = new ModuleDocumentationContentProvider();
   let registration = vscode.workspace.registerTextDocumentContentProvider('ewam', moduleDocumentationProvider);

   // vscode.window.showInformationMessage("eWAM Plugin activated");

   disposable = vscode.window.setStatusBarMessage('Ready');
   context.subscriptions.push(disposable);

   fileWatcher = vscode.workspace.createFileSystemWatcher("**/*.god");

   fileWatcher.onDidChange((event: vscode.Uri) => {
      // console.log("onDidChange " + event.fsPath);
      if (isOpenedInWorkspace(event)) {
         RefreshMetaInfo(GetClassNameFromPath(event.fsPath));
      }
   });

   fileWatcher.onDidCreate((event: vscode.Uri) => {
      // console.log("onDidCreate " + event.fsPath);
      if (isOpenedInWorkspace(event)) {
         LoadMetaInfo(GetClassNameFromPath(event.fsPath));
      }
   });

   fileWatcher.onDidDelete((event: vscode.Uri) => {
      // console.log("onDidDelete " + event.fsPath);
      if (isOpenedInWorkspace(event)) {
         DeleteMetaInfo(GetClassNameFromPath(event.fsPath));
      }
   });
}

// this method is called when your extension is deactivated
export function deactivate() {
   // saveCache();
   console.log("eWAM extension deactivation");
   return;
}

