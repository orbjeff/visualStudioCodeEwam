// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
'use strict';

import * as path from 'path';

import { LanguageClient, LanguageClientOptions, ErrorAction, CloseAction, SettingMonitor, ServerOptions, TransportKind }
    from 'vscode-languageclient';

import { Message, RequestHandler, NotificationHandler, RequestType, NotificationType, Trace, Event } from 'vscode-jsonrpc';

import { languages, Diagnostic, DiagnosticSeverity, TextDocumentContentProvider } from 'vscode';

import * as vscode from 'vscode';
import * as axios from 'axios';
import * as fs from 'fs';

var url = require('url');
var http = require('http');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

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
let lastParse : number;
let languageClient : LanguageClient;
let saving : boolean = false;
let parsePlanned : boolean = false;
let extensionContext : vscode.ExtensionContext;


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


// Whatching files:
// fs.watch(...)

function diffTest () : any {
    return vscode.commands.getCommands(false).then( (commands : string[]) => {
        // vscode.window.showQuickPick(commands);
        var leftFile : vscode.Uri = vscode.Uri.parse("file:///D:\\Desktop\\hotspot_UP.bat");
        var rightFile : vscode.Uri = vscode.Uri.parse("file:///D:\\Desktop\\hotspot_DOWN.bat");

        vscode.window.activeTextEditor.document.uri

        return vscode.commands.executeCommand(
            "vscode.diff",
            leftFile,
            rightFile,
            "Yo Bro"
        ).then((result) => {});

        // return commands;
    });
}

function SyncAll() {

    SyncTGV().then( (result : any) => {
        SyncGit().then( () => {
            buildDependenciesRepo().then( (result : any) => {});
        });

        buildDependenciesRepo().then( (result : any) => {});
    });
}

function getMethodAtLine(line: number,  doc? : vscode.TextDocument) : Thenable<string> {

    if (!doc) {
        doc  = vscode.window.activeTextEditor.document;
    }

    return languageClient.sendRequest(
        { method: "getMethodAtLine" },
        {
            "classname": getOpenClassName(doc),
            "line": line
        } 
    )
    .then(
        (methodName : string) => {
            // console.log("... " + methodName);
            return methodName;
        }
    );
}

