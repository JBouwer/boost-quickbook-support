import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { UniqueArray } from './UniqueArray';

class UniUri
{
    public readonly strPath: string;
    public readonly uri: vscode.Uri;
    public readonly isLocal: boolean;
    
    constructor(arg: string | vscode.Uri)
    {
        // strPath & uri
        if(typeof(arg) == 'string')
        {
            this.strPath = arg;
            let uriSetting:vscode.Uri | undefined;
            try{
                this.uri = vscode.Uri.parse(arg, true);
            } catch(err)
            {
                this.uri = vscode.Uri.file(arg);
            }
        }
        else// if( arg instanceof vscode.Uri)
        {
            this.uri = arg;
            this.strPath = this.uri.toString();
        }
        
        // isLocal
        if( ['', 'file', 'vscode-resource'].indexOf(this.uri.scheme) >= 0 )
        {
            this.isLocal = true;
        }
        else
        {
            this.isLocal = false;
        }
    }
    
    // Only meaningful when 'isLocal == true'
    public isRelative(): boolean
    {
        if(this.isLocal)
        {
            // This is not foolproof...
            // - When initialised with a URI (file: schema) 'path.isAbsolute' fails!
            return !path.isAbsolute(this.strPath);
            
            // This won't do either - as relative uri.fsPath's start with '/'.
            // return !path.isAbsolute(this.uri.fsPath);
        }
        else return false
    }
    
    // When isLocal == true, determine if the resource exists.
    public exists() :boolean
    {
        if(this.isLocal)
        {
            return fs.existsSync(this.uri.fsPath);
        }
        else return false;
    }
    
    // When isLocal == true, returns the directory
    public directory(): string
    {
        if(this.exists())
        {
            if(fs.lstatSync(this.uri.fsPath).isFile())
            {
                return path.dirname(this.uri.fsPath);
            }
            else
            {
                return this.uri.fsPath;
            }
        }
        else return '';
    }
    
    // Check if path is a directory, or a symlink to a directory.
    public representsDirectory(): boolean
    {
        if(this.exists())
        {
            let stat = fs.lstatSync(this.uri.fsPath);
            if(stat.isDirectory())
            {
                return true;
            }
            else if(stat.isSymbolicLink())
            {
                let realPath = fs.realpathSync(this.uri.fsPath);
                stat = fs.lstatSync(realPath);
                return stat.isDirectory();
            }
            else
            {
                return false;
            }
        }
        else
        {
            return false;
        }
    }
    
    // If path is a directory, make sure last character is a path separator.
    public pathFriendly()
    {
        if( this.exists() )
        {
            if( this.representsDirectory() && !this.uri.fsPath.endsWith(path.sep) )
            {
                return this.uri.fsPath + path.sep;
            }
            else
            {
                return this.uri.fsPath;
            }
        }
        else return this.strPath;
    }
    
    public uriDirectory(): vscode.Uri
    {
        return this.uri.with({ path:this.directory() });
    }
};

class Settings
{
    readonly localResourceRoots: UniqueArray<vscode.Uri>;
    
    readonly strPathSourceFile: string;
    readonly strPathToExecutable: string;
    readonly strOptions: string;
    readonly strContentSecurityPolicy: string;
    
    readonly setPathIncludesExplicit: UniqueArray<UniUri>;
    readonly setPathIncludesWorkspace: UniqueArray<UniUri>;
    readonly setProcessImagePathDirectories: UniqueArray<UniUri>;
    
    readonly processImagePathIncludes: boolean;
    readonly processImagePathIncludeWorkspace: boolean;
    readonly processImagePathRelative: boolean;
    readonly processImagePathScheme: boolean;
    
    readonly trustAdditionalDirectories: string[];
    readonly trustSourceFileDirectory: boolean;
    readonly trustSpecifiedDirectories: boolean;
    readonly trustWorkspaceDirectories: boolean;
    
