import 'dotenv/config';
import { MiniOpenCodeServer } from './server/MiniOpenCodeServer.js';
import apiModule from './agent/api.js';
import appApiModule from './app/api.js';

const server = new MiniOpenCodeServer();

server.register('app-api', appApiModule);
server.register('api', apiModule);

await server.start();
