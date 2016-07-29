# Visual Studio Code Ewam

This repo is a work in progress as Visual Studio Code is still in Beta by Microsoft.
This plugin leverage the eWam API to let you edit eWam Code With Visual Studio Code.

## Take a tour...
![eWam VSC](tour.gif)

## Requirements
* Visual Studio Code 10.8
* [ModelAPI v1](https://github.com/MphasisWyde/WydeActiveModelerAPI)

## Installation (Dev mode)
* Clone this repo
* Run `npm install`
* Open the folder

## Get up and running straight away (Debug mode)
* press `F5` to open a new window with your extension loaded
* run your command from the command palette by pressing (`Ctrl+Shift+P` or `F1`) and typing `ewam`
* set breakpoints in `extension.ts` to debug the extension
* find output from your extension in the debug console

# Roadmap

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

## Alpha 0.2 - *Delivered on 29 April 2016*
   
- [x] Outline - regis
- [x] Symbol navigation (in documentation navigation + go to definition) - regis
- [x] Improve autocompletion (suggestions appear a bit randomly, and not when needed e.g. when typeing '.' or '(') - regis
- [x] Improve usability : retrieve metainfo on open
- [x] Improve outline and symbols APIs : use ProduceGold

## Alpha 0.2.1 - *Deliver on May 4, 2016* [<img src="https://cdn0.iconfinder.com/data/icons/star-wars/48/x-wing-512.png" width="70"/>](http://www.google.fr/search?q=may+the+4th)

- [x] APIs: make work parse (without save) + save
- [x] Parse on open
- [x] Parse (F7) should be only a parse, no save
- [x] Native save (ctrl+s) : saves the module
- [x] Signature completion

## Alpha 0.2.2 - *Deliver on May 13, 2016*

- [x] Enable comments (i.e. CommentRule)
- [x] Add "myText" in documentation for the outlines
- ~~[ ] Make method parameter suggestions be documented~~ : Impossible due to underlying API restrictions
- [x] Class tree visualization : simple class tree interact
- [x] Class documentation : explore possibilities offered by virtual documents (investigate how to implement the previewHtml, cf. https://code.visualstudio.com/updates/vJanuary#_extension-authoring, or Code Flower extension http://www.redotheweb.com/CodeFlower/, https://bitbucket.org/wynsure/code-flower-and-dependency-wheel) :
    - unable to detect when we try to open a class (a file) from the preview links
    - vscode.previewHtml seems buggy : if I open it, close the preview, and re-open it, a crash occurs
- [x] Find references (Where used)

## Alpha 0.2.3 - *Deliver on May 20, 2016*

- [x] Timer on parse
- [x] Class tree visualization : handle directly the "select from name" based on the currently open module
- [x] Class documentation : improve robustness
- [x] Go to Definition on local variables
- [x] Polish syntax highlighting
- Bug fixes
    - [x] Too large CString assignment
    - [x] "Go To Definition" doesn't work anymore
    
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


## Alpha 0.2.5 - *Deliver on ??, 2016*

- [ ] Improve overall usability / stability
- [ ] Improve "Find references" feature to provide position in file (use metainfo)
    - [ ] Explore ewam-open:// scheme handling with contentProviders, to lazy-load gold modules from URLs (might be useful in documentation or when accessing an entity we don't know the position yet).
- [ ] API: saves the module (ctrl+s) **even if inconsistent**
- [ ] Add watch on bundleIndex.json in order to detect bundle changes 
- [ ] review diff / merge capabilities of VS Code (context of reimplems)

- Bug fixes and ergonomy
    - [ ] API performance : use Florian's serializer for simple records (i.e. GetMetaInfo : 10s to get metainfo of aWFActor when AdvancedComponents not compiled)


## Remaining tasks before POC release

... none ... we're nearly there !

## Upcoming tasks

- [ ] Verify compatibility 6.1 / 6.1.5 (test multi user) - seb

- [ ] Parsing errors iteration 2 : code analyzer feedback 
- [ ] Ergonomic way to override variables and methods
- [ ] Symbol renaming
- [ ] Additional code snippets
- [ ] Review "Code Actions" feature : could be implemented using code analyzer
- [ ] Additional validations (check repo is writable)
- [ ] Other entity management (create new scenario, translation, ...)
- [ ] Demo video (with OBS - https://obsproject.com/download)

- [ ] Questions de Florian : 
    - [ ] Fichiers virtuels => contentProviders? (seems to only work for read-only html previews)

- [ ] Design decisions concerning source code repository location and organization
    - [ ] API repository context

- [ ] Code and API re-fectoring  / architecturing / documentation
    - [ ] API proper and accurate documentation
    - [ ] API test
    - [ ] Implement better outlining / metainfo production API
    - [ ] Implement metainfo query API
    - [ ] Implement entity access management : local file + synchronization questions  

## 2.0 supported by eWAM 6.2
- [ ] Breakpoint management
- [ ] Debugger
- [ ] Cache management







