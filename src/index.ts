import 'dotenv/config';
import { MiniOpenCodeServer } from './server/MiniOpenCodeServer.js';
import apiModule from './agent/api.js';

const server = new MiniOpenCodeServer();

server.register('api', apiModule);

await server.start();
