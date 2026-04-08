import { MiniOpenCodeServer } from './MiniOpenCodeServer.js';
import apiModule from '../agent/api.js';
import appApiModule from '../app/api.js';
export function createConfiguredServer(port) {
    const server = new MiniOpenCodeServer({ port });
    server.register('app-api', appApiModule);
    server.register('api', apiModule);
    return server;
}
export async function startConfiguredServer(port) {
    const server = createConfiguredServer(port);
    await server.start();
    return server;
}
