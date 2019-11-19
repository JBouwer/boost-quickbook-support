# Boost Quickbook Support Extension

From the [Boost.Quickbook](http://www.boost.org/doc/html/quickbook.html) website:
> QuickBook is a WikiWiki style documentation tool geared towards C++ documentation using simple rules and markup for simple formatting tasks. 

This [Visual Studio Code](https://code.visualstudio.com/) extension provide some simple language support to ease the task of authoring [Boost.Quickbook](http://www.boost.org/doc/html/quickbook.html)(source) files.

It is *not* endorsed, published, approved or peer-reviewed by the [Boost](https://boost.org) community,
or anybody represented by the community. I have simply written it for myself to use - and put it out in the ether in case somebody else may find it useful too.

It is called "Boost Quickbook Support" because *Quickbook* is a [Boost](https://boost.org)-published language/tool,
and when I google "Quickbook" on its own, the search engine assumes I mean accounting software.

- The GitHub repository lives here: [github.com/JBouwer/boost-quickbook-support](https://github.com/JBouwer/boost-quickbook-support)

## Features

- Syntax colouring
- Bracket/Quote matching
- Code folding  
![Code Folding](images/FoldCode.gif)  
![Section Folding](images/FoldSection.gif)

- Simple preview generation  
![Preview](images/Preview.gif)

## Requirements

For the preview feature to work, you need a `quickbook` executable - either accessible within your `$PATH`,
or explicitly specified in the `quickbook.preview.pathToExecutable` setting.

## Extension Settings

- The executable's command options (see `quickbook --help`) when generating the _preview_, 
  are represented by equivalent *settings*. 
  Consult the [Quickbook documentation](http://www.boost.org/doc/html/quickbook.html) for appropriate usage.

- __File System Paths__  
  All filesystem path settings (i.e. to be passed as command-line options to `quickbook`, when generating the preview),
  can be specified relative to the VSCode __workspace directories__;  
  These settings are processed as follows:  
  1. The specified path is quoted and tested as is - if it exists, it is used.
  1. Otherwise the specified path is pre-pended in turn by each of the workspace directories - if it exists, it is used.
  1. Otherwise the specified path is quoted and used as specified.

- __Local Images with a relative path__  
  By default, the extension's preview will temporarily adjust __local relative__ image URI's 
  (i.e. Quickbook `[$ ...]` directives with a _relative path_),
  by rooting image paths to the directory where the image may actually be found.  
  (See [FAQ #5 & #6](FAQ) for rationale.)  
  These directories are are searched in the following order, and can be included/excluded from the search:
  
  Directory | Setting Heading | Setting Name
  ----------|-----------------|-------------
  Explicit image directories|_"Process Image Path Directories"_|`quickbook.preview.processImagePathDirectories`
  Include directories specified with _"Include Paths"_ (`quickbook.preview.include.path`)|_"Process Image Path Includes"_|`quickbook.preview.processImagePathIncludes`
  Workspace directories|"Process Image Path Include Workspace"|`quickbook.preview.processImagePathIncludeWorkspace`
  The directory of the source Quickbook file (i.e. the file that is being _previewed_). |"Process Image Path Relative"|`quickbook.preview.processImagePathRelative`

All the above directories, when enabled, are also implicitly _trusted_ to access local resources.
See [Security](#Security) below for more.

## Security
>   The [WebView API documentation](https://code.visualstudio.com/api/extension-guides/webview) component
>   used to display the preview panel are very restrictive with regards to what resources can be accessed.
>   In short:
>   - Any external resources needs to be explicitly _trusted_ with the _"Content Security Policy"_.
>   - Local resources:
>       - Needs to be accessed with a special `vscode-resource:` scheme.
>       - The scheme also needs to be explicitly _trusted_ with the _"Content Security Policy"_.
>       - The root directories that contain local resources, need to be explicitly _trusted_,
>         by adding them to the _trusted list_
>         [`WebviewOptions`](https://code.visualstudio.com/api/references/vscode-api#WebviewOptions)`.localResourceRoots`.
>   
>   See the  [WebView API documentation](https://code.visualstudio.com/api/extension-guides/webview#loading-local-content) 
>   for more on this subject.

This extension provides the following features to accommodate the above requirements.
- __Content Security Policy__  
  The `quickbook` generated preview HTML is injected with a
  [`<meta http-equiv="Content-Security-Policy" content="****">`](https://developers.google.com/web/fundamentals/security/csp/) directive, where the `****` part is replaced by the contents of the _Security: Content Security Policy_ (`quickbook.preview.security.contentSecurityPolicy`) setting.  
  > This setting defaults to "`default-src vscode-resource: https:;`" - thus allowing to access local (trusted),
    and `https:` resources.

- By default, the extension's preview will temporarily adjust the scheme of all __local__ image URI's 
  (i.e. Quickbook `[$ ...]` directives with a _local_ path) 
  to access the image with the "`vscode-resource:`" scheme, for rendering in the preview.  
  This can be prevented by setting the _Security: Process Image Path Scheme_ 
  (`quickbook.preview.security.processImagePathScheme` setting to false.

- All of the directories that are searched for images (See __Local Images with a relative path__ above),
  are implicitly added to the _trusted list_.

- The following settings will add their respective directories to the _trusted list_ ([`WebviewOptions`](https://code.visualstudio.com/api/references/vscode-api#WebviewOptions)`.localResourceRoots`):
    - _Security: Trust Source File Directory_ (`quickbook.preview.security.trustSourceFileDirectory`):  
      When enabled (default), the directory of the source file (i.e. the file being previewed) is trusted.
    - _Security: Trust Workspace Directories_ (`quickbook.preview.security.trustWorkspaceDirectories`):  
      When enabled (default), all of the workspace directories are trusted.
    - _Security Trust Specified Directories_ (`quickbook.preview.security.trustSpecifiedDirectories`):  
      When enabled (default), all other setting-directory-paths are trusted;  
      These include:
      - _Boost Root Path_ (`quickbook.preview.boostRootPath`)
      - _CSS Path_ (`quickbook.preview.CSSPath`)
      - _Graphics Path_ (`quickbook.preview.graphicsPath`)
      - _Image Location_ (`quickbook.preview.imageLocation`)
      - _Include Paths_ (`quickbook.preview.include.path(s)`).
    - _Trusted Additional Directories_ (`quickbook.preview.security.trustAdditionalDirectories`)  
      A manually entered list of additional paths to trust.

In addition:

- __Embedded Graphics__  
  All graphics (callouts etc.) embedded by `quickbook` into the preview html will be implicitly post-processed
  to be accessed with the `vscode-resource:` schema.
  This will still require the _Security Trust Specified Directories_
  (`quickbook.preview.security.trustSpecifiedDirectories`) setting to be enabled to work - in order to trust
  the _Boost Root_ directory.

- __Stylesheet (CSS)__  
  Any stylesheet specified with the _CSS Path_ (`quickbook.preview.CSSPath`) setting will be implicitly post-processed to be accessed with the `vscode-resource:` schema.

## Known Issues

This extension is not bullet proof. It is only intended as the next step up from a pure text editor - not as a *complete documentation writing tool*.

Currently it suffers from the following caveats.
See the [GitHub Issues Page](https://github.com/JBouwer/boost-quickbook-support/issues) for more.

- ### Bracket & Quote matching does *not* recognise escaped characters:
    e.g.  
    ```[myTemplate includes a \] character]```  
    does not match correctly on the last `]`.  
    #### Explanation
    The current 
    [bracket matching](https://code.visualstudio.com/api/language-extensions/language-configuration-guide#brackets-definition)
    is simply specified inside the `language-configuration.json` file.
    I don't know how to do specify the concept of an *escaped* character in there - if possible at all.  

- ### Post-processing of preview
    This is way out of my traditional field of expertise - 
    so please bear with me whilst I try and catch al possibilities...
    
    The way it works is roughly as follows: 
    (See `processPreview` in [`src/QuickbookPreview.ts`](https://github.com/JBouwer/boost-quickbook-support/blob/master/src/QuickbookPreview.ts))
    1. The `quickbook` generated preview text is scanned with a suitable REGEX to find all link contenders - 
        which are then divided into `pre`, `uri` & `post` named (regex) groups.
    1. All of those are then further filtered to only process links that I have actually confirmed to need processing. 
    1. Only the applicable links are then processed, and then re-assembled as:  
        `pre + `_`processed`_`(uri) + post`

    Note that:
    1. I'm actually running blind as to _exactly what_ needs processing
    1. I try to err on the _conservative_ side
    
    This will (and have) lead to some oversights.
    
    Don't hesitate to report any examples of `html` that I may have skipped!  
    You can find the pre-processed `html` in the preview file that is reported with the `quickbook` 
    command line on VSCode's _Output_ panel: Look for the `--output-file "..../out/preview.html"` option.
    
    I've opened Issue #9 for reporting of any such oversights.

## FAQ
Some answers to potential problems can be found [here](FAQ.md).

## Release Notes

The [CHANGELOG](CHANGELOG.md) will list details of what changed within each release.