    constructor(pathSourceFile: string)
    {
        this.localResourceRoots = new UniqueArray<vscode.Uri>();
        this.strPathSourceFile = pathSourceFile;
        
        let config = vscode.workspace.getConfiguration('quickbook');
        
        function getSetting<T>(section: string, defaultVal: T): T
        {
            
            let setting: T | undefined = config.get(section);
            return setting ? setting : defaultVal;
        }
        
        let strPathToExecutable: string | undefined = config.get('preview.pathToExecutable');
        this.strPathToExecutable = (strPathToExecutable && fs.existsSync(strPathToExecutable)) ? strPathToExecutable : 'quickbook';
        
        // Security settings
        this.strContentSecurityPolicy = getSetting<string>('preview.security.contentSecurityPolicy',
                                                           "default-src 'none';");
        this.processImagePathScheme = getSetting<boolean>('preview.security.processImagePathScheme', false);
        
        this.trustAdditionalDirectories = getSetting<string[]>('preview.security.trustAdditionalDirectories', []);
        this.trustSourceFileDirectory = getSetting<boolean>('preview.security.trustSourceFileDirectory', false);
        this.trustSpecifiedDirectories = getSetting<boolean>('preview.security.trustSpecifiedDirectories', false);
        this.trustWorkspaceDirectories = getSetting<boolean>('preview.security.trustWorkspaceDirectories', false);
        
        // Image settings
        this.setProcessImagePathDirectories = new UniqueArray<UniUri>();
        let strProcessImagePathDirectories = getSetting<string[]>('preview.processImagePathDirectories', []);
        for( let folder of strProcessImagePathDirectories )
        {
            let test = new UniUri(folder);
            if(test.representsDirectory())
            {
                this.setProcessImagePathDirectories.add(test);
            }
        }
        
        this.processImagePathIncludes = getSetting<boolean>('preview.processImagePathIncludes', false);
        this.processImagePathIncludeWorkspace = getSetting<boolean>('preview.processImagePathIncludeWorkspace', false);
        
        // The following setting was renamed, and the old one deprecated (>= v0.0.6)
        let oldSecurityProcessPathRelative = getSetting<boolean>('preview.security.processImagePathRelative', false);
        this.processImagePathRelative = getSetting<boolean>('preview.processImagePathRelative',
                                                            oldSecurityProcessPathRelative);
        
        // Check for existence of path - if not, try by prepending the workspace folders..
        // ... use the first one that result in a successful 'exist', otherwise use as specified.
        function strPathFittedToWorkspace(pathIn: string): string
        {
            if(!fs.existsSync(pathIn) && vscode.workspace.workspaceFolders)
            {
                for(let folder of vscode.workspace.workspaceFolders)
                {
                    let pathTry = path.join(folder.uri.fsPath, pathIn);
                    if(fs.existsSync(pathTry))
                    {
                        return pathTry;
                        break;
                    }
                }
            }
            
            return pathIn;
        }
        
        function processSetting(v: any, option: string, setPaths: UniqueArray<UniUri> | undefined = undefined): string
        {
            if(v && !!v)
            {
                if( v instanceof Array || v instanceof Set )
                {
                    let returnValue = '';
                    for(var element of v)
                    {
                        returnValue += processSetting(element, option, setPaths);
                    }
                    
                    return returnValue;
                }
                else
                {
                    switch(typeof(v))
                    {
                        case 'boolean': return ' ' + option;
                        case 'number': return ' ' + option + ' ' + v.toString();
                        case 'string': 
                        {
                            let setting: string = v.toString();
                            if(setPaths)
                            {
                                // Check for existence of path - if not, try by pre-pending the workspace folders..
                                // ... use the first one that result in a successful 'exist', otherwise use as specified.
                                setting = strPathFittedToWorkspace(setting);
                                
                                // Attempt to parse the setting as an URI - if fail interpret it as a filesystem path.
                                let uniUriSetting = new UniUri(setting);
                                
                                return processSetting(uniUriSetting, option, setPaths);
                            }
                            else
                            {
                                return ' ' + option + ' "' + setting + '"';
                            }
                        }
                        
                        case 'object': 
                        {
                            if( v instanceof UniUri)
                            {
                                if(setPaths)
                                {
                                    setPaths.add(new UniUri(v.uriDirectory()));
                                }
                                
                                return ' ' + option + ' "' + v.pathFriendly() + '"';
                            }
                            else
                            {
                                console.log( "Unknown object of type: '" + typeof(v) + "'" );
                            }
                        }
                        
                        default:
                            console.log( "Unknown type: '" + typeof(v) + "'" );
                            return '';
                    }
                }
            }
            else return '';
        }
        
        function strSetting(section: string, option: string, setPaths: UniqueArray<UniUri> | undefined = undefined): string
        {
            let v = config.get(section);
            
            return processSetting(v, option, setPaths);
        }
        
        // Define Macro(s)
        // ===============
        // 1 - First do the old deprecated (Version <= 0.0.4) functionality:
        // -----------------------------------------------------------------
        let strMacroDefine = strSetting('preview.defineMacro', '--define');
        
        // 2 - Next do the current (new) functionality:
        // --------------------------------------------
        let strMacroDefines = strSetting('preview.defineMacros', '--define');
        
        // Include path:
        // =============
        // 1 - First do the current (new) functionality:
        // --------------------------------------------
        this.setPathIncludesExplicit = new UniqueArray<UniUri>();
        let strPathIncludesExplicit = strSetting('preview.include.paths', '--include-path', this.setPathIncludesExplicit);
        
        this.setPathIncludesWorkspace = new UniqueArray<UniUri>();
        if( getSetting<boolean>('preview.include.workspacePaths', false)
            && vscode.workspace.workspaceFolders )
        {
            for(var element of vscode.workspace.workspaceFolders)
            {
                this.setPathIncludesWorkspace.add( new UniUri(element.uri.fsPath) );
            }
        }
        
        // 2 - Next, do the old deprecated (Version <= 0.0.4) functionality:
        //     (If not already covered)
        // -----------------------------------------------------------------
        // First, check 'preview.include.path'.
        // If empty, then check 'preview.include.workspacePath' - only if not already added above.
        let strPathInclude_Deprecated = strSetting( 'preview.include.path', '--include-path',
                                                    !getSetting<boolean>('preview.include.workspacePath', false)
                                                        ? this.setPathIncludesExplicit 
                                                        : undefined );
        
        if( (strPathInclude_Deprecated.length == 0)
           && getSetting<boolean>('preview.include.workspacePath', false)
           && !getSetting<boolean>('preview.include.workspacePaths', false) // Don't add if already added above!
           && vscode.workspace.workspaceFolders
          )
        {
            this.setPathIncludesWorkspace.add( new UniUri(vscode.workspace.workspaceFolders[0].uri.fsPath) );
        }
        
        // Convert the workspace set into '--include-path' option string...
        // Note that the contents is already canonized, thus no 3rd parameter is passed.
        let strPathIncludesWorkspace = processSetting(this.setPathIncludesWorkspace, '--include-path');
        
        // Read settings & build a command line from them.
        // Also collect 'localResourceRoots' directories when specified.
        let setPathSpecifiedDirectories = new UniqueArray<UniUri>();
        this.strOptions  = strSetting('preview.strict', '--strict')
                         + strSetting('preview.noSelfLinkedHeaders', '--no-self-linked-headers')
                         + strSetting('preview.indent', '--indent')
                         + strSetting('preview.lineWidth', '--linewidth')
                         + strMacroDefine
                         + strMacroDefines
                         + strPathInclude_Deprecated
                         + strPathIncludesExplicit
                         + strPathIncludesWorkspace
                         + strSetting('preview.imageLocation', '--image-location', setPathSpecifiedDirectories)
                         + strSetting('preview.boostRootPath', '--boost-root-path', setPathSpecifiedDirectories)
                         + strSetting('preview.CSSPath', '--css-path', setPathSpecifiedDirectories)
                         + strSetting('preview.graphicsPath', '--graphics-path', setPathSpecifiedDirectories)
                         ;
        
        // Trust "Additional Directories", if allowed.
        if(this.trustAdditionalDirectories)
        {
            for(let dir of this.trustAdditionalDirectories)
            {
                let uniUriDir = new UniUri(strPathFittedToWorkspace(dir));
                this.localResourceRoots.add(uniUriDir.uri);
            }
        }
        
        // Trust directory of source file, if allowed.
        if(this.trustSourceFileDirectory)
        {
            let uriSourceFile = new UniUri(pathSourceFile);
            this.localResourceRoots.add(uriSourceFile.uriDirectory());
        }
        
        // Trust "Include Directories", if allowed or if tested for images.
        if(this.trustSpecifiedDirectories || this.processImagePathIncludes)
        {
            for(let u of this.setPathIncludesExplicit)
            {
                this.localResourceRoots.add(u.uri);
            }
        }
        
        // Trust "Specified Directories", if allowed.
        if(this.trustSpecifiedDirectories)
        {
            for(let u of setPathSpecifiedDirectories)
            {
                this.localResourceRoots.add(u.uri);
            }
        }
        
        // Trust Workspace Directories, if allowed.
        if(this.trustWorkspaceDirectories || this.processImagePathIncludeWorkspace)
        {
            for(let u of this.setPathIncludesWorkspace)
            {
                this.localResourceRoots.add(u.uriDirectory());
            }
        }
        
        // Trust all the setProcessImagePathDirectories.
        for(let u of this.setProcessImagePathDirectories)
        {
            this.localResourceRoots.add(u.uriDirectory());
        }
    }
};

