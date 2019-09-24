import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';


export class QuickbookPreview
{
    private static readonly keyContextActive = 'quickbookPreviewActive';
    
    private context_: vscode.ExtensionContext;
    private panel_: vscode.WebviewPanel | undefined;
    private column_: vscode.ViewColumn = vscode.ViewColumn.One;
    private channelOutput_: vscode.OutputChannel | undefined;
    private localResourceRoots_: vscode.Uri[] = [];
    private txtEditorSource_: vscode.TextEditor | undefined;
    
    // Path to processed preview html on disk.
    readonly strPathPreview_: string;
    
    // Read from SETTINGS:
    readonly strPathToExecutable_: string;
    readonly strOptions_: string;
    readonly strContentSecurityPolicy_: string;
    
    constructor(context: vscode.ExtensionContext)
    {
        const self = this;
        this.context_ = context;
        this.strPathPreview_ = path.join( context.extensionPath, 'out', 'preview.html' );
        
        let config = vscode.workspace.getConfiguration('quickbook');
        
        let strPathToExecutable: string | undefined = config.get('preview.pathToExecutable');
        this.strPathToExecutable_ = (strPathToExecutable && fs.existsSync(strPathToExecutable)) ? strPathToExecutable : 'quickbook';
        
        let strCSP: string | undefined = config.get('preview.contentSecurityPolicy');
        this.strContentSecurityPolicy_ = strCSP ? strCSP : "default-src 'none';";
        
        let pathIncludeWorkspace: boolean | undefined = config.get('preview.include.workspacePath');
        let strPathIncludeWorkspace : string = 
            (pathIncludeWorkspace && !! pathIncludeWorkspace && vscode.workspace.workspaceFolders)
                ? ' --include-path "' + vscode.workspace.workspaceFolders[0].uri.fsPath + '"'
                : '';
        
        function strSetting(section: string, option: string, processStringAsPath: boolean = false): string
        {
            let v = config.get(section);
            if(v && !!v)
            {
                switch(typeof(v))
                {
                    case 'boolean': return ' ' + option;
                    case 'number': return ' ' + option + ' ' + v.toString();
                    case 'string': 
                    {
                        let setting: string = v.toString();
                        if(processStringAsPath)
                        {
                            // Check for existence of path - if not, try by prepending the workspace folders..
                            // ... use the first one that result in a successful 'exist', otherwise use as specified.
                            if(!fs.existsSync(setting) && vscode.workspace.workspaceFolders)
                            {
                                for(let folder of vscode.workspace.workspaceFolders)
                                {
                                    let pathTry = path.join(folder.uri.fsPath, setting);
                                    if(fs.existsSync(pathTry))
                                    {
                                        setting = pathTry;
                                        continue;
                                    }
                                }
                            }
                            
                            // Attempt to parse the setting as an URI - if fail interpret it as a filesystem path.
                            let uriSetting:vscode.Uri;
                            try{
                                uriSetting = vscode.Uri.parse(path.dirname(setting), true);
                                // Apparently 'file:' scheme is fine.
                                // uriSetting = uriSetting.with({ scheme: 'file' });
                            } catch(err)
                            {
                                uriSetting = vscode.Uri.file(path.dirname(setting));
                            }
                            
                            // Add the directory to the 'localResourceRoots' array.
                            // Note that this by itself will not allow the VSCode Webview to access local resources...
                            // ... they need to be accessed with the 'vscode-resource:' scheme.
                            // See: https://code.visualstudio.com/api/extension-guides/webview#loading-local-content
                            self.localResourceRoots_.push(uriSetting);
                        }
                        
                        return ' ' + option + ' "' + setting + '"';
                    }
                    default: return '';
                }
            }
            else return '';
        }
        
        this.strOptions_ = strSetting('preview.strict', '--strict')
                         + strSetting('preview.noSelfLinkedHeaders', '--no-self-linked-headers')
                         + strSetting('preview.indent', '--indent')
                         + strSetting('preview.lineWidth', '--linewidth')
                         + strSetting('preview.defineMacro', '--define')
                         + ( strPathIncludeWorkspace.length ? strPathIncludeWorkspace
                                                            : strSetting('preview.include.path', '--include-path', true))
                         + strSetting('preview.imageLocation', '--image-location', true)
                         + strSetting('preview.boostRootPath', '--boost-root-path', true)
                         + strSetting('preview.CSSPath', '--css-path', true)
                         + strSetting('preview.graphicsPath', '--graphics-path', true)
                         ;
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
    
    protected processPreview( contents: string, strContentSP: string)
    {
        // Inject Security Policy
        let strSecurityPolicy = `<meta http-equiv="Content-Security-Policy" content="${strContentSP}">`;
        const regexHead = /\<head\>(.*)\<\/head\>/;
        return contents.replace(regexHead, '<head>' + strSecurityPolicy + '$1</head>');
        
        // ?Possible?
        // Scan the html and update every 'file:' URI to the 'vscode-resource:' scheme,
        // using 1.38's webview.asWebviewUri
    }
    
    protected setPreview(title: string, contents: string)
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
                        localResourceRoots: self.localResourceRoots_,
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
        
        self.panel_.title = title;
        self.panel_.iconPath = self.iconPath;
        self.panel_.webview.html = contents;
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
        
        exists(txtEditor.document.fileName).then( (pathFileSource: string) => {
            let commandLine = `${this.strPathToExecutable_}${this.strOptions_} --output-format onehtml --output-file "${self.strPathPreview_}" "${pathFileSource}" `;
            
            return exec(commandLine, {});
        }).then( (output) => {
            self.setOutputChannel(...output);
            return readFile( self.strPathPreview_, {} );
        }).then((strContents) => {
            let strProcessedContents = self.processPreview( strContents, self.strContentSecurityPolicy_ );
            self.setPreview( title, strProcessedContents );
        }).catch((messages: string[]) => {
            self.setOutputChannel(...messages);
            self.setPreview( title, self.getFailurePage(...messages) );
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
