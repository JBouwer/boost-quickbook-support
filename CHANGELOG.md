# Change Log

[//]: # (
    All notable changes to the "boost-quickbook-support" extension will be documented in this file.
    Check http://keepachangelog.com for recommendations on how to structure this file.
)

## 0.0.6
- Catchup with graphics post-processing oversights. (Issue #9)

## 0.0.5
- Minumum version now 1.38  
  This is to use new `webview` api functionality, as explained in https://code.visualstudio.com/updates/v1_38#_webviewaswebviewuri-and-webviewcspsource.
- Regarding _Preview_ generation:
    - All directory paths specified in the settings are now appended with a platform specific path separator, when passed to `quickbook` executable for preview generation. (Fixed issue #5)
    - Added additional `array`-settings to allow for multiple `--include-path` (`-I`) & `--define` (`-D`) options passed to `quickbook` executable for preview generation. (Fixed issue #4)
    - Removed suggestions from setting-descriptions to "prepend path[s] with `vscode-resource:`" -
      this is now implicitly done via the `asWebviewUri` call
      (As specified by [VSCode Documentation](https://code.visualstudio.com/api/extension-guides/webview#loading-local-content)).
    - Refined the _Content Security Policy_ processing.
    - Refined preview resource-link post-processing;
      _Boost_ graphics (like callouts etc.) are now more stable (fixed?).  
      (I don't need to resort to passing a `--graphics-path "vscode-resource:/BOOST_PATH/doc/src/images/"` anymore - 
      as reported for v 0.0.4)
    - The "`quickbook.preview.security.contentSecurityPolicy`" setting now defaults to "`default-src vscode-resource: https:;`" - thus also allowing `https:`
      resources by default.

## 0.0.4
- Modified settings functionality to reload with every _preview_ operation (no more _Reload Window_ necessary).
- Added _Content Security Policy_, (Issue #3), and associated `quickbook.preview.security.contentSecurityPolicy` setting.
- Seemingly fixed Issue #2, with support for `CSS` file setting, support graphics & user-images.
    > Note that:
    > - At the time of writing I needed to set my _Graphics Path_ setting to:
    > `vscode-resource:/BOOST_PATH/doc/src/images/` for Boost graphics to resolve to the correct path - setting
    > the _Boost Root Directory_ was not adequate.
- Explicit _trusting_ of local directories for preview (See [Security](#Security).)

## 0.0.3
- Fixed Comments that surround template expansion (and other comment) patterns.
- Preview panel now with buttons & menu items:
    - Refresh
    - View Source
    - Preview to the side
- Command palette now ignoring invalid entries

## 0.0.2
- Minor documentation & naming issues fixed.

## 0.0.1
- Initial release