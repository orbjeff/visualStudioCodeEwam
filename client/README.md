# Visual Studio Code Ewam

This repo is a work in progress as Visual Studio Code is still in Beta by Microsoft.
This plugin leverage the eWam API to let you edit eWam Code With Visual Studio Code.

## Demo
Parsing, checkin and Scenario edition demo
![eWam VSC](eWam4.gif)

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

## Features (0.1.x)
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

## Roadmap (0.2) 17 avril 2016
- [x] Outline - regis
- [ ] Symbol navigation - regis
- [ ] Signature completion - regis
- [ ] Improve autocompletion (suggestions appear a bit randomly, and not when needed e.g. when typeing '.' or '(') - regis
- [ ] API proper and accurate documentation - all
- [ ] Verify compatibility 6.1 / 6.1.5 (test multi user) - seb
- [ ] override var and method more performant + override dans ewam (60s in 0.1.x) - nicolas
- [ ] Additional code snippets - all
- [ ] Rename Symbol
- [ ] Additional validations (check repo is writable) - nicolas api
- [ ] Other entity management (create new scenario, translation,...)
- [ ] View in tree
- [ ] Where used (as find all references in VS)
- [ ] Parsing errors iteration 2 (more native experience + code analyzer) - regis 

## Roadmap (0.3)
- [ ] Debugger
- [ ] Cache management


## Additional demos
### Code completion
![eWam VSC](eWam.gif)





