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

## Alpha 0.2.1 - *Deliver on May 4, 2016* [![May the 4th](https://cdn0.iconfinder.com/data/icons/star-wars/48/x-wing-512.png =70)](http://www.google.fr/search?q=may+the+4th)    

- [x] APIs: make work parse (without save) + save
- [x] Parse on open
- [x] Parse (F7) should be only a parse, no save
- [x] Native save (ctrl+s) : saves the module

- [x] Signature completion - regis

## Alpha 0.2.2 - *Deliver on May 13, 2016*

- [ ] Class tree visualization : explore possibilities offered by virtual documents (investigate how to implement the previewHtml, cf. https://code.visualstudio.com/updates/vJanuary#_extension-authoring, or Code Flower extension http://www.redotheweb.com/CodeFlower/, https://bitbucket.org/wynsure/code-flower-and-dependency-wheel)
- [ ] Add "myText" in documentation for the outlines
- [ ] Find references (Where used) - regis
- [ ] API: saves the module (ctrl+s) **even if inconsistent**

- [ ] Bug fixes
    - [ ] Crash of eWam Service when using vscode
    - [ ] Outline becomes unavailable at some point (onHover not called anymore)
    
- [ ] Enable comments (i.e. CommentRule)
- [ ] Go to Definition on local variables

## Testing - *Publish on 13 May 2016*

- [ ] Verify compatibility 6.1 / 6.1.5 (test multi user) - seb

## Upcoming tasks

- [ ] Parsing errors iteration 2 : code analyzer feedback 
- [ ] Review "Code Actions" feature : could be implemented using code analyzer
- [ ] Ergonomic way to override variables and methods
- [ ] Additional code snippets
- [ ] Symbol renaming
- [ ] Additional validations (check repo is writable) - nicolas api
- [ ] Other entity management (create new scenario, translation, ...)
- [ ] Polish syntaxe highlightinh
- [ ] Demo video (with OBS - https://obsproject.com/download)

## Alpha 0.9 : Pre-beta

- [ ] Design decisions concerning source code repository location and organization
    - [ ] API repository context

- [ ] Code and API re-fectoring  / architecturing / documentation
    - [ ] API proper and accurate documentation
    - [ ] API test
    

## 2.0 supported by eWAM 6.2
- [ ] Breakpoint management
- [ ] Debugger
- [ ] Cache management