export class QuickbookPreview
{
    private static readonly keyContextActive = 'quickbookPreviewActive';
    
    private context_: vscode.ExtensionContext;
    private panel_: vscode.WebviewPanel | undefined;
    private column_: vscode.ViewColumn = vscode.ViewColumn.One;
    private channelOutput_: vscode.OutputChannel | undefined;
    private txtEditorSource_: vscode.TextEditor | undefined;
    
    // Path to processed preview html on disk.
    readonly strPathPreview_: string;
    
    constructor(context: vscode.ExtensionContext)
    {
        this.context_ = context;
        this.strPathPreview_ = path.join( context.extensionPath, 'out', 'preview.html' );
    }
    
    private registerActive(flag: boolean)
    {
        vscode.commands.executeCommand('setContext', QuickbookPreview.keyContextActive, flag);
    }
    
    private get iconPath()
    {
        const root = path.join(this.context_.extensionPath, 'images');
        return {
            light: vscode.Uri.file(path.join(root, 'preview-light.svg')),
            dark: vscode.Uri.file(path.join(root, 'preview-dark.svg'))
            };
    }
    
    protected getFailurePage(...strings: string[])
    {
        let args = strings.reverse();
        let description = strings[0] ? args.pop() : 'Error';
        
        return `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none';">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${description}</title>
                </head>
                <body>
                    <h1>${description}</h1>
                    <pre><code>${args.length ? args.pop() : ''}</code></pre>
                    <pre><code>${args.length ? args.pop() : ''}</code></pre>
                    <pre><code>${args.length ? args.pop() : ''}</code></pre>
                    <pre><code>${args.length ? args.pop() : ''}</code></pre>
                    <pre><code>${args.length ? args.pop() : ''}</code></pre>
                    <pre><code>${args.length ? args.pop() : ''}</code></pre>
                    <pre><code>${args.length ? args.pop() : ''}</code></pre>
                    <pre><code>${args.length ? args.pop() : ''}</code></pre>
                    <pre><code>${args.length ? args.pop() : ''}</code></pre>
                    <pre><code>${args.length ? args.pop() : ''}</code></pre>
                </body>
                </html>
                `;
    }
    
