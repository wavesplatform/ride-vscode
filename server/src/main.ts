'use strict';

import { createConnection } from 'vscode-languageserver';
import { LspServer } from './LspServer'

const connection = createConnection()
new LspServer(connection);