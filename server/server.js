import './config/env.js';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';

let server;
if(env.https){const [key,cert]=await Promise.all([readFile(env.httpsKey),readFile(env.httpsCert)]);server=https.createServer({key,cert},app);}else server=http.createServer(app);
server.listen(env.port,()=>console.log(`Planeta Fitness API escuchando en ${env.https?'https':'http'}://localhost:${env.port}`));
async function shutdown(signal){console.log(`Cerrando servidor (${signal})...`);server.close(async()=>{await prisma.$disconnect();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGINT',()=>shutdown('SIGINT'));
process.on('SIGTERM',()=>shutdown('SIGTERM'));
