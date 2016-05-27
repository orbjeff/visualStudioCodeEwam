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
    
## Alpha 0.2.4 - *Deliver on June 10, 2016*

- [ ] Generate source code
    - [ ] Implement code to create a JSON index file containing the description of the repository, based on
        - installed bundles as dependencies
        - prepared bundles as current project
        Ultimately, this file will also provide a list of dependencies to other products, that could idealy be pulled from a centralized package management system.
        Hint: create generic code that builds a record object with these information, that can either be used from a API to be returned through http, or be serialized as json to be dumped in a file. And implement that second tool.
    - [ ] Implement an API to create a JSON package description file for a bundle, describing it's deliveries/classes/modules/everything content and hierarchy
    - [ ] Implement an API to initialize repository based on the index file
        - one file per bundle + one index file with
            - project hierarchy
            - dependencies hierarchy
    - [ ] Implement an API to get the pathof a module in the source repository (e.g. in $rootPath/$Bundle/$Delivery/module.gold)
    - [ ] Implement an API to get the bundle/delivery of a module
    - [ ] Implement an API to dump a module in the source repository (e.g. in $rootPath/$Bundle/$Delivery/module.gold)
    - [ ] Create git repository for our environnement
    - Review plugin to account for these changes :
        - [ ] on the fly HTML documentation production (paths provided in the documentation links)
        - [ ] path where the file of a module is retrieved when opening
        - [ ] path where the file of a module is stored when saving 
- [x] ~~Explore file:// scheme handling with contentProviders, to lazy-load gold modules~~ Not working : *"Activating extension `mphasiswyde.ewamvscadaptor` failed: scheme 'file' already registered."*   
- [ ] API: saves the module (ctrl+s) **even if inconsistent**
- [x] MMBrowser entry point : connection.onWorkspaceSymbol => metamodel browser request
- [ ] Improve "Find references" feature to provide position in file (use metainfo)
- [x] Improve outline : display full path to entity
- [x] Polish syntax highlighting : capture types in variable declarations
- Bug fixes and ergonomy
    - [ ] Crash of eWam Service when using vscode
    - [ ] Outline becomes unavailable at some point (onHover not called anymore)
    - [ ] Integrity checking
    - [x] fix item kind of suggestions
    - [x] Diagnostics doesn't work anymore (reformat not working anymore either)
    - [ ] Improve overall usability

## Testing - *Publish on ??*

- [ ] Verify compatibility 6.1 / 6.1.5 (test multi user) - seb

## Upcoming tasks
    
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

## 2.0 supported by eWAM 6.2
- [ ] Breakpoint management
- [ ] Debugger
- [ ] Cache management







