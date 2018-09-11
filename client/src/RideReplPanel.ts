import * as vscode from 'vscode'

export interface IReplSettings {
	seed: string,
	networkCode: string
}

export class RideReplPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: RideReplPanel | undefined;

	private static readonly viewType = 'react';

	private readonly _panel: vscode.WebviewPanel;

	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(appPort: number) {
		const column = vscode.ViewColumn.Three
		// If we already have a panel, show it.
		// Otherwise, create a new panel.
		if (RideReplPanel.currentPanel) {
			RideReplPanel.currentPanel._panel.reveal(column);
		} else {
			RideReplPanel.currentPanel = new RideReplPanel(column, appPort);
		}
	}

	private constructor(column: vscode.ViewColumn, private appPort = 8175) {
		// Create and show a new webview panel
		this._panel = vscode.window.createWebviewPanel(RideReplPanel.viewType, "RideRepl", column, {
			// Enable javascript in the webview
			enableScripts: true,
			// Act as background tab
			retainContextWhenHidden: true
		});

		// Set the webview's initial html content 
		this._panel.webview.html = this._getHtmlForWebview();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle commands from the webview
		this._panel.webview.onDidReceiveMessage(message => {
			switch (message.command) {
				case 'GetDefaultSettings':
					this.updateWebviewSettings()
				default:
					console.log(`Unknown command ${message.command}`)

			}
		}, null, this._disposables);

		// Send message on settings update
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('rideExtention.repl')) {
				this.updateWebviewSettings()
			}
		})
	}

	private updateWebviewSettings() {
		// Send a message to the webview webview.
		// You can send any JSON serializable data.
		if (this._panel) {
			const replSettings = vscode.workspace.getConfiguration('rideExtention.repl')
			this._panel.webview.postMessage({
				command: 'ReplSettings',
				value: replSettings
			});
		}
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

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
				<meta name="theme-color" content="#000000">
				<title>React App</title>
				<base href="http://localhost:${this.appPort}/">
			</head>
			<body>
				<noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root">Grazzi ragazzi</div>
				<script src="bundle.js"></script>
			</body>
			</html>`;
	}
}