    protected setOutputChannel( ...strings: string[])
    {
        if(!this.channelOutput_)
        {
            this.channelOutput_ = vscode.window.createOutputChannel('Quickbook Preview Generation');
        }
        
        let channel =  this.channelOutput_;
        channel.clear();
        
        for(let str of strings)
        {
            if(str.length)
            {
                channel.appendLine(str);
            }
        }
        
        channel.show(true);
    }
    
    protected processPreview(contents: string, settings: Settings, webView: vscode.Webview)
    {
        let self = this;
        
        // Inject Security Policy
        let strSecurityPolicy = (settings.strContentSecurityPolicy.length != 0) 
                            ? `<meta http-equiv="Content-Security-Policy" content="${settings.strContentSecurityPolicy}">`
                            : `<meta http-equiv="Content-Security-Policy" content="default-src 'none';">`
                         // : `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webView.cspSource} https:; script-src ${webView.cspSource}; style-src ${webView.cspSource};">`
                            ;
        
        const regexHead = /\<head\>(.*)\<\/head\>/s;
        contents =  contents.replace(regexHead, '<head>' + strSecurityPolicy + '$1</head>');
        
        // Update images with:
        // 1 - Root relative paths to source file directory
        // 2 - Access with vscode-recource:
        if( settings.processImagePathScheme
            || (settings.setProcessImagePathDirectories.length > 0)
            || settings.processImagePathIncludes
            || settings.processImagePathIncludeWorkspace
            || settings.processImagePathRelative
           )
        {
            // REPLACER
            // This function is to be passed to a 'string.replace(regex, replacer)' statement.
            // It expects the REGEX to pass all matches divided into named groups:
            //  (pre)(uri)(post)
            // pre - includes everything identifiable about the link up to and including the uri quote (")
            // uri - the pure URI
            // post - from the closing quote (") to the closing (>)
            function replacer(match: string, ...args: any[])
            {
                let groups = args.pop();
                
                class XUri extends UniUri
                {
                    protected isPathFound: boolean;
                    
                    constructor(arg: string | vscode.Uri, done: boolean = false)
                    {
                        super(arg);
                        this.isPathFound = done;
                    }
                    
                    public xuriPathRelativeToDirectories(isAllowed: boolean,
                                                         setDirectories: UniqueArray<UniUri>
                                                        ): XUri
                    {
                        if(!this.isPathFound && isAllowed && this.isRelative())
                        {
                            for(let folder of setDirectories)
                            {
                                if(folder.representsDirectory())
                                {
                                    let pathTry = path.join(folder.uri.fsPath, groups.uri);
                                    if(fs.existsSync(pathTry))
                                    {
                                        return new XUri( this.uri.with({ path:pathTry }), true );
                                        break;
                                    }
                                }
                            }
                            
                            return this;
                        }
                        else return this;
                    }
                    
                    public xuriPathRelativeToSource(isAllowed: boolean): XUri
                    {
                        if(!this.isPathFound && isAllowed && this.isRelative())
                        {
                            let strPathRoot = path.dirname(settings.strPathSourceFile);
                            return new XUri( this.uri.with({ path: path.join(strPathRoot, groups.uri) }), true);
                        }
                        else return this;
                    }
                    
                    public xuriPathRelativeToDestination(): XUri
                    {
                        if(!this.isPathFound)
                        {
                            let strPathRoot = path.dirname(self.strPathPreview_);
                            return new XUri( this.uri.with({ path: path.join(strPathRoot, groups.uri) }));
                        }
                        else return this;
                    }
                    
                    public uriWebviewIfPermitted(isAllowed: boolean)
                    {
                        if(isAllowed)
                        {
                            return webView.asWebviewUri(this.uri);
                        }
                        else return this.uri;
                    }
                }
                
                let xUriWork = new XUri(groups.uri);
                // Only process local URI's
                if(xUriWork.isLocal)
                {
                    // Filter PRE - User images:
                    // Tests for '<span class="inlinemediaobject">'
                    const regexILMediaObject = /\<span\s+class\s*=\s*\"inlinemediaobject\"\>/;
                    if(regexILMediaObject.test(groups.pre) )
                    {
                        return groups.pre
                             + xUriWork.xuriPathRelativeToDirectories(true,
                                                                      settings.setProcessImagePathDirectories)
                                       .xuriPathRelativeToDirectories(settings.processImagePathIncludes,
                                                                      settings.setPathIncludesExplicit)
                                       .xuriPathRelativeToDirectories(settings.processImagePathIncludeWorkspace,
                                                                      settings.setPathIncludesWorkspace)
                                       .xuriPathRelativeToSource(settings.processImagePathRelative)
                                       .uriWebviewIfPermitted(settings.processImagePathScheme)
                             + groups.post;
                    }
                    
                    // Filter PRE - Graphics:
                    // Tests for '<a href="...">'
                    const regexAHref = /\<a\s+href\s*=\s*\".*?\"\>/;
                    // Tests for '<div id="...">
                    const regexDivId = /\<div\s+id\s*=\s*\".*?\"\>/;
                    if( regexAHref.test(groups.pre) || regexDivId.test(groups.pre) )
                    {
                        return groups.pre
                             + xUriWork.xuriPathRelativeToDestination()
                                       .uriWebviewIfPermitted(settings.processImagePathScheme)
                             + groups.post;
                    }
                    
                    // Filter PRE - CSS (Stylesheet):
                    // Tests for '<link rel="stylesheet" type="text\/css"'
                    const regexCSS = /\<link\s+rel="stylesheet"\s+type="text\/css"/;
                    if(regexCSS.test(groups.pre) )
                    {
                        return groups.pre
                             + xUriWork.xuriPathRelativeToDestination()
                                       .uriWebviewIfPermitted(settings.processImagePathScheme)
                             + groups.post;
                    }
                }
                else
                {
                    // Ignore
                    return match;
                }
            };
            
            // Find Images - All of them (/g)
            //  pre = <...><img src = "
            //  post = "...>
            const regexImageSource = /(?<pre>\<[^\>]*\>\s*?\<img\s+src\s*=\s*\")(?<uri>.+?)(?<post>\".*?\>)/gs;
            contents = contents.replace(regexImageSource, replacer);
            
            // Find Stylesheet (CSS) - only 1st instance (no /g)
            //  pre = <link rel="stylesheet" type="text/css" href="
            //  post = "...>
            const regexLinkCSS = /(?<pre>\<link\s+rel="stylesheet"\s+type="text\/css"\s+href=")(?<uri>.+?)(?<post>\".*?\>)/s;
            contents = contents.replace(regexLinkCSS, replacer);
        }
        
        return contents;
    }
    
    protected setPreview(title: string, strContents: string, mustProcess: boolean, settings: Settings)
    {
        const self = this;
        
        if(!self.panel_)
        {
            // Create and show a new webview
            self.panel_ = vscode.window.createWebviewPanel(
                    'quickbook.preview',    // Identifies the type of the webview. Used internally
                    'Preview',              // Title of the panel displayed to the user
                    self.column_ ? self.column_
                                 : vscode.ViewColumn.One,   // Editor column to show the new webview panel in.
                    {
                        localResourceRoots: settings.localResourceRoots,
                        enableFindWidget: true,
                        enableScripts: true
                    }
                );
            
            // Reset when the current panel is closed
            self.panel_.onDidDispose(
                    () => {
                        self.registerActive(false);
                        self.panel_ = undefined;
                    },
                    null,
                    self.context_.subscriptions
                );
            self.panel_.onDidChangeViewState(
                ({ webviewPanel }) => {
                    self.registerActive(webviewPanel.active);
                });
        }
        
        let strProcessedContents = mustProcess ? self.processPreview( strContents, settings, self.panel_.webview )
                                               : strContents;
        
        self.panel_.title = title;
        self.panel_.iconPath = self.iconPath;
        self.panel_.webview.html = strProcessedContents;
        self.panel_.reveal(self.column_);
        self.registerActive(true);
    }
    
    private async updatePreview(txtEditor: vscode.TextEditor)
    {
        const self = this;
        self.txtEditorSource_ = txtEditor;
        
        const exists = (pathFile: string): Promise<string> => {
            return new Promise<string>((resolve, reject) => {
                fs.exists(pathFile, (isExisting: boolean) => {
                    if(isExisting)
                        resolve(pathFile);
                    else
                        reject(['Invalid source file', 'path: "' + pathFile + '"']);
                });
            });
        };
        
        const exec = (command: string, options: cp.ExecOptions): Promise<string[]> => {
            return new Promise<string[]>((resolve, reject) => {
                cp.exec(command, options, (error, stdout, stderr) => {
                    if(error)
                        reject( ['Error', 'Command line:\n' + command, 'stdout:\n' + stdout, 'stderr:\n' + stderr] );
                    else 
                        resolve( ['Command line:\n' + command, 'stdout:\n' + stdout, 'stderr:\n' + stderr] );
                });
            });
        };
        
        const readFile = (pathFile: string, 
                          options: { encoding?: null | undefined; 
                                     flag?: string | undefined; } | null | undefined): Promise<string> => {
            return new Promise<string>((resolve, reject) => {
                fs.readFile(pathFile, options, (err: NodeJS.ErrnoException, data: Buffer) => {
                    if(err)
                        reject( ['Error', `Error reading preview file at: "${self.strPathPreview_}".`, err.code, err.name, err.message] );
                    else
                        resolve(data.toString());
                });
            });
        };
        
        const pathSourceFile = txtEditor.document.fileName;
        const title = "Preview " + path.basename( pathSourceFile );
        const settings = new Settings(pathSourceFile);
        
        exists(txtEditor.document.fileName).then( (pathFileSource: string) => {
            let commandLine = `${settings.strPathToExecutable}${settings.strOptions} --output-format onehtml --output-file "${self.strPathPreview_}" "${pathFileSource}" `;
            
            return exec(commandLine, {});
        }).then( (output) => {
            self.setOutputChannel(...output);
            return readFile( self.strPathPreview_, {} );
        }).then((strContents) => {
            self.setPreview( title, strContents, true, settings);
        }).catch((messages: string[]) => {
            self.setOutputChannel(...messages);
            self.setPreview( title, self.getFailurePage(...messages), false, settings );
        });
    }
    
    public async showPreview(txtEditor: vscode.TextEditor)
    {
        if(txtEditor.viewColumn)
        {
            this.column_ = txtEditor.viewColumn;
        }
        
        this.updatePreview(txtEditor);
    }
    
    public async showPreviewToSide(txtEditor: vscode.TextEditor)
    {
        this.column_ = txtEditor.viewColumn ? txtEditor.viewColumn + 1
                                            : vscode.ViewColumn.Beside;
        
        this.updatePreview(txtEditor);
    }
    
    public async refreshPreview()
    {
        if(this.txtEditorSource_)
        {
            this.updatePreview(this.txtEditorSource_);
        }
    }
    
    public async viewSource()
    {
        if(this.txtEditorSource_)
        {
            vscode.window.showTextDocument(this.txtEditorSource_.document, this.txtEditorSource_.viewColumn);
        }
    }
}
