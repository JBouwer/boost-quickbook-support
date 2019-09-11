import * as vscode from 'vscode';
import { QuickbookPreview } from './QuickbookPreview';


export function activate(context: vscode.ExtensionContext)
{
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('"Boost Quickbook" extension is now active!');
    
    let qbPreview: QuickbookPreview | undefined = undefined;
    
    context.subscriptions.push(
        vscode.commands.registerCommand('quickbook.showPreview', () => 
        {
            if(!qbPreview)
            {
                qbPreview = new QuickbookPreview(context);
            }
            
            if(vscode.window.activeTextEditor)
            {
                qbPreview.updatePreview(vscode.window.activeTextEditor);
            } 
            else
            {
                console.log('No "vscode.window.activeTextEditor" for requested preview!');
            }
        })
    );
}

export function deactivate(context: vscode.ExtensionContext)
{
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('"Boost Quickbook" extension is now deactivated.');
}

