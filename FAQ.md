## FAQ

1. ### How does the "Preview" work?
    
    It simply runs a
    `quickbook [options...]  --output-format onehtml --output-file "CONTEXT.EXTENSIONPATH/jbouwer.boost-quickbook-support-X.Y.Z/out/preview.html" "input_file" `
    command and display the resulting output the file in a `vscode.WebviewPanel`.

1. ### How can I see what command line is used to generate the preview?
    
    The `View/Output` panel will have a `"Quickbook Preview Generation"` channel (drop down) that displays the preview generation command line, and output from `stdout` & `stderr`.

1. ### How come the preview does not update in real time - like the Markdown preview does?
    
    The `quickbook` functionality is not really designed to support that, and hence the  preview does not implement it.

1. ### I've changed a setting `XYZ`, but it does not show up in the command line or in the preview.
    
    Some settings will require a simple "Refresh Preview" to take effect.
    Others - those that persist with the `VSCode WebView`, will require a `Developer: Reload Window` command
    in order to take effect.
