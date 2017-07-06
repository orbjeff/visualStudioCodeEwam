# Visual Studio Code Ewam

This repo is a work in progress as Visual Studio Code is still in Beta by Microsoft.
This plugin leverage the eWam API to let you edit eWam Code With Visual Studio Code.


## Take a tour...
![eWam VSC](tour.gif)

## Requirements
* Visual Studio Code
* [Advanced Framework](https://github.com/MphasisWyde/ewam-advanced-framework)
* [eWam APIs](https://github.com/MphasisWyde/WydeActiveModelerAPI)

## Documentation

* [Documentation](https://mphasiswyde.atlassian.net/wiki/display/RTS/Visual+Studio+Code+extension)
* [Tutorial and feature documentation](https://mphasiswyde.atlassian.net/wiki/display/RTS/Tutorial)
* [Release notes and roadmap](https://mphasiswyde.atlassian.net/wiki/display/RTS/Release+Notes)

## Seting up developper environment

### Installation
* Clone this repo
* Run `npm install` in "server" folder
* Run `npm install` in "client" folder

### Get up and running straight away
* Run `code .` in "server" folder to edit language server source code
* Run `code .` in "client" folder to edit extension source code 
   * press F5 in VSCode from client workspace to run the extension
* press `F5` to open a new window with your extension loaded
* run your command from the command palette by pressing (`Ctrl+Shift+P` or `F1`) and typing `ewam`
* set breakpoints in `extension.ts` to debug the extension
* find output from your extension in the debug console

# Roadmap

## Upcoming tasks

- [ ] Parsing errors iteration 2 : code analyzer feedback (also see Wynsure rules that are applied at save time: aClassOrModuelControler)
- [ ] Synchronization : use the same code as the in-IDE synchronization, thus allowing for extensions (i.e. customizations used in Wynsure for various forms of sync)
- [ ] dependencies and project Repository should also remove files that don't correspond to classes anymore
- [ ] Implement contextual commands 
- [ ] Add watch on bundleIndex.json ? Yes : refresh cache because files may appear and or change bundle location.
- [ ] Forbid Class/module checkout/modification for dependencies <= maybe, useless since dependencies are checked in (and should be kept by integrator), thus in readonly  
- [ ] Class/module documentation with more info : variables/methodes/types/constantes/scenarios / REIMPLEMS
- [ ] Class tree as HTML preview
- [ ] Module list as HTML preview
- [ ] When opening a class/module, fold anotations
- [ ] Provide custom syntax theme base on "Dark (Visual Studio)" theme. 
- [ ] "Open eWam" command
- [ ] Handle "rebundling" (moving a project entity from its current bundle to a new one)

- [ ] Ergonomic way to override variables and methods
- [ ] Additional validations (check repo is writable)
- [ ] Other entity management (create new scenario, translation, ...)
- [ ] Verify compatibility 6.1 / 6.1.5 (test multi user) - seb
- [ ] Demo video (with OBS - https://obsproject.com/download)

- [ ] User documentation
- [ ] Integrator documentation / guidelines
   - Preparation de l’env VS Code
   - Installation de nouveaux bundles tiers
   - MAJ de bundles tiers
   - Prise en compte des nouvelles classes de developeurs
   - Bundle redesign

- Bug fixes and ergonomy
    - [ ] API performance (i.e. GetMetaInfo : 10s to get metainfo of aWFActor when AdvancedComponents not compiled, due to serializer)
      - use Florian's serializer for simple records
      - maybe cache metainfo in local file
   - [ ] Improve "Find references" feature to provide position in file (use metainfo or maybe ewam-open:// URL ?)
      - [ ] Explore ewam-open:// scheme handling with contentProviders, to lazy-load gold modules from URLs (might be useful in documentation or when accessing an entity we don't know the position yet)
   ... nothing left to do... we're nearly there !

## 2.0 supported as of eWAM 6.2

- [ ] API refactoring
   - [ ] Get read of advanced framework
   - [ ] APIs redesign : API restful (see swapi collections)
   - [ ] rename API url in /ewam/api/rest/...
   - [ ] Review APIs to use IsValid when necessary (checks entity is valid. Usefull when creating a new module / class to check if doesn't exist and name correct)
   - [ ] Implement better outlining / metainfo production API
      - [ ] Outlines and definitions should be provided after F7 parse
   - [ ] API proper and accurate documentation
   - [ ] API test
   - [ ] Remove "name" to "label" renaming in aModuleDefAPI.CustomizeSerializer, aModuleDefAPI.Suggest and aMRS_MMBrowserAPI.searchEntities
   - [ ] Since producing/parsing generates metainfo, and metainfo needs producing, the two should probably be returned by the same API

- [ ] Code refactoring / architecturing / documentation
   - [ ] Implement module management (open, save, parse, status update, etc).
   - [ ] Implement metainfo query API
   - [ ] Implement entity access management : local file + synchronization questions  
   - [ ] Implement "find entity" feature : look for any kind of entity : scenario, class, module, method, variable, constant, etc, and look at it in its container (class or module)

- [ ] Breakpoint management
- [ ] Debugger
- [ ] Cache management

- [ ] Improve "Find references" feature to provide position in file (use metainfo or maybe ewam-open:// URL ?)
   - [ ] Explore ewam-open:// scheme handling with contentProviders, to lazy-load gold modules from URLs (might be useful in documentation or when accessing an entity we don't know the position yet).


## Possible improvements 

- [ ] Review "Code Actions" feature : could be implemented using code analyzer
- [ ] Add watch on bundleIndex.json in order to detect bundle changes

#Demos

## First Demo to developers

- verifications
   - verify environment
   - verify synced
   - verify AdvancedComponents DLL is here
   - verify source code is here
- start with demo script (see below)
- Add people in Skype conversation
- Feedback : review draft emails : provide links to IMUTs for and and evolutions
- Suggest LiceCAP (show how it works comment ça marche)

## Demo script

```
- Presentation de VS Code
   - Extension eWam (marketplace)
   - Gestion du multiworkspace

- Environnement Wynsure classique
- Lancer le service eWam
- Install extension
- Open Workspace Folder
/ Synchroniser
- Présenter repository : .dependencies .unbundled etc.
- Ouvrir une classe ou nouvelle classe (aApplicativeRoot)
/ CheckOut / Checkin


- Coding :
   - Parse
      - Errors
   - Snipppets
   - Suggestions
   - Signature Help
   - Run
   - override
   - Commenting
   - Scenario Edition

- Navigation : 
   - Tooltips
   - Goto / Peek definition
      => aWFClient
   - Document symbols
      => GetLogin
   - Class documentation
   - Text search
      => text search "GetLogin"
   - Find all occurences
      => GetLogin of aWFActor

- Ergonomy
   - Rename
   - Checked in/out consistency
   - Local / TGV version class/module consistency 

- Class tree

- Fonctionnalités de debug : breakpoint

- déploiement : quelques dev alpha
   - accompagnement tutoriel
```

```
; aRedgisDemo (aApplicativeRoot) (Def Version:20) (Implem Version:20)

class aRedgisDemo (aApplicativeRoot) 

uses aWFDesc

type recordTypeName : record
   field1 : Int4
   field2 : Int4
endRecord
type recordTypeName2 : record (recordTypeName)
   field3 : Int4
   field4 : Int8
endRecord
type sequenceTypeName : sequence of recordTypeName2

[model(Text:'Assocoated Desc')]
[type:model(SingleRole:(WhatCanIDo:(CanSearch:false),RoleClass:'aSingleRoleType'))]
description : refTo [O] aWFDesc inverse MyOwner multiLang


procedure HelloWorld(Message1 : CString, Message2 : CString)
   uses aWFClient, Motor
   
   var recVar : recordTypeName2
   var client : aWFClient
   var login : CString
   var res : Int4
   
   Alert(Message1 + Message2)
   client = Motor.NewInstFromName('aWFClient')
   login = client.GetLogin
   ; res = Risky.CallWithMyStackEx(Nil, Nil, 0, 0, Nil)
   self.description = Nil
endProc
```

```
; aVSCodeDemo (aApplicativeRoot) (Def Version:178) (Implem Version:189)

class aVSCodeDemo (aApplicativeRoot)

login : CString


procedure HelloWorld(message1 : CString, message2 : CString)
   uses aWFActor
   
   var extract : CString
   var actor : aWFActor
   
   new(actor)
   self.login = ''
   self.login = actor.GetLogin
   self.Accept
   extract = self.StringExtract(FullExtract, 0, 256)
   Alert(message1 + ' ' + message2 + ' !')
   Alert('coucou xD')
   Alert('Super coucou :)')
   dispose(actor)
endProc 

procedure HelloWorld2(param1 : CString, param2 : CString)
   Alert(param1 + ' ' + param2 + ' !')
endProc 
```

# Changelog

## Alpha 0.3.5 - *Deliver on July 06, 2017*
   > /!\ Major API change : don't update unless WxWamAPI bundles have been installed in your environment. /!\
   - [x] Added .gitignore in Dev
   - [x] Fixed dependencies generation discrepencies (including file UTF8 encoding)
   - [x] Fixed source code character encoding problems
   - [x] Removed incorrect "eWam Parsing Ok" for now. Will rework this feature.
   - [x] Fixed default service network address to 127.0.0.1 rather then localhost
   - [x] Cut AdvancedFramework dependency for serialisation and REST routing

## Alpha 0.3.4 - *Deliver on January 31, 2017*
   - [x] Quick fix to open classes from the right location (dependencies / project)

## Alpha 0.3.3 - *Deliver on January 27, 2017*
   - [x] Changed default configuration for eWam Service port to comply with default configuration provided by eWam

## Alpha 0.3.2 - *Deliver on December 21, 2016*
   - [x] Refresh source from TGV
   - [x] Git free compliance
   - [x] Added Open IDE feature
   - [x] Added Stop Service feature
   
   Bug fixes and ergonomy
   - [x] Fixed non-normalize path when opening a file
   - [x] Improved ignored patterns in .gitignore
   - [x] Improved eWam command names
   - [x] Fixed Open Reimplem
   - [x] Fixed buggy reimplem parsing (creates a new module when parsing a reimplem !! Oo)
   - [x] Fixed duplicated call to buildDependenciesRepo
   - [x] Fixed suggestion issue
   - [x] Fixed error when getting metainfo for an undefined class/module name

## Alpha 0.3.1 - *Deliver on November 30, 2016*
   - [x] Added file watching and metainfo refresh on focus

## Alpha 0.3.0 - *Deliver on November 25, 2016*
   - [x] Official plugin release
   - [x] Publish plugin on npm

## Alpha 0.2.7 - *Deliver on November 25, 2016*

- [x] Implement "Add scenario"
   - [x] Check aModuleDefAPI.CreateNewScenario code with Eric (modif implem as well as def ?)
- [x] Symbol renaming
   - [x] Module or class renaming
- [x] Class / module checkout state integrity
   - [x] set files in readonly when not checked out
- [x] Class / module version integrity : check implem versions (tgv versus local file) or maybe user eWam global version 
   - [x] Open a compare when last known implem versions differ between TGV and local
- [x] Improved snippets
   - [x] Handle local metainfo cache file in order to help with consistency checking
- [x] Store metainfo and temp diff files in a .tmp folder in rootfolder

- Bug fixes and ergonomy
   - [x] WhereUsed : method are shown in the result...
   - [x] GetNodeURL not working. Waiting for Advanced Framework fix (done, see Fred's email "RE: Bug dans le serializer ?")
      - [x] Fix Override
      - [x] Fix Toggle breakpoint
   - [x] After a rename, new source code seems not to be always regenerated correctly. <= this was due to errors. The resulting source wasn't truncated
   - [x] Annotation errors aren't retrieved
      - [/] Parse / reformat isn't done in this case, eventhough no error is retrieved
      - [x] Save propably also fails, but no user feedback : provide notification in case of saving incorrectly parsed file
   - [x] crash on searchEntities with aWF* classes

## Alpha 0.2.6 - *Deliver on September 21, 2016*
    
- [x] Overriding
- [x] review diff / merge capabilities of VS Code (context of reimplems) : we diff whatever we want, using URI, so it could even be a content provider I expect

- Bug fixes and ergonomy
   - [x] Module parsing error due to aClassPreparer
   - [x] Breakpoint API not working
      - [x] Breakpoint UI refreshing
   - [x] New class : wrong parent (also check new module)
      - [x] + improved new class input (choose parent class from a suggestion list)
      - [x] Crash when class already exist : used IsValid
   - [x] Repair Run Application
   - [/] Add Open IDE feature
   - [x] Clean debug outputs
   - [x] Lookup API crashes

## Alpha 0.2.5 - *Deliver on September 14, 2016*

- [x] Add code snippets
- [x] Improve overall usability / stability, test all features ! Be the user developper.
   - [x] Implement a contextualized way to test things (run method, run class, run scenario ...)
   - [x] Make safe testing API blocking
    
- [x] sync all from VS Code (tgv sync + local dependencies + sync git)
   - [x] check git ignore

- [x] API: saves the module (ctrl+s) **even if inconsistent**

- Bug fixes and ergonomy
   - [x] "UBS in ascendants" error on "proc". Should be raised as a syntax error. In the meantime: /ERRORMESSAGE:FALSE
      - [x] make /ERRORMESSAGE:FALSE default when launching as a service
   - [x] Module creation doesn't work ...
   - [x] Breakpoint API not working
   - ~~[/] Add Open IDE feature~~ Impossible


- [ ] Improve "Find references" feature to provide position in file (use metainfo or maybe ewam-open:// URL ?)
   - [ ] Explore ewam-open:// scheme handling with contentProviders, to lazy-load gold modules from URLs (might be useful in documentation or when accessing an entity we don't know the position yet).
- [ ] Add watch on bundleIndex.json in order to detect bundle changes 
- [ ] review diff / merge capabilities of VS Code (context of reimplems)

## Alpha 0.2.4 - *Deliver on July 29, 2016*

- [x] Source code management
   - [x] JSON package index file : description of the repository  
   - [x] bundle JSON package : description file for a bundle, describing it's deliveries/classes/modules/everything content and hierarchy and **it's URL !**
   - [x] Dump repository from integrator env, based on bundles (+produce associated index and package files)
      - [x] Dump the dependencies source code
      - [x] Dump the workspace source code
   - [x] Dump repository based on given index file + bundle package files
   - [x] Keep a local VS Code cache of the classes bundles/deliveries. Keep in mind we the developper does not necessarily have the bundles / deliveries installed. Usually just synced from TGV
   - [ ] Add watch on bundleIndex.json in order to detect bundle changes
   - ~~[ ] Add workspace setting for the data repo building~~ : Not really needed for now
   - [x] Dump a module in the source repository based on bundleIndex.json file description and cache (e.g. in $rootPath/$Bundle/$Delivery/module.gold)
   - [x] Review plugin to account for these changes
      - [x] on the fly HTML documentation production (paths provided in the documentation links)
      - [x] path where the file of a module is retrieved when opening
      - [x] path where the file of a module is stored when saving
- [ ] review diff / merge capabilities of VS Code (context of reimplems)

```
> Execution of OPTIONS '/repository/generatePackagesIndex'...Done       -- 0.021000 seconds.
> Execution of POST '/repository/generatePackagesIndex'...Done  -- 91.665001 seconds.
> Execution of OPTIONS '/repository/buildProjectRepo'...Done    -- 0.007000 seconds.
> Execution of POST '/repository/buildProjectRepo'...Done       -- 99.942001 seconds.
> Execution of OPTIONS '/repository/buildDependenciesRepo'...Done       -- 0.007000 seconds.
> Execution of POST '/repository/buildDependenciesRepo'...Done  -- 295.181000 seconds.
```

Additional tasks :

- [x] Create git repository for our environnement
- [x] ~~Explore file:// scheme handling with contentProviders, to lazy-load gold modules~~ Not working : *"Activating extension `mphasiswyde.ewamvscadaptor` failed: scheme 'file' already registered."*
- [ ] Explore ewam-open:// scheme handling with contentProviders, to lazy-load gold modules from URLs.
- [ ] API: saves the module (ctrl+s) **even if inconsistent**
- [x] MMBrowser entry point : connection.onWorkspaceSymbol => metamodel browser request
- [ ] Improve "Find references" feature to provide position in file (use metainfo)
- [x] Improve outline : display full path to entity
- [x] Polish syntax highlighting : capture types in variable declarations
- Bug fixes and ergonomy
   - [x] fix item kind of suggestions
   - [x] Diagnostics doesn't work anymore (reformat not working anymore either)
   - [ ] Improve overall usability / stability
   - [ ] API performance : use Florian's serializer for simple records (i.e. GetMetaInfo : 10s to get metainfo of aWFActor when AdvancedComponents not compiled)

## Alpha 0.2.3 - *Deliver on May 20, 2016*

- [x] Timer on parse
- [x] Class tree visualization : handle directly the "select from name" based on the currently open module
- [x] Class documentation : improve robustness
- [x] Go to Definition on local variables
- [x] Polish syntax highlighting
- Bug fixes
   - [x] Too large CString assignment
   - [x] "Go To Definition" doesn't work anymore
    
## Alpha 0.2.2 - *Deliver on May 13, 2016*

- [x] Enable comments (i.e. CommentRule)
- [x] Add "myText" in documentation for the outlines
- ~~[ ] Make method parameter suggestions be documented~~ : Impossible due to underlying API restrictions
- [x] Class tree visualization : simple class tree interact
- [x] Class documentation : explore possibilities offered by virtual documents (investigate how to implement the previewHtml, cf. https://code.visualstudio.com/updates/vJanuary#_extension-authoring, or Code Flower extension http://www.redotheweb.com/CodeFlower/, https://bitbucket.org/wynsure/code-flower-and-dependency-wheel) :
   - unable to detect when we try to open a class (a file) from the preview links
   - vscode.previewHtml seems buggy : if I open it, close the preview, and re-open it, a crash occurs
- [x] Find references (Where used)

## Alpha 0.2.1 - *Deliver on May 4, 2016* [<img src="https://cdn0.iconfinder.com/data/icons/star-wars/48/x-wing-512.png" width="70"/>](http://www.google.fr/search?q=may+the+4th)

- [x] APIs: make work parse (without save) + save
- [x] Parse on open
- [x] Parse (F7) should be only a parse, no save
- [x] Native save (ctrl+s) : saves the module
- [x] Signature completion

## Alpha 0.2 - *Delivered on 29 April 2016*
   
- [x] Outline - regis
- [x] Symbol navigation (in documentation navigation + go to definition) - regis
- [x] Improve autocompletion (suggestions appear a bit randomly, and not when needed e.g. when typeing '.' or '(') - regis
- [x] Improve usability : retrieve metainfo on open
- [x] Improve outline and symbols APIs : use ProduceGold

## Alpha 0.1.x - *Delivered on March 30, 2016*
- [x] Syntax highlightings 
- [x] Code snippets
- [x] Open a class, `Alt+o`  
- [x] Checkin a class `Alt+i` 
- [x] Open scenarios `Alt+s` 
- [x] Parse `F7` 
- [x] Code completion  `Ctrl +' '`
- [x] Deliver  `Alt+d`
- [x] Reimplem  `Alt+r`
- [x] New class  `Alt+n`
- [x] Meta info  `Alt+m`
- [x] Contextual buttons
- [x] Run application `F5`
- [x] Override a method
- [x] Toggle break points (via `Alt+m`)
