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
   - ~~[/] Add Open IDE feature~~ not possible.

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