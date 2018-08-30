import * as path from 'path';
import * as vscode from 'vscode'
import * as child_process from 'child_process'
//import { Repl } from '../../../waves-ide/src/repl/src'

export class RideReplPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: RideReplPanel | undefined;

	private static readonly viewType = 'react';

	private readonly _panel: vscode.WebviewPanel;
	private readonly httpServerProcess: any

	private readonly _extensionPath: string;
	private readonly pathToApp: string;

	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionPath: string) {
		const column = vscode.ViewColumn.Three //vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		// create new child procees with server of not exists


		// If we already have a panel, show it.
		// Otherwise, create a new panel.
		if (RideReplPanel.currentPanel) {
			RideReplPanel.currentPanel._panel.reveal(column);
		} else {
			RideReplPanel.currentPanel = new RideReplPanel(extensionPath, column);
		}
	}

	private constructor(extensionPath: string, column: vscode.ViewColumn) {
		this._extensionPath = extensionPath;
		this.pathToApp = '/Users/siem/PycharmProjects/ride-repl/dist'//path.join(this._extensionPath,'client','node_modules','ride-repl', 'dist')

		// this.httpServerProcess = child_process.fork(path.join(this._extensionPath, 'client', 'out', 'ReplServer.js'))
		// this.httpServerProcess.on('message', console.log)
		// Create and show a new webview panel
		this._panel = vscode.window.createWebviewPanel(RideReplPanel.viewType, "RideRepl", column, {
			// Enable javascript in the webview
			enableScripts: true,
			// Act as background tab
			retainContextWhenHidden: true,
			// And restric the webview to only loading content from our extension's `media` directory.
			localResourceRoots: [
				vscode.Uri.file(this.pathToApp)
			]
		});
		
		// Set the webview's initial html content 
		this._panel.webview.html = this._getHtmlForWebview();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(message => {
			switch (message.command) {
				case 'alert':
					vscode.window.showErrorMessage(message.text);
					return;
			}
		}, null, this._disposables);
	}

	public doRefactor() {
		// Send a message to the webview webview.
		// You can send any JSON serializable data.
		this._panel.webview.postMessage({ command: 'refactor' });
	}

	public dispose() {
		RideReplPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _getHtmlForWebview() {
		// const manifest = require(path.join(this._extensionPath, 'build', 'asset-manifest.json'));
		// const mainScript = manifest['main.js'];
		// const mainStyle = manifest['main.css'];

		const scriptPathOnDisk = vscode.Uri.file(path.join(this.pathToApp, 'bundle.js'));
		const scriptUri = scriptPathOnDisk.with({ scheme: 'vscode-resource' });
		// const stylePathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'build', mainStyle));
		// const styleUri = stylePathOnDisk.with({ scheme: 'vscode-resource' });

		const styleUri = ''
		//const scriptUri = ''
		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
				<meta name="theme-color" content="#000000">
				<title>React App</title>
				<link rel="stylesheet" type="text/css" href="${styleUri}">
				<base href="${vscode.Uri.file(this.pathToApp).with({ scheme: 'vscode-resource' })}/">
			</head>
			<body>
				<noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root">Grazzi ragazzi</div>
				
				<script nonce="${nonce}" src="${scriptUri}">
					window.location.href='http://localhost:8125/index.html'
				</script>
			</body>
			</html>`;
	}
}
function getNonce() {
	let text = "";
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}