// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var vscode_languageclient_1 = require("vscode-languageclient");
var vscode = require("vscode");
var axios = require("axios");
var fs = require("fs");
var path = require("path");
var rp = require('request-promise');
var url = require('url');
var http = require('http');
var EXTENSION = '.god';
var scenarioBarItem;
var checkInBarItem;
var checkOutBarItem;
var reimplemBarItem;
var parseBarItem;
var classtreeBarItemMain;
var parsingErrorDecorationType;
var breakPointDecorationType;
var config;
var lastParse;
var languageClient;
var saving = false;
var parsePlanned = false;
var extensionContext;
var fileWatcher;
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
function openIDE() {
    return axios.default.get(config.get('url') + '/system/OpenIDE')
        .then(function (response) {
        if (response.data == true) {
            return true;
        }
        else {
            return false;
        }
    }).catch(function (rejectReason) {
        vscode.window.showErrorMessage("Error: " + rejectReason);
        return false;
    });
}
function stopService() {
    return axios.default.post(config.get('url') + '/ewam/api/rest/system/stopservice')
        .then(function (response) {
        if (response.data == true) {
            return true;
        }
        else {
            return false;
        }
    }).catch(function (rejectReason) {
        vscode.window.showErrorMessage("Error: " + rejectReason);
        return false;
    });
}
function refreshFromTGV(doc) {
    if (doc == undefined || !doc) {
        if (vscode.window.activeTextEditor != undefined) {
            doc = vscode.window.activeTextEditor.document;
        }
        else {
            return;
        }
    }
    var moduleName = getOpenClassName(doc);
    openClass(moduleName);
    RefreshMetaInfo(moduleName);
}
function isGoldDocument(fileUri) {
    var filePath = fileUri.toString();
    var extension = filePath.substring(filePath.lastIndexOf('.') + 1);
    return (extension == 'god' || extension == 'gold');
}
function isOpenedInWorkspace(fileUri) {
    var result = false;
    var filePath = path.normalize(fileUri.toString());
    vscode.workspace.textDocuments.forEach(function (document) {
        var openedFilePath = path.normalize(document.uri.toString());
        // console.log("isOpenedInWorkspace " + openedFilePath + " " + filePath);
        if (openedFilePath == filePath) {
            result = true;
            return;
        }
    });
    return result;
}
function GetClassNameFromPath(path) {
    var moduleName = path.substring(path.lastIndexOf('\\') + 1, path.lastIndexOf('.'));
    return moduleName;
}
function LoadMetaInfo(moduleName) {
    return languageClient.sendRequest({ method: "LoadMetaInfo" }, { params: { "moduleName": moduleName } })
        .then(function () { });
}
function RefreshMetaInfo(moduleName) {
    // console.log("client RefreshMetaInfo " + moduleName);
    return languageClient.sendRequest({ method: "RefreshMetaInfo" }, { moduleName: moduleName })
        .then(function () { });
}
function DeleteMetaInfo(moduleName) {
    return languageClient.sendRequest({ method: "DeleteMetaInfo" }, { params: { "moduleName": moduleName } })
        .then(function () { });
}
function dummyCommand() {
    var cacheString = fs.readFileSync(vscode.workspace.rootPath + "\\.tmp\\ewamcache.json", 'utf8');
    console.log("dgfndfklgfdklgnkldfgn\n" + cacheString + "\nflsdjgdjhgdfhkh");
}
function compareFiles(localModulePath, moduleName, tgvSource) {
    var leftFile = vscode.Uri.parse("file:" + vscode.workspace.rootPath + "/.tmp/" + moduleName + ".tgv.god");
    var rightFile = vscode.Uri.parse("file:" + localModulePath + "/" + moduleName + ".god");
    try {
        if (fs.existsSync(leftFile.fsPath)) {
            fs.unlinkSync(leftFile.fsPath);
        }
        fs.writeFileSync(leftFile.fsPath, tgvSource);
        // setReadOnly(leftFile.fsPath);
    }
    catch (writeError) {
        console.log("Couldn't write " + leftFile.fsPath + " \n" + writeError);
    }
    var result;
    try {
        var compareAlreadyOpen = false;
        for (var index = 0; index < vscode.workspace.textDocuments.length; index++) {
            var document_1 = vscode.workspace.textDocuments[index];
            if (document_1.fileName == leftFile.fsPath) {
                compareAlreadyOpen = true;
            }
        }
        if (!compareAlreadyOpen) {
            vscode.window.showInformationMessage("Source code from TGV has changed ! Compare and modify your version before saving (right pan).");
            var result_1 = vscode.commands.executeCommand("vscode.diff", leftFile, rightFile, "TGV (" + leftFile.fsPath.substring(leftFile.fsPath.lastIndexOf("\\") + 1) + ") | local (" + rightFile.fsPath.substring(rightFile.fsPath.lastIndexOf("\\") + 1) + ")").then(function (resParam) {
                // vscode.window.showInformationMessage("gruik !");
            });
        }
    }
    catch (compareError) {
        console.log("Couldn't compare " + leftFile.fsPath + " and " + rightFile.fsPath + "\n" + compareError);
    }
    return result;
}
function SyncAll() {
    SyncTGV().then(function (result) {
        SyncGit().then(function () {
            buildDependenciesRepo().then(function (result) { });
        });
    });
}
function getMethodAtLine(line, doc) {
    if (!doc) {
        doc = vscode.window.activeTextEditor.document;
    }
    return languageClient.sendRequest({ method: "getMethodAtLine" }, {
        "classname": getOpenClassName(doc),
        "line": line
    })
        .then(function (methodName) {
        // console.log("... " + methodName);
        return methodName;
    });
}
function runContext() {
    // Get Context (class name, method name)
    var activeEditor = vscode.window.activeTextEditor;
    if (activeEditor == undefined || activeEditor == null || !activeEditor)
        return;
    var cursorPosition = activeEditor.selection;
    var className = getOpenClassName(activeEditor.document);
    vscode.window.showQuickPick([
        "try class",
        "try method",
        "try scenario"
    ]).then(function (choice) {
        config = vscode.workspace.getConfiguration('ewam');
        if (choice == "try class") {
            axios.default.post(config.get('url') + '/ewam/api/rest/tryClass/' + className, {})
                .then(function (response) {
            })
                .catch(function (rejectReason) {
                vscode.window.showErrorMessage("Error: " + rejectReason);
            });
        }
        else if (choice == "try method") {
            getMethodAtLine(cursorPosition.start.line, activeEditor.document)
                .then(function (methodName) {
                if (methodName == "") {
                    vscode.window.showWarningMessage("Cursor doesn't seem to be on a method. Place the cursor on the method you want to test.");
                }
                else {
                    axios.default.post(config.get('url') + '/ewam/api/rest/tryMethod/' + className + '/' + methodName, {})
                        .then(function (response) {
                    })
                        .catch(function (rejectReason) {
                        vscode.window.showErrorMessage("Error: " + rejectReason);
                    });
                }
            });
        }
        else if (choice == "try scenario") {
            axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + className + '/scenarios', {})
                .then(function (response) {
                vscode.window.showQuickPick(getRenamedData(response.data))
                    .then(function (selection) {
                    axios.default.post(config.get('url') + '/ewam/api/rest/tryScenario/' + className + '/' + selection["name"], {});
                });
            })
                .catch(function (rejectReason) {
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
function SyncGit() {
    vscode.window.showInformationMessage("Synchronizing git...");
    return vscode.commands.executeCommand("workbench.action.git.sync").then(function () {
        vscode.window.showInformationMessage("Git sync done.");
    });
}
function SyncTGV() {
    vscode.window.showInformationMessage("Syncing your environment's TGVs...");
    return axios.default.post(config.get('url') + '/ewam/api/rest/repository/synchronize', {})
        .then(function (response) {
        vscode.window.showInformationMessage("TGV sync done.");
    }).catch(function (rejectReason) {
        vscode.window.showErrorMessage("Error: " + rejectReason);
    });
}
function buildDependenciesRepo() {
    vscode.window.showInformationMessage("Loading dependencies, this may take a few minutes, please be patient...");
    vscode.window.showInformationMessage("You will be notified when loading is finished.");
    return languageClient.sendRequest({ method: "buildDependenciesRepo" }, {})
        .then(function (params) {
        vscode.window.showInformationMessage("Finished loading dependencies.");
    });
}
function syncWorkspaceRepo() {
    vscode.window.showInformationMessage("Synchronizing workspace, this may take a few minutes, please be patient...");
    vscode.window.showInformationMessage("You will be notified when loading is finished.");
    languageClient.sendRequest({ method: "syncWorkspaceRepo" }, {})
        .then(function (params) {
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
    for (var _i = 0, methods_1 = methods; _i < methods_1.length; _i++) {
        var method = methods_1[_i];
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
                parseBarItem.show();
                //fs.fstat()
                //vscode.window.activeTextEditor.document.uri.fsPath
            }
            else {
                checkInBarItem.hide();
                checkOutBarItem.show();
                scenarioBarItem.hide();
                reimplemBarItem.hide();
                parseBarItem.hide();
            }
            setDecoForStopPoints(response.data["stopPoints"]);
        }).catch(function (rejectReason) {
            vscode.window.showErrorMessage(rejectReason);
        });
    }
}
function recursiveMkdir(path) {
    var dirs = path.split("\\");
    var curPath = "";
    for (var dir in dirs) {
        curPath += dirs[dir] + "\\";
        try {
            fs.accessSync(curPath);
        }
        catch (err) {
            fs.mkdirSync(curPath);
        }
    }
}
function openClass(name) {
    if (!vscode.workspace.rootPath) {
        vscode.window.showErrorMessage("eWam open: Cannot work without opened folder");
        return;
    }
    axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + name)
        .then(function (response) {
        languageClient.sendRequest({ method: "getModulePath" }, { "moduleName": name }).then(function (modulePath) {
            var fileName = modulePath + "\\" + name + EXTENSION;
            fileName = path.normalize(fileName);
            try {
                fs.accessSync(modulePath);
            }
            catch (err) {
                recursiveMkdir(modulePath);
            }
            ;
            if (fs.existsSync(fileName)) {
                fs.chmod(fileName, '0666');
            }
            var responseData = response.data['content'];
            fs.writeFile(fileName, responseData, function (err) {
                if (err)
                    throw err;
                vscode.workspace.openTextDocument(fileName)
                    .then(function (document) {
                    vscode.window.showTextDocument(document);
                    refreshUI();
                });
            });
        });
    })
        .catch(function (rejectReason) {
        vscode.window.showErrorMessage("Error: " + rejectReason);
    });
}
function setReadOnly(fileName) {
    fs.chmodSync(fileName, '0444');
}
function setReadWrite(fileName) {
    fs.chmodSync(fileName, '0666');
}
function loadCache() {
    return languageClient.sendRequest({ method: "loadCache" }, { param: {} })
        .then(function () { });
}
function saveCache() {
    return languageClient.sendRequest({ method: "saveCache" }, { param: {} })
        .then(function () { });
}
function getLastknownImplemVersion(className) {
    var result = -1;
    return languageClient.sendRequest({ method: "getLastknownImplemVersion" }, { "moduleName": className }).then(function (versionNumber) {
        return versionNumber;
    });
}
function getImplemVersion(currentSource) {
    var implemVersionPos = currentSource.indexOf('(Implem Version:') + 16;
    var implemVersion = +currentSource.substring(implemVersionPos, currentSource.indexOf(')', implemVersionPos));
    return implemVersion;
}
function getDefVersion(currentSource) {
    var defVersionPos = currentSource.indexOf('(Def Version:') + 13;
    var defVersion = +currentSource.substring(defVersionPos, currentSource.indexOf(')', defVersionPos));
    return defVersion;
}
function isCheckOut(className) {
    return axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + className + '/entityStatus')
        .then(function (statusResponse) {
        if (statusResponse.data["checkedOut"]) {
            return true;
        }
        else {
            return false;
        }
    }).catch(function (rejectReason) {
        vscode.window.showErrorMessage("Error: " + rejectReason);
        return false;
    });
}
function checkStatus(doc) {
    if (doc == undefined || !doc) {
        if (vscode.window.activeTextEditor != undefined) {
            doc = vscode.window.activeTextEditor.document;
        }
        else {
            return;
        }
    }
    var className = getOpenClassName(doc);
    // Retrieve status
    return isCheckOut(className)
        .then(function (checkedOut) {
        if (!checkedOut) {
            setReadOnly(doc.fileName);
            // vscode.window.showWarningMessage("'" + className + "' isn't checked out. Modifications won't be saved in TGVs, and will be lost after next \"Open Entity\" !")
        }
    });
}
function checkBeforeSave(doc) {
    if (doc == undefined || !doc) {
        if (vscode.window.activeTextEditor != undefined) {
            doc = vscode.window.activeTextEditor.document;
        }
        else {
            return;
        }
    }
    var className = getOpenClassName(doc);
    var currentSource = doc.getText();
    return isCheckOut(className).then(function (checkedOut) {
        if (checkedOut) {
            return languageClient.sendRequest({ method: "getModulePath" }, { "moduleName": className }).then(function (modulePath) {
                var fileName = modulePath + "\\" + className + EXTENSION;
                // get last known implem version for this class
                return languageClient.sendRequest({ method: "getLastknownImplemVersion" }, { "moduleName": className })
                    .then(function (lastKnownImplem) {
                    // Retrieve status to get current implem
                    return axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + className + '/entityStatus')
                        .then(function (statusResponse) {
                        // Compare remote version to local version => Diff if differs
                        // let defVersion : number = getDefVersion(currentSource); 
                        // let implemVersion : number = getImplemVersion(currentSource);
                        // TGV source changed !
                        if (lastKnownImplem != -1 && lastKnownImplem != statusResponse.data["implemVersion"]) {
                            // Retrieve TGV source code version
                            return axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + className)
                                .then(function (sourceResponse) {
                                var tgvSource = sourceResponse.data["content"];
                                return compareFiles(modulePath, className, tgvSource);
                            }).catch(function (rejectReason) {
                                vscode.window.showErrorMessage("Error: " + rejectReason);
                            });
                        }
                        else {
                            if (fs.existsSync(modulePath + "\\" + className + ".tgv" + EXTENSION)) {
                                fs.unlink(modulePath + "\\" + className + ".tgv" + EXTENSION);
                            }
                        }
                    }).catch(function (rejectReason) {
                        vscode.window.showErrorMessage("Error: " + rejectReason);
                    });
                });
            });
        }
        else {
            vscode.window.showWarningMessage(className + " isn't checked out, you can't save your changes.");
        }
    });
}
function GenericPostOperation(name, op) {
    axios.default.post(config.get('url') + '/ewam/api/rest/classOrModule/' + name + '/' + op, {})
        .then(function (response) {
        refreshUI();
    })
        .catch(function (rejectReason) {
        vscode.window.showErrorMessage("Error: " + rejectReason);
    });
}
function checkOutClass(name) {
    axios.default.post(config.get('url') + '/ewam/api/rest/classOrModule/' + name + '/checkOut', {})
        .then(function (response) {
        refreshUI();
        languageClient.sendRequest({ method: "getModulePath" }, { "moduleName": name }).then(function (modulePath) {
            setReadWrite(modulePath + "\\" + name + ".god");
        });
    })
        .catch(function (rejectReason) {
        vscode.window.showErrorMessage("Error: " + rejectReason);
    });
}
function checkInClass(name) {
    config = vscode.workspace.getConfiguration('ewam');
    axios.default.post(config.get('url') + '/ewam/api/rest/classOrModule/' + name + '/checkIn', {})
        .then(function (response) {
        // console.log(vscode.workspace.rootPath);
        var fileName = vscode.workspace.rootPath + '\\' + name + EXTENSION;
        var spawn = require('child_process').spawn;
        var ls = spawn('git', ['commit', fileName, '-m', '"Message"'], { cwd: vscode.workspace.rootPath, env: process.env });
        ls.stdout.on('data', function (data) {
            console.log("stdout: " + data);
        });
        refreshUI();
    })
        .catch(function (rejectReason) {
        vscode.window.showErrorMessage("Error: " + rejectReason);
    });
}
function getOpenClassName(doc) {
    if (doc == undefined || !doc) {
        if (vscode.window.activeTextEditor != undefined) {
            doc = vscode.window.activeTextEditor.document;
        }
        else {
            return;
        }
    }
    var fpath = doc.fileName.replace(/^.*[\\\/]/, '');
    return fpath.substring(fpath.lastIndexOf('/') + 1, fpath.lastIndexOf('.'));
}
function parse(notifyNewSource, doc) {
    if (notifyNewSource === void 0) { notifyNewSource = false; }
    if (!doc) {
        doc = vscode.window.activeTextEditor.document;
    }
    languageClient.sendRequest({ method: "parse" }, {
        "classname": getOpenClassName(doc),
        "source": doc.getText(),
        "notifyNewSource": notifyNewSource,
        "uri": doc.uri.toString()
    }).then(function (params) {
        if (params.docUri == '' && params.newSource == '')
            return;
        var editor = null;
        // Look for the editor we parsed
        for (var index = 0; index < vscode.window.visibleTextEditors.length; index++) {
            if (vscode.window.visibleTextEditors[index].document.uri.toString() === params.docUri) {
                editor = vscode.window.visibleTextEditors[index];
                break;
            }
        }
        if (editor == null)
            return;
        editor.edit(function (editBuilder) {
            var start = new vscode.Position(0, 0);
            var lastLine = editor.document.lineCount - 1;
            var end = editor.document.lineAt(lastLine).range.end;
            var range = new vscode.Range(start, end);
            editBuilder.replace(range, params.newSource);
            parseBarItem.color = 'white';
        });
        var moduleName = params.docUri.substring(params.docUri.lastIndexOf('/') + 1, params.docUri.lastIndexOf('.'));
        moduleDocumentationProvider.update(vscode.Uri.parse('ewam://modules/' + moduleName + '/module-preview'));
    });
    refreshUI();
}
function save(notifyNewSource, doc) {
    if (notifyNewSource === void 0) { notifyNewSource = false; }
    saving = true;
    if (!doc) {
        doc = vscode.window.activeTextEditor.document;
    }
    var moduleName = getOpenClassName(doc);
    var source = doc.getText();
    checkBeforeSave(doc).then(function () {
        languageClient.sendRequest({ method: "save" }, {
            "classname": moduleName,
            "source": source,
            "notifyNewSource": notifyNewSource,
            "uri": doc.uri.toString()
        }).then(function (params) {
            if (params.docUri == '' && params.newSource == '') {
                saving = false;
                return;
            }
            var editor = null;
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
            editor.edit(function (editBuilder) {
                var start = new vscode.Position(0, 0);
                var lastLine = editor.document.lineCount - 1;
                var end = editor.document.lineAt(lastLine).range.end;
                var range = new vscode.Range(start, end);
                editBuilder.replace(range, params.newSource);
                refreshUI();
                parseBarItem.color = 'white';
            }).then(function (value) {
                editor.document.save().then(function () {
                    saving = false;
                }, function (reason) {
                    saving = false;
                });
            });
        }, function (reason) {
            saving = false;
        });
    });
}
function classTree() {
    var editor = vscode.window.activeTextEditor;
    var uri = editor.document.uri.path;
    var moduleName = uri.substring(uri.lastIndexOf('/') + 1, uri.lastIndexOf('.'));
    if (!vscode.workspace.rootPath) {
        vscode.window.showErrorMessage("eWam Class Tree: Cannot work without opened folder");
        return;
    }
    axios.default.post(config.get('url') + '/ewam/api/rest/classOrModule/' + moduleName + '/showInTree')
        .then(function (response) {
        // console.log(response);
    })
        .catch(function (rejectReason) {
        vscode.window.showErrorMessage("Error: " + rejectReason);
    });
}
var ModuleDocumentationContentProvider = /** @class */ (function () {
    function ModuleDocumentationContentProvider() {
        // onDidChange: vscode.Event<vscode.Uri>;
        this._onDidChange = new vscode.EventEmitter();
    }
    ModuleDocumentationContentProvider.prototype.provideTextDocumentContent = function (uri, token) {
        var moduleName = uri.path.substring(uri.path.indexOf('/') + 1, uri.path.lastIndexOf('/module-preview'));
        return getModuleDocumentation(moduleName);
    };
    Object.defineProperty(ModuleDocumentationContentProvider.prototype, "onDidChange", {
        get: function () {
            return this._onDidChange.event;
        },
        enumerable: true,
        configurable: true
    });
    ModuleDocumentationContentProvider.prototype.update = function (uri) {
        this._onDidChange.fire(uri);
    };
    return ModuleDocumentationContentProvider;
}());
;
var moduleDocumentationProvider;
function showModuleDocumentation(moduleName) {
    var previewUri = vscode.Uri.parse('ewam://modules/' + moduleName + '/module-preview');
    // let previewUri = vscode.Uri.parse('file:///' + vscode.workspace.rootPath + '/' + moduleName + '.html');
    return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two)
        .then(function (success) { }, function (reason) { vscode.window.showErrorMessage(reason); });
}
function getModuleDocumentation(moduleName) {
    return languageClient.sendRequest({ "method": "getModuleDocumentation" }, { "moduleName": moduleName });
}
function getRenamedData(data) {
    for (var index = 0; index < data.length; index++) {
        data[index]["label"] = data[index]["name"];
    }
    return data;
}
function getDataAsString(response) {
    return response.data;
}
function getScenario(classname, callBack) {
    axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + classname + '/scenarios')
        .then(function (response) {
        vscode.window.showQuickPick(getRenamedData(response.data))
            .then(function (selection) {
            callBack(classname, selection["name"]);
        });
    })
        .catch(function (rejectReason) {
        vscode.window.showErrorMessage("Error: " + rejectReason);
    });
}
function newClass(parentClass) {
    if (parentClass != undefined) {
        vscode.window.showInputBox({ prompt: 'Class name', value: '' })
            .then(function (name) {
            if (name != undefined) {
                axios.default.put(config.get('url') + '/ewam/api/rest/classOrModule/' + name + '/create', {
                    "implem": { "content": "", "ancestor": parentClass, "name": name }
                })
                    .then(function (response) {
                    // console.log(response);
                    openClass(name);
                })
                    .catch(function (rejectReason) {
                    vscode.window.showErrorMessage("Class couldn't be created, check the class name is correct and doesn't already exist. (Error: " + rejectReason + ")");
                });
            }
        });
    }
}
function newModule() {
    vscode.window.showInputBox({ prompt: 'Module name', value: '' })
        .then(function (name) {
        if (name != undefined) {
            axios.default.put(config.get('url') + '/ewam/api/rest/classOrModule/' + name + '/create', {
                "implem": { "content": '', "ancestor": "", "name": name }
            })
                .then(function (response) {
                // console.log(response);
                openClass(name);
            }).catch(function (rejectReason) {
                vscode.window.showErrorMessage("Error: " + rejectReason);
            });
        }
    });
}
function editScenario(classname, scenarioName) {
    axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + classname + '/scenarios/' + scenarioName)
        .then(function (response) {
    })
        .catch(function (rejectReason) {
        vscode.window.showErrorMessage("Error: " + rejectReason);
    });
}
function metaInfo() {
    var classname = '';
    var editor = vscode.window.activeTextEditor;
    if (!editor) {
    }
    else {
        var selection = editor.selection;
        classname = editor.document.getText(selection);
    }
    if (classname == '') {
        classname = getOpenClassName();
    }
    if (classname != '') {
        vscode.window.showQuickPick(['Variables', 'Methods', 'Parents', 'Descendants', 'Sisters', 'Types'], { placeHolder: 'What meta data do you want?' }).then(function (choice) {
            if (choice != undefined) {
                axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + classname + '/' + choice)
                    .then(function (response) {
                    vscode.window.showQuickPick(getRenamedData(response.data)).then(function (selected) {
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
                            }
                            else if (choice == 'Methods') {
                                vscode.window.showQuickPick(['Override', 'Toggle Break Point']).then(function (action) {
                                    if (action == 'Toggle Break Point') {
                                        // axios.default.post(config.get('url') + selected.location + '/breakPoint', {})
                                        // rest/classOrModule/{name}/methods/{methodName}/breakPoint */
                                        console.log(config.get('url') + '/ewam/api/rest/classOrModule/' + classname + '/methods/' + selected.label + '/breakPoint');
                                        axios.default.post(config.get('url') + '/ewam/api/rest/classOrModule/' + classname + '/methods/' + selected.label + '/breakPoint', {})
                                            .then(function (method) {
                                            refreshUI();
                                        });
                                    }
                                    else if (action == 'Override') {
                                        //axios.default.get(config.get('url') + selected.location)
                                        axios.default.get(config.get('url') + '/ewam/api/rest/classOrModule/' + classname + '/methods/' + selected.label, {})
                                            .then(function (response) {
                                            editor = vscode.window.activeTextEditor;
                                            editor.edit(function (editBuilder) {
                                                // var start = new vscode.Position(0, 0);                                                         
                                                // var end = new vscode.Position(0, 1);
                                                // var range = new vscode.Range(start, end);
                                                var selection = editor.selection;
                                                editBuilder.replace(selection, "\n" + response.data["signature"] + " override\nend\n");
                                            });
                                        });
                                    }
                                });
                            }
                            else if (choice == 'Parents' || choice == 'Descendants' || choice == 'Sisters') {
                                openClass(selected.label);
                            }
                        }
                    });
                })
                    .catch(function (rejectReason) {
                    vscode.window.showErrorMessage("Error: " + rejectReason);
                });
            }
        });
    }
}
function interact(uri) {
    vscode.window.showQuickPick(['interact', 'checkOut', 'checkIn', 'deliver'], { placeHolder: 'What operation do you want?' })
        .then(function (choice) {
        if (choice == 'interact') {
            config = vscode.workspace.getConfiguration('ewam');
            axios.default.get(config.get('url') + uri + '/' + choice)
                .then(function (response) {
            }).catch(function (rejectReason) {
                vscode.window.showErrorMessage("Error: " + rejectReason);
            });
        }
        else if (choice != undefined) {
            config = vscode.workspace.getConfiguration('ewam');
            axios.default.post(config.get('url') + uri + '/' + choice)
                .then(function (response) {
            }).catch(function (rejectReason) {
                vscode.window.showErrorMessage("Error: " + rejectReason);
            });
        }
    });
}
function createNewScenario(className) {
    var doCreateScen = function (className, scenarioType) {
        vscode.window.showInputBox({ prompt: "Name for scenario (optional)" })
            .then(function (scenarioName) {
            var _rp = rp({
                method: 'PUT',
                uri: config.get('url') + '/ewam/api/rest/classOrModule/' + className + '/createScenario/' + scenarioType,
                json: true,
                body: { "scenarioName": scenarioName }
            });
            _rp.then(function () {
            }).catch(function (rejectReason) {
                vscode.window.showErrorMessage("Error: " + rejectReason);
            });
        });
    };
    var _rp = rp({
        method: 'GET',
        uri: config.get('url') + '/ewam/api/rest/classOrModule/' + className + '/possibleScenario/',
        json: true
    });
    _rp.then(function (possibleScenarios) {
        var primaryScenList = [];
        var secondaryScenList = [];
        for (var index = 0; index < possibleScenarios.primaryTypes.length; index++) {
            primaryScenList.push({
                label: possibleScenarios.primaryTypes[index].name,
                description: possibleScenarios.primaryTypes[index].className
            });
        }
        for (var index = 0; index < possibleScenarios.secondaryTypes.length; index++) {
            secondaryScenList.push({
                label: possibleScenarios.secondaryTypes[index].name,
                description: possibleScenarios.secondaryTypes[index].className
            });
        }
        vscode.window.showQuickPick(primaryScenList, { placeHolder: "What scenario type ?" })
            .then(function (value) {
            if (value.label == "Other...") {
                vscode.window.showQuickPick(secondaryScenList, { placeHolder: "What scenario type ?" })
                    .then(function (value) {
                    doCreateScen(className, value.description);
                });
            }
            else {
                doCreateScen(className, value.description);
            }
        });
    }).catch(function (rejectReason) {
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
function searchClass(callBackFunc, promptText) {
    if (promptText === void 0) { promptText = 'Class name or criteria'; }
    var editor = vscode.window.activeTextEditor;
    var text = '';
    if (!editor) {
        text = '';
    }
    else {
        var selection = editor.selection;
        text = editor.document.getText(selection);
    }
    config = vscode.workspace.getConfiguration('ewam');
    vscode.window.showInputBox({ prompt: promptText, value: text })
        .then(function (criteria) {
        if (criteria == undefined) {
            //cancelled
            return;
        }
        if (criteria == '') {
            //cancelled
            vscode.window.showWarningMessage("You must provide an ancestor !");
            return;
        }
        axios.default.get(config.get('url') + '/ewam/api/rest/searchEntities', {
            data: { "searchParams": { "q": criteria + "*", "_class": true, "_module": true } }
        })
            .then(function (response) {
            // console.log(response);
            if (getRenamedData(response.data).length == 0) {
                vscode.window.showWarningMessage(criteria + " not found.");
            }
            else {
                vscode.window.showQuickPick(getRenamedData(response.data))
                    .then(function (selection) {
                    if (selection != undefined) {
                        if (selection.exactType == "aClassDef" || selection.exactType == "aReimplemModuleDef" ||
                            selection.exactType == "aModuleDef" || selection.exactType == "aReimplemClassDef") {
                            callBackFunc(selection.label);
                        }
                        else {
                            interact(selection.location);
                        }
                    }
                });
            }
        })
            .catch(function (rejectReason) {
            vscode.window.showErrorMessage("Error: " + rejectReason);
        });
    });
}
function run() {
    config = vscode.workspace.getConfiguration('ewam');
    var launchMode = config.get('applicationLauncher')['mode'];
    var launchClass = config.get('applicationLauncher')['class'];
    var launchItem = config.get('applicationLauncher')['item'];
    if (launchMode == 'class') {
        axios.default.post(config.get('url') + '/ewam/api/rest/tryClass/' + launchClass)
            .then(function (response) { })
            .catch(function (rejectReason) {
            vscode.window.showErrorMessage("Error: " + rejectReason);
        });
    }
    else if (launchMode == 'method') {
        axios.default.post(config.get('url') + '/ewam/api/rest/tryMethod/' + launchClass + '/' + launchItem, config.get('applicationLauncherParams'))
            .then(function (response) { })
            .catch(function (rejectReason) {
            vscode.window.showErrorMessage("Error: " + rejectReason);
        });
    }
    else if (launchMode == 'scenario') {
        axios.default.post(config.get('url') + '/ewam/api/rest/tryScenario/' + launchClass + '/' + launchItem)
            .then(function (response) { })
            .catch(function (rejectReason) {
            vscode.window.showErrorMessage("Error: " + rejectReason);
        });
    }
}
function activate(context) {
    console.log('"ewamvscadaptor" is now active');
    extensionContext = context;
    config = vscode.workspace.getConfiguration('ewam');
    // The server is implemented in node
    var serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
    // The debug options for the server
    var debugOptions = { execArgv: ["--nolazy", "--debug=6004"] };
    // If the extension is launch in debug mode the debug server options are use
    // Otherwise the run options are used
    var serverOptions = {
        run: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc },
        debug: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc, options: debugOptions }
    };
    // Options to control the language client
    var clientOptions = {
        // Register the server for plain text documents
        documentSelector: ['gold'],
        synchronize: {
            // Synchronize the setting section 'ewam' to the server
            configurationSection: 'ewam',
            // Notify the server about file changes to '.clientrc files contain in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.gold')
        },
        errorHandler: {
            error: function (error, message, count) {
                console.log(error);
                console.log(message);
                console.log(count);
                return vscode_languageclient_1.ErrorAction.Continue;
            },
            closed: function () {
                return vscode_languageclient_1.CloseAction.Restart;
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
    };
    // Create the language client and start the client.
    languageClient = new vscode_languageclient_1.LanguageClient('Ewam VSServer', 'ewam-server', serverOptions, clientOptions);
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
    languageClient.onRequest({ method: "getRootPath" }, function (params) {
        return vscode.workspace.rootPath;
    });
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
    var disposable = languageClient.start();
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
        var docPath = vscode.window.activeTextEditor.document.uri.path;
        var className = docPath.substring(docPath.lastIndexOf('/') + 1, docPath.lastIndexOf('.'));
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
    parseBarItem.text = '$(beaker) Parse';
    parseBarItem.tooltip = 'Parse class';
    parseBarItem.command = 'ewam.parse';
    parseBarItem.show();
    classtreeBarItemMain = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    classtreeBarItemMain.text = '$(clippy) Class Tree';
    classtreeBarItemMain.tooltip = 'Show Class Tree';
    classtreeBarItemMain.command = 'ewam.classTree';
    classtreeBarItemMain.show();
    var statusBarItemMain = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6);
    statusBarItemMain.text = '$(inbox) Open';
    statusBarItemMain.tooltip = 'Open entity';
    statusBarItemMain.command = 'ewam.openEntity';
    statusBarItemMain.show();
    statusBarItemMain = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6);
    statusBarItemMain.text = '$(info) Class Info';
    statusBarItemMain.tooltip = 'Metamodel information';
    statusBarItemMain.command = 'ewam.metaInfo';
    statusBarItemMain.show();
    checkOutBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6);
    checkOutBarItem.text = '$(cloud-download) Check Out';
    checkOutBarItem.tooltip = 'Check out';
    checkOutBarItem.command = 'ewam.checkOut';
    checkInBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6);
    checkInBarItem.text = '$(cloud-upload) Check In';
    checkInBarItem.tooltip = 'Check in Class';
    checkInBarItem.command = 'ewam.checkIn';
    reimplemBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6);
    reimplemBarItem.text = '$(jersey) Reimplem';
    reimplemBarItem.tooltip = 'Reimplem';
    reimplemBarItem.command = 'ewam.reimplem';
    reimplemBarItem.show();
    statusBarItemMain = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
    statusBarItemMain.text = '$(plus) New Class';
    statusBarItemMain.tooltip = 'New Class';
    statusBarItemMain.command = 'ewam.newClass';
    statusBarItemMain.show();
    statusBarItemMain = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    statusBarItemMain.text = '$(triangle-right) Run';
    statusBarItemMain.tooltip = 'Run Application';
    statusBarItemMain.command = 'ewam.run';
    statusBarItemMain.show();
    scenarioBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6);
    scenarioBarItem.text = '$(hubot) Scenarios';
    scenarioBarItem.tooltip = 'Edit scenarios';
    scenarioBarItem.command = 'ewam.scenario';
    vscode.workspace.onWillSaveTextDocument(function (event) {
        if (event.document.languageId == "gold") {
        }
    });
    vscode.workspace.onDidChangeTextDocument(function (event) {
        if (event.document.languageId == "gold") {
            var now_1 = new Date().getTime();
            if (parsePlanned)
                return;
            if (lastParse == undefined || now_1 - lastParse > 1000) {
                parse(false, event.document);
                lastParse = now_1;
            }
            else {
                setTimeout(function () {
                    parse(false, event.document);
                    parsePlanned = false;
                    lastParse = now_1;
                }, 1000);
                parsePlanned = true;
            }
        }
    });
    vscode.workspace.onWillSaveTextDocument(function (saveEvt) {
        // console.log('opened document');
        var document = saveEvt.document;
        if (document.languageId == "gold" && saving == false) {
            // console.log('... a Gold document !');
            save(true, document);
        }
        else {
            saving = false;
        }
    });
    vscode.workspace.onDidOpenTextDocument(function (document) {
        // console.log('opened document ' + document.fileName + '\n');
        if (document.languageId == "gold") {
            // console.log('... a Gold document !');
            // Retrieve the latest source code, if we haven't modified the original version
            // ...
            // Get the current parsing errors
            parse(false, document);
            RefreshMetaInfo(GetClassNameFromPath(document.uri.fsPath));
        }
    });
    vscode.window.onDidChangeActiveTextEditor(function (editor) {
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
    });
    vscode.languages.setLanguageConfiguration("gold", { "comments": { "lineComment": ";" } });
    moduleDocumentationProvider = new ModuleDocumentationContentProvider();
    var registration = vscode.workspace.registerTextDocumentContentProvider('ewam', moduleDocumentationProvider);
    // vscode.window.showInformationMessage("eWAM Plugin activated");
    disposable = vscode.window.setStatusBarMessage('Ready');
    context.subscriptions.push(disposable);
    fileWatcher = vscode.workspace.createFileSystemWatcher("**/*.god");
    fileWatcher.onDidChange(function (event) {
        // console.log("onDidChange " + event.fsPath);
        if (isOpenedInWorkspace(event)) {
            RefreshMetaInfo(GetClassNameFromPath(event.fsPath));
        }
    });
    fileWatcher.onDidCreate(function (event) {
        // console.log("onDidCreate " + event.fsPath);
        if (isOpenedInWorkspace(event)) {
            LoadMetaInfo(GetClassNameFromPath(event.fsPath));
        }
    });
    fileWatcher.onDidDelete(function (event) {
        // console.log("onDidDelete " + event.fsPath);
        if (isOpenedInWorkspace(event)) {
            DeleteMetaInfo(GetClassNameFromPath(event.fsPath));
        }
    });
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
    // saveCache();
    console.log("eWAM extension deactivation");
    return;
}
exports.deactivate = deactivate;
