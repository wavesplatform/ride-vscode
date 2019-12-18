# Waves Ride language extention and REPL for Visual Studio Code
## Ride compiler version 1.1.2-15-gd668071

Ride is the language used in Waves blockchain to create smart accounts. This extention provides:
* Syntax highlighting
* Code completion for global functions and fields
* Snippets
* Interactive console console for Waves blockchain

# Usage

Extention recognizes ".ride" files

## Code completion
Use standard Ctrl/Command + Space to autocomplete. Global functions, variables, transaction types are supported. Pattern
matching and if/else statements supported via snippets
### ![](assets/completion.gif "Code completion")

## Go To Definition
Go To Definition is a feature that allows you to jump to the Definition of a variable or procedure. This can be done by placing the mouse over the name you want to see the declaration for, push control or command(on macOS) and left click
### ![](assets/gtd.gif "Go To Declaration")

## Hover
Show documentation on hover
### ![](assets/hover.gif "Hover")

## Signature help
Signature help. When you open the bracket, trying to call a function, a pop-up provides signature help for the function. As you keep typing the parameters, the hint (underline) moves to the next parameter. Tip: Use ⇧⌘Space (Windows, Linux Ctrl+Shift+Space) to manually trigger the signature help when the cursor is inside the in the function call.
### ![](assets/sh.gif "Signature help")

## Error highlighting
Currently shows first compilation error. Invalid base64 and base58 strings are highlighted via syntax highlighting
### ![](assets/error.gif "Error highlighting")

## Surfboard package
To interact with blockhain via terminal use [surfboard](https://github.com/wavesplatform/surfboard).
Surfboard is distributed as npm package. To install run `npm i -g @waves/surfboard`. You can create projects, compile files, run test and play with REPL for ride language
### ![](assets/repl.gif "Repl")


