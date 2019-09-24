# Change Log

[//]: # (
    All notable changes to the "boost-quickbook-support" extension will be documented in this file.
    Check http://keepachangelog.com for recommendations on how to structure this file.
)

## 0.0.4
- Added _Content Security Policy_, (Issue #3), and associated `quickbook.preview.contentSecurityPolicy` setting.
- Modified settings functionality to reload with every _preview_ operation (no more _Reload Window_ necessary).
- Partially fixed Issue #2, with support for `CSS` file setting & support graphics (not user-images).
    > Note that at the time of writing I needed to set the _Graphics Path_ setting to:
    > `vscode-resource:/BOOST_PATH/doc/src/images/` for this to work correctly - setting the _Boost Root Directory_
    > only did not resolve to the correct image directory.

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