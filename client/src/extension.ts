// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
'use strict';

import * as path from 'path';

import { LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, TransportKind }
    from 'vscode-languageclient';
import { languages, Diagnostic, DiagnosticSeverity, TextDocumentContentProvider} from 'vscode';

import * as vscode from 'vscode';
import * as axios from 'axios';
import * as fs from 'fs';

let EXTENSION = '.gold';
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

function openClass(name: string) {
    if (!vscode.workspace.rootPath) {
        vscode.window.showErrorMessage("eWam open: Cannot work without opened folder");
        return;
    }

    axios.get(config.get('url') + '/api/rest/classOrModule/' + name)
        .then(function(response) {
            vscode.window.setStatusBarMessage('eWam Parsing Ok');
            /* editor.edit(editBuilder => {            
                 editBuilder.replace(editor.selection, response.data.content);     
                 }
             );*/

            //console.log(vscode.workspace.rootPath);
            var fileName = vscode.workspace.rootPath + '\\' + name + EXTENSION;

            fs.writeFile(fileName, response.data["content"], function(err) {

                if (err) throw err;
                //var uploadingStatus = vscode.window.setStatusBarMessage("Class imported " + fileName);

                var configDocument = vscode.workspace.openTextDocument(fileName);
                configDocument.then(function(document) {
                    vscode.window.showTextDocument(document);
                    refreshUI();
                });
                /*
                const spawn = require('child_process').spawn;
                const ls = spawn('git', ['add', fileName], { cwd: vscode.workspace.rootPath, env: process.env });

                ls.stdout.on('data', (data) => {
                    console.log(`stdout: ${data}`);
                });*/
            });
        })
        .catch(function(response) {
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
            console.log(vscode.workspace.rootPath);
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
    if (!doc) {
        doc  = vscode.window.activeTextEditor.document;
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
                    refreshUI();
                    parseBarItem.color = 'white';
                }
            );
            
            let moduleName : string = params.docUri.substring(
                params.docUri.lastIndexOf('/') + 1, params.docUri.lastIndexOf('.'));
                
            moduleDocumentationProvider.update(
                vscode.Uri.parse('ewam://modules/' + moduleName + '/module-preview'));
        }
    );
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
            console.log(response);
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

function newClass() {
    vscode.window.showInputBox({ prompt: 'Parent class name', value: '' })
        .then(parent => {
            if (parent != undefined) {
                vscode.window.showInputBox({ prompt: 'Class name', value: '' })
                    .then(name => {
                        if (name != undefined) {
                            axios.put(config.get('url') + '/api/rest/classOrModule/', { content: '', ancestor: parent, name: name })
                                .then(function(response) {
                                    console.log(response);
                                    openClass(name);
                                });
                        }
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
                                    vscode.window.showQuickPick(['Override']).then(action => {

                                    });
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
                                                        editBuilder.replace(selection, getDataAsString(method));
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
function searchClass(callBackFunc: searchClassCallBack) {
    var editor = vscode.window.activeTextEditor;
    var text = '';
    if (!editor) {
        text = '';
    } else {
        var selection = editor.selection;
        text = editor.document.getText(selection);
    }

    config = vscode.workspace.getConfiguration('ewam');
    vscode.window.showInputBox({ prompt: 'Class name or criteria', value: text })
        .then(criteria => {
            axios.get(config.get('url') + '/api/rest/searchEntities',
                {
                    params: {
                        q: criteria
                    }
                })
                .then(function(response) {
                    console.log(response);
                    vscode.window.showQuickPick(getDataAsTable(response))
                        .then((selection) => {
                            if (selection != undefined) {
                                if (selection.theType == "aClassDef" || selection.theType == "aReimplemModuleDef" ||
                                    selection.theType == "aModuleDef" || selection.theType == "aReimplemClassDef") {
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
        }
    }

    // Create the language client and start the client.
    languageClient = new LanguageClient('Ewam VSServer', serverOptions, clientOptions);
    

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
        newClass();
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
    ;
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
            console.log('opened document ' + document.fileName + '\n');
            if (document.languageId == "gold") {
                // console.log('... a Gold document !');
                parse(false, document);
            }
        }
    );
    
    vscode.window.onDidChangeActiveTextEditor( 
        (editor : vscode.TextEditor) => {
            console.log('focus on document ' + editor.document.fileName + '\n');
            if (editor.document.languageId == "gold") {
                // console.log('... a Gold document !');
                parse(false, editor.document);
            }
        }
    );
    
    vscode.languages.setLanguageConfiguration("gold", {"comments": { "lineComment": ";" } } );
    
    moduleDocumentationProvider = new ModuleDocumentationContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider('ewam', moduleDocumentationProvider);
    
    disposable = vscode.window.setStatusBarMessage('Ready');
    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
   return;
}