function runContext() {
    // Get Context (class name, method name)
    let activeEditor : vscode.TextEditor = vscode.window.activeTextEditor;

    if (activeEditor == undefined || activeEditor == null || !activeEditor)
        return;
    
    let cursorPosition : vscode.Selection = activeEditor.selection;

    let className : string = getOpenClassName(activeEditor.document);

    vscode.window.showQuickPick(
        [
            "try class",
            "try method",
            "try scenario"
        ]
    ).then( (choice : string) => {

        config = vscode.workspace.getConfiguration('ewam');

        if (choice == "try class") {

            axios.post(config.get('url') + '/api/rest/tryClass/' + className, {})
            .then( (response : any) => {
                
            })
            .catch( (response : any) => {
                console.log(response);
            });

        } else if (choice == "try method") {

            getMethodAtLine(cursorPosition.start.line, activeEditor.document)
            .then( (methodName : string) => {
                if (methodName == "") {

                    vscode.window.showWarningMessage("Cursor doesn't seem to be on a method. Place the cursor on the method you want to test.")

                } else {

                    axios.post(config.get('url') + '/api/rest/tryMethod/' + className + '/' + methodName, {})
                    .then( (response : any) => {
                        
                    })
                    .catch( (response : any) => {
                        console.log(response);
                    });

                }
            });

        } else if (choice == "try scenario") {

            axios.get(config.get('url') + '/api/rest/classOrModule/' + className + '/scenarios', {})
            .then( (response : any) => {
                vscode.window.showQuickPick(response.data)
                .then((selection) => {
                    axios.post(config.get('url') + '/api/rest/tryScenario/' + className + '/' + selection["label"], {})
                });
            })
            .catch( (response : any) => {
                console.log(response);
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

function SyncGit() : any {
    vscode.window.showInformationMessage("Synchronizing git...");
    return vscode.commands.executeCommand("workbench.action.git.sync").then( () => {
        vscode.window.showInformationMessage("Git sync done.");
    });
}

function SyncTGV() : any {
    vscode.window.showInformationMessage(
        "Syncing your environment's TGVs...");
    
    return axios.post(config.get('url') + '/api/rest/repository/synchronize', {})
    .then( (response : any) => {
        vscode.window.showInformationMessage("TGV sync done.");
    });
}

function buildDependenciesRepo() : any {
    vscode.window.showInformationMessage(
        "Loading dependencies, this may take a few minutes, please be patient...");
    
    vscode.window.showInformationMessage(
        "You will be notified when loading is finished.");
    
    return languageClient.sendRequest({ method: "buildDependenciesRepo" }, {})
    .then( (params : any) => {
        vscode.window.showInformationMessage("Finished loading dependencies.");
    });
}

function syncWorkspaceRepo() {
    vscode.window.showInformationMessage(
        "Synchronizing workspace, this may take a few minutes, please be patient...");
    vscode.window.showInformationMessage("You will be notified when loading is finished.");
    
    languageClient.sendRequest({ method: "syncWorkspaceRepo" }, {})
    .then( (params: any ) => {
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

    http.get(options, function(res) {
        res.on('data', function(data) {
            file.write(data);
        }).on('end', function() {
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
        axios.get(config.get('url') + '/api/rest/classOrModule/' + name + '/entityStatus')
            .then(function(response) {
                if (response.data["checkedOut"]) {
                    checkInBarItem.show();
                    checkOutBarItem.hide();
                    scenarioBarItem.show();
                    reimplemBarItem.show();
                    parseBarItem.show();
                } else {
                    checkInBarItem.hide();
                    checkOutBarItem.show();
                    scenarioBarItem.hide();
                    reimplemBarItem.hide();
                    parseBarItem.hide();
                }
                setDecoForStopPoints(response.data["stopPoints"]);
            });
    }
}

function recursiveMkdir(path : string) {
    let dirs = path.split("\\");

    let curPath : string = "";

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

    axios.get(config.get('url') + '/api/rest/classOrModule/' + name)
    .then((response) => {
        vscode.window.setStatusBarMessage('eWam Parsing Ok');

        languageClient.sendRequest(
            { method: "getModulePath" },
            { "moduleName": name } 
        ).then((modulePath: string) => {
            var fileName = modulePath + "\\" + name + EXTENSION;

            try {
                fs.accessSync(modulePath)
            } catch (err) {
                recursiveMkdir(modulePath);
            };
            
            fs.writeFile(fileName, response.data["content"], function(err)
            {
                if (err) throw err;

                vscode.workspace.openTextDocument(fileName)
                .then( (document) => {
                    vscode.window.showTextDocument(document);
                    refreshUI();
                });
            });
        });
    })
    .catch((response) => {
        console.log(response);
    });
}

function GenericPostOperation(name: string, op: string) {

    axios.post(config.get('url') + '/api/rest/classOrModule/' + name + '/' + op, {})
        .then(function(response) {
            refreshUI();
        })
        .catch(function(response) {
            console.log(response);
        });
}

function checkInClass(name: string) {
    config = vscode.workspace.getConfiguration('ewam');
    axios.post(config.get('url') + '/api/rest/classOrModule/' + name + '/checkIn', {})
        .then(function(response) {
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
        .catch(function(response) {
            console.log(response);
        });
}

function getOpenClassName(doc? : vscode.TextDocument) {
    if (doc == undefined || !doc) {
        if (vscode.window.activeTextEditor != undefined) {
            doc  = vscode.window.activeTextEditor.document;
        } else {
            return;
        }
    }

    var fpath = doc.fileName.replace(/^.*[\\\/]/, '');
    return fpath.substring(fpath.lastIndexOf('/') + 1, fpath.lastIndexOf('.'));
}

function parse(notifyNewSource: Boolean = false, doc? : vscode.TextDocument) {
    
    if (!doc) {
        doc  = vscode.window.activeTextEditor.document;
    }
    
    languageClient.sendRequest(
        { method: "parse" },
        {
            "classname": getOpenClassName(doc),
            "source": doc.getText(),
            "notifyNewSource" : notifyNewSource,
            "uri": doc.uri.toString()
        } 
    ).then(
        (params: {newSource: string, docUri: string} ) => {
            if (params.docUri == '' && params.newSource == '')
                return;
                
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
                    parseBarItem.color = 'white';
                }
            );
            
            let moduleName : string = params.docUri.substring(
                params.docUri.lastIndexOf('/') + 1, params.docUri.lastIndexOf('.'));
                
            moduleDocumentationProvider.update(
                vscode.Uri.parse('ewam://modules/' + moduleName + '/module-preview'));
        }
    );
    
    refreshUI();
}

function save(notifyNewSource: Boolean = false, doc? : vscode.TextDocument) {
    
    saving = true;
    
    if (!doc) {
        doc  = vscode.window.activeTextEditor.document;
    }
    
    languageClient.sendRequest(
        { method: "save" },
        {
            "classname": getOpenClassName(doc),
            "source": doc.getText(),
            "notifyNewSource" : notifyNewSource,
            "uri": doc.uri.toString()
        } 
    ).then(
        (params: {newSource: string, docUri: string} ) => {
            if (params.docUri == '' && params.newSource == '') {
                saving = false;
                return;
            }
            
            let editor: vscode.TextEditor = null;
            
            // Look for the editor we parsed
            for (var index = 0; index < vscode.window.visibleTextEditors.length; index++) {
                if (vscode.window.visibleTextEditors[index].document.uri.toString() === params.docUri)
                {
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
            ).then((value : boolean) => {
                editor.document.save().then(
                    () => {
                        saving = false;
                    },
                    (reason : any) => {
                        saving = false;
                    });
            });
        },
        (reason : any) => {
            saving = false;
        }
    );
}

function classTree() {
    
    let editor = vscode.window.activeTextEditor;
    let uri = editor.document.uri.path
    
    var moduleName = uri.substring(
        uri.lastIndexOf('/') + 1, uri.lastIndexOf('.')
    );
    
    // let signatureReq = rp({
    //     method: 'POST',
    //     uri: url + '/api/rest/classOrModule/' + moduleName + '/signaturehelp/',
    //     body: body,
    //     json: true });
    
    if (!vscode.workspace.rootPath) {
        vscode.window.showErrorMessage("eWam Class Tree: Cannot work without opened folder");
        return;
    }

    axios.post(config.get('url') + '/api/rest/classOrModule/' + moduleName + '/showInTree')
        .then(function(response) {
            // console.log(response);
        })
        .catch(function(response) {
            console.log(response);
        });
    
}

class ModuleDocumentationContentProvider implements TextDocumentContentProvider {
    
    // onDidChange: vscode.Event<vscode.Uri>;
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): string | Thenable<string> {
        let moduleName : string = uri.path.substring(
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

let moduleDocumentationProvider : ModuleDocumentationContentProvider;

function showModuleDocumentation (moduleName : string) : Thenable<any>{

    let previewUri = vscode.Uri.parse('ewam://modules/' + moduleName + '/module-preview');
    // let previewUri = vscode.Uri.parse('file:///' + vscode.workspace.rootPath + '/' + moduleName + '.html');
    
    return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two)
    .then(
        (success) => {},
        (reason) => { vscode.window.showErrorMessage(reason); } );
} 

function getModuleDocumentation(moduleName : string) : string | Thenable<string> {
    return languageClient.sendRequest(
        { "method": "getModuleDocumentation" },
        { "moduleName": moduleName }
    );
}

interface getScenarioCallBack { (className: string, scenarioName: string): void }

function getDataAsTable(response): any[] {
    return response.data;
}

function getDataAsString(response): string {
    return response.data;
}

function getScenario(classname: string, callBack: getScenarioCallBack) {

    axios.get(config.get('url') + '/api/rest/classOrModule/' + classname + '/scenarios')
        .then(function(response) {

            vscode.window.showQuickPick(getDataAsTable(response))
                .then((selection) => {
                    callBack(classname, selection["label"])
                });
        })
        .catch(function(response) {
            console.log(response);
        });
}

function newClass(parentClass : string) {
    if (parentClass != undefined) {
        vscode.window.showInputBox({ prompt: 'Class name', value: '' })
        .then(name => {
            if (name != undefined) {
                axios.put(config.get('url') + '/api/rest/classOrModule/', { content: '', ancestor: parentClass, name: name })
                .then(function(response) {
                    // console.log(response);
                    openClass(name);
                })
                .catch( (error) => {
                    vscode.window.showWarningMessage("Class couldn't be created, check the class name is correct and doesn't already exist.")
                });
            }
        });
    }

}

function newModule() {
    vscode.window.showInputBox({ prompt: 'Module name', value: '' })
    .then(name => {
        if (name != undefined) {
            axios.put(config.get('url') + '/api/rest/classOrModule/', { content: '', ancestor: '', name: name })
            .then(function(response) {
                // console.log(response);
                openClass(name);
            });
        }
    });
}

function editScenario(classname: string, scenarioName: string) {

    axios.get(config.get('url') + '/api/rest/classOrModule/' + classname + '/scenarios/' + scenarioName)
        .then(function(response) {

        })
        .catch(function(response) {
            console.log(response);
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
                axios.get(config.get('url') + '/api/rest/classOrModule/' + classname + '/' + choice)
                    .then(function(response) {
                        vscode.window.showQuickPick(getDataAsTable(response)).then(selected => {
                            if (selected != undefined) {
                                if (choice == 'Variables') {
                                    // vscode.window.showQuickPick(['Override']).then(action => {
                                    //     axios.get(config.get('url') + choice)
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
                                            axios.post(config.get('url') + selected.location + '/breakPoint', {})
                                            .then(function(method) {
                                                refreshUI();
                                            });
                                        } else if (action == 'Override') {
                                            axios.get(config.get('url') + selected.location)
                                            .then(function(method) {

                                                editor = vscode.window.activeTextEditor;
                                                editor.edit(editBuilder => {
                                                    // var start = new vscode.Position(0, 0);                                                         
                                                    // var end = new vscode.Position(0, 1);
                                                    // var range = new vscode.Range(start, end);
                                                    var selection = editor.selection;
                                                    editBuilder.replace(selection, "\n" + getDataAsString(method) + " override\nend\n");
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
                    .catch(function(response) {
                        console.log(response);
                    });
            }
        });
    }
}

interface searchClassCallBack { (className: string): void }

function interact(uri: string) {
    vscode.window.showQuickPick(['interact', 'checkOut', 'checkIn','deliver'], { placeHolder: 'What operation do you want?' })
        .then(choice => {
            if (choice == 'interact') {
                config = vscode.workspace.getConfiguration('ewam');
                axios.get(config.get('url') + uri + '/'+choice)
                    .then(function(response) {
                    }).catch(function(response) {
                    });
            } else if (choice != undefined){
                 config = vscode.workspace.getConfiguration('ewam');
                axios.post(config.get('url') + uri + '/'+choice)
                    .then(function(response) {
                    }).catch(function(response) {
                    });
            }
        });
}

/**
 * Search for a class	
 *
 * @param criteria string The message to show.
 * @return the class name selected.
 * when the message was dismissed.
 */
function searchClass(callBackFunc: searchClassCallBack, promptText : string = 'Class name or criteria') {
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
            axios.get(config.get('url') + '/api/rest/searchEntities',
                {
                    params: {
                        q: criteria
                    }
                })
                .then(function(response) {
                    // console.log(response);
                    vscode.window.showQuickPick(getDataAsTable(response))
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
                })
                .catch(function(response) {
                    console.log(response);
                });
        }
        );
}

function run() {
    config = vscode.workspace.getConfiguration('ewam');
    axios.post(config.get('url') + '/api/rest/run/' + config.get('className') + '/' + config.get('methodName'), config.get('args'))
    .then(function(response) {
    });
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

        errorHandler : {
            
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
    
    languageClient.onRequest({method: "getRootPath"}, 
        (params : any) : string => {
            return vscode.workspace.rootPath;
        }
    );

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
    
    disposable = vscode.commands.registerCommand('ewam.openEntity', function() {
        searchClass(openClass);
    });
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerCommand('ewam.checkIn', function() {
        checkInClass(getOpenClassName());
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.checkOut', function() {
        GenericPostOperation(getOpenClassName(), 'checkOut');
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.deliver', function() {
        GenericPostOperation(getOpenClassName(), 'deliver');
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.parse', function() {
        parse(true);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.reimplem', function() {
        GenericPostOperation(getOpenClassName(), 'ManageReimplem');
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.newClass', function() {
        searchClass(newClass, 'Parent class name');
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.newModule', function() {
        newModule();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.metaInfo', function() {
        metaInfo();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.scenario', function() {
        getScenario(getOpenClassName(), editScenario);
    });
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerCommand('ewam.run', function() {
        run();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.classTree', function() {
        classTree();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.showModuleDocumentation', function() {
        let docPath = vscode.window.activeTextEditor.document.uri.path;
        var className = docPath.substring(
            docPath.lastIndexOf('/') + 1, docPath.lastIndexOf('.')
        );
        
        return showModuleDocumentation(className);
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.buildDependenciesRepo', function() {
        buildDependenciesRepo();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.syncWorkspaceRepo', function() {
        syncWorkspaceRepo();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.try', function() {
        runContext();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.syncTGV', function() {
        SyncTGV();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.syncAll', function() {
        SyncAll();
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('ewam.syncGit', function() {
        SyncGit();
    });
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerCommand('ewam.diffTest', function() {
        diffTest();
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
    
    vscode.workspace.onDidChangeTextDocument(
        (event : vscode.TextDocumentChangeEvent) => {
            // console.log('opened document');
            if (event.document.languageId == "gold") {
                // console.log('... a Gold document !');
                let now : number = new Date().getTime();
                
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
    
    vscode.workspace.onDidSaveTextDocument( 
        (document : vscode.TextDocument) => {
            // console.log('opened document');
            if (document.languageId == "gold" && saving == false) {
                // console.log('... a Gold document !');
                save(true, document);
            } else {
                saving  = false;
            }
        }
    );
    
    vscode.workspace.onDidOpenTextDocument(
        (document : vscode.TextDocument) => {
            // console.log('opened document ' + document.fileName + '\n');
            if (document.languageId == "gold") {
                // console.log('... a Gold document !');
                parse(false, document);
            }
        }
    );
    
    vscode.window.onDidChangeActiveTextEditor( 
        (editor : vscode.TextEditor) => {
            // console.log('focus on document ' + editor.document.fileName + '\n');
            if (editor.document.languageId == "gold") {
                // console.log('... a Gold document !');
                parse(false, editor.document);
            }
        }
    );
    
    vscode.languages.setLanguageConfiguration("gold", {"comments": { "lineComment": ";" } } );
    
    moduleDocumentationProvider = new ModuleDocumentationContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider('ewam', moduleDocumentationProvider);
    
    // vscode.window.showInformationMessage("eWAM Plugin activated");

    disposable = vscode.window.setStatusBarMessage('Ready');
    context.subscriptions.push(disposable);

}

// this method is called when your extension is deactivated
export function deactivate() {
    console.log("eWAM extension deactivation");
    return;
}

