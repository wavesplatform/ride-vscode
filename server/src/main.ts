'use strict';

import { createConnection } from 'vscode-languageserver/node';
import { LspServer } from './LspServer'

const connection = createConnection()
new LspServer(connection);
