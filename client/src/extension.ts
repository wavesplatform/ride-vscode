'use strict';

import * as path from 'path';

import { workspace, ExtensionContext, commands } from 'vscode';
//import * as child_process from 'child_process'
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient';

import { RideReplPanel } from './RideReplPanel'
import {runReplServer} from './ReplServer'
let client: LanguageClient;

export function activate(context: ExtensionContext) {
	// Activate REPL window
	const appPort = 8125
	const appPath = context.asAbsolutePath(path.join('client', 'node_modules', 'ride-repl/dist'))
	const startCommand = commands.registerCommand('ride-repl.start', () => {
		RideReplPanel.createOrShow(appPort);
	});
	context.subscriptions.push(startCommand);
	runReplServer(appPath, appPort)

	// Language Server
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'main.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'ride' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'rideLanguage',
		'Ride Language Server',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
