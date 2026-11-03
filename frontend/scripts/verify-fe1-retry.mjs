import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockItems } from '../js/mock-data.js';
import { mockUsers } from '../js/mock-users.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = await mkdtemp(path.join(tmpdir(),'neu-fe1-retry-'));
let staticPort;
let apiPort;
let authStatus = 200;
let itemFailures = 1;
let detailFailures = 1;
let profileFailures = 1;
let browser;
let ws;
let nextId = 0;
const pending = new Map();
const exceptions = [];

function assert(condition,message) { if (!condition) throw new Error(message); }
function wait(ms) { return new Promise(resolve => setTimeout(resolve,ms)); }
function listen(server) { return new Promise(resolve => server.listen(0,'127.0.0.1',() => resolve(server.address().port))); }
function sendJson(response,status,body) {
  response.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':`http://127.0.0.1:${staticPort}`,'Access-Control-Allow-Credentials':'true'});
  response.end(JSON.stringify(body));
}
const apiServer = createServer((request,response) => {
  const url = new URL(request.url,`http://127.0.0.1:${apiPort}`);
  if (url.pathname === '/api/auth/me') {
    sendJson(response,authStatus,authStatus===200?{id:1,display_name:'Demo Student'}:{detail:'Not authenticated'});
  } else if (url.pathname === '/api/items') {
    if (itemFailures-- > 0) sendJson(response,503,{detail:'Service unavailable'});
    else sendJson(response,200,{items:mockItems.slice(0,4),total:4,page:1,page_size:4});
  } else if (url.pathname === '/api/items/101') {
    if (detailFailures-- > 0) sendJson(response,503,{detail:'Service unavailable'});
    else sendJson(response,200,mockItems.find(item => item.id === 101));
  } else if (/^\/api\/users\/\d+\/stats$/.test(url.pathname)) {
    sendJson(response,200,{total:0,available:0,reserved:0,sold:0});
  } else if (url.pathname.startsWith('/api/users/')) {
    const id = Number(url.pathname.split('/').pop());
    if (id === 1 && profileFailures-- > 0) sendJson(response,503,{detail:'Service unavailable'});
    else {
      const user = mockUsers.find(entry => entry.id === id);
      sendJson(response,user?200:404,user || {detail:'Not found'});
    }
  } else sendJson(response,404,{detail:'Not found'});
});
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
const staticServer = createServer(async (request,response) => {
  try {
    const url = new URL(request.url,`http://127.0.0.1:${staticPort}`);
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const target = path.resolve(frontendRoot,`.${pathname}`);
    if (!target.startsWith(frontendRoot + path.sep)) { response.writeHead(403); response.end(); return; }
    let body = await readFile(target);
    if (pathname === '/js/api.js') {
      const original = body.toString();
      const modified = original.replace(/^export const API_MODE = .*;$/m,"export const API_MODE = 'real';")
        .replace(/^export const API_BASE_URL = .*;$/m,`export const API_BASE_URL = 'http://127.0.0.1:${apiPort}/api';`);
      assert(modified !== original,'Could not enable real API mode in test response.');
      body = Buffer.from(modified);
    }
    response.writeHead(200,{'Content-Type':mime[path.extname(target)] || 'application/octet-stream'});
    response.end(body);
  } catch { response.writeHead(404); response.end('Not found'); }
});
function command(method,params={},sessionId) {
  const id = ++nextId;
  return new Promise((resolve,reject) => {
    pending.set(id,{resolve,reject});
    ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
  });
}
async function evaluate(expression,sessionId) {
  const result = await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(sessionId,expression,message) {
  for (let i=0;i<60;i++) { if (await evaluate(expression,sessionId)) return; await wait(100); }
  throw new Error(message);
}
async function browserUrl() {
  let output = '';
  for await (const chunk of browser.stderr) {
    output += chunk.toString();
    const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (match) return match[1];
  }
  throw new Error('Chrome DevTools did not start.');
}

try {
  apiPort = await listen(apiServer);
  staticPort = await listen(staticServer);
  browser = spawn(chrome,['--headless','--disable-gpu','--no-sandbox','--disable-extensions','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  ws = new WebSocket(await browserUrl());
  await new Promise((resolve,reject) => {ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id); pending.delete(message.id);
      if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
    }
  });
  const {targetId} = await command('Target.createTarget',{url:'about:blank'});
  const {sessionId} = await command('Target.attachToTarget',{targetId,flatten:true});
  await command('Page.enable',{},sessionId);
  await command('Runtime.enable',{},sessionId);
  const url = `http://127.0.0.1:${staticPort}/index.html`;
  await command('Page.navigate',{url},sessionId);
  await waitFor(sessionId,`document.querySelector('#recent-status button')?.textContent === 'Retry' && document.querySelector('.account-label')?.textContent === 'Profile'`,'Real-mode Home did not show Retry and the authenticated header.');
  assert(await evaluate(`document.querySelector('.account-link').getAttribute('href').endsWith('/pages/profile.html')`,sessionId),'Authenticated account link is wrong.');
  await evaluate(`document.querySelector('#recent-status button').click()`,sessionId);
  await waitFor(sessionId,`document.querySelectorAll('#recent-grid .product-card').length === 4 && document.getElementById('recent-status').textContent.trim() === ''`,'Home Retry did not recover after the API succeeded.');
  authStatus = 401;
  await command('Page.navigate',{url},sessionId);
  await waitFor(sessionId,`document.querySelector('.account-label')?.textContent === 'Log In' && document.querySelectorAll('#recent-grid .product-card').length === 4`,'Guest header did not recover after a 401 response.');
  authStatus = 200;
  await command('Page.navigate',{url:`http://127.0.0.1:${staticPort}/pages/product-detail.html?id=101`},sessionId);
  await waitFor(sessionId,`!document.getElementById('detail-error')?.hidden && document.getElementById('detail-retry')?.textContent === 'Retry'`,'Product Detail did not show Retry after 503.');
  await evaluate(`document.getElementById('detail-retry').click()`,sessionId);
  await waitFor(sessionId,`!document.getElementById('detail-content')?.hidden && document.getElementById('product-title')?.textContent === 'Microeconomics Textbook'`,'Product Detail Retry did not recover.');
  await command('Page.navigate',{url:`http://127.0.0.1:${staticPort}/pages/profile.html`},sessionId);
  await waitFor(sessionId,`!document.getElementById('profile-error')?.hidden && document.getElementById('profile-retry')?.textContent === 'Retry'`,'Profile did not show Retry after 503.');
  await evaluate(`document.getElementById('profile-retry').click()`,sessionId);
  await waitFor(sessionId,`!document.getElementById('profile-content')?.hidden && document.getElementById('profile-name')?.textContent === 'Mai Anh Nguyen'`,'Profile Retry did not recover.');
  assert(exceptions.length===0,`JavaScript exceptions: ${exceptions.join('; ')}`);
  console.log('PASS: real-mode /auth/me 200 shows Profile; 401 shows Log In; Home, Detail and Profile recover through Retry after 503.');
} finally {
  if (ws) ws.close();
  if (browser) browser.kill();
  await Promise.all([new Promise(resolve => apiServer.close(resolve)),new Promise(resolve => staticServer.close(resolve))]);
  const tempRoot = path.resolve(tmpdir()) + path.sep;
  if (path.resolve(profile).startsWith(tempRoot)) await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
