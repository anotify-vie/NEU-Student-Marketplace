import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5500';
const screenshots = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../docs/screenshots/fe1-01');
const profile = await mkdtemp(path.join(tmpdir(),'neu-fe1-chrome-'));
const browser = spawn(chrome,['--headless','--disable-gpu','--no-sandbox','--disable-extensions','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
let nextId = 0;
const pending = new Map();
const exceptions = [];
const consoleErrors = [];

function assert(condition,message) { if (!condition) throw new Error(message); }
function wait(ms) { return new Promise(resolve => setTimeout(resolve,ms)); }
async function browserUrl() {
  let logs = '';
  for await (const chunk of browser.stderr) {
    logs += chunk.toString();
    const match = logs.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (match) return match[1];
  }
  throw new Error('Chrome DevTools did not start.');
}
function command(method,params = {},sessionId) {
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
async function loaded(sessionId,targetUrl) {
  for (let i=0;i<50;i++) {
    const ready = await evaluate(`location.href === ${JSON.stringify(targetUrl)} && document.readyState === 'complete' && !!document.querySelector('.site-header .brand') && (!document.querySelector('.content-status') || document.querySelector('.content-status').textContent.trim() === '')`,sessionId);
    if (ready) return;
    await wait(100);
  }
  throw new Error('Page did not finish rendering.');
}
async function navigate(sessionId,url,width,height) {
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700},sessionId);
  const targetUrl = `${base}${url}`;
  await command('Page.navigate',{url:targetUrl},sessionId);
  await loaded(sessionId,targetUrl);
}
async function screenshot(sessionId,name) {
  const result = await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);
  await writeFile(path.join(screenshots,name),Buffer.from(result.data,'base64'));
}
async function count(sessionId) { return evaluate(`document.querySelectorAll('.product-card').length`,sessionId); }
async function waitCount(sessionId,expected) {
  for(let i=0;i<30;i++){if(await count(sessionId)===expected)return;await wait(100);}
  throw new Error(`Expected ${expected} product cards, received ${await count(sessionId)}.`);
}

try {
  const devtoolsUrl = await browserUrl();
  ws = new WebSocket(devtoolsUrl);
  await new Promise((resolve,reject) => {ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push(message.params.args.map(arg => arg.value || arg.description || '').join(' '));
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id); pending.delete(message.id);
      if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
    }
  });
  const {targetId} = await command('Target.createTarget',{url:'about:blank'});
  const {sessionId} = await command('Target.attachToTarget',{targetId,flatten:true});
  await command('Page.enable',{},sessionId);
  await command('Runtime.enable',{},sessionId);
  await mkdir(screenshots,{recursive:true});

  for (const [name,url] of [['home','/index.html'],['browse','/pages/browse.html'],['search','/pages/search.html?q=textbook']]) {
    await navigate(sessionId,url,1440,1000);
    assert(await evaluate(`[...document.querySelectorAll('.product-card img')].every(img => img.complete && img.naturalWidth > 0)`,sessionId),`${name} contains an unloaded product image.`);
    await screenshot(sessionId,`${name}-desktop.png`);
    assert(await evaluate('document.documentElement.scrollWidth <= window.innerWidth',sessionId),`${name} overflows desktop viewport.`);
    await navigate(sessionId,url,390,844);
    await screenshot(sessionId,`${name}-mobile.png`);
    assert(await evaluate('document.documentElement.scrollWidth <= window.innerWidth',sessionId),`${name} overflows mobile viewport.`);
  }

  await navigate(sessionId,'/index.html',1440,900);
  await evaluate(`(() => { document.querySelector('#home-search').value='calculator'; document.querySelector('.hero-search').requestSubmit(); })()`,sessionId);
  await loaded(sessionId,`${base}/pages/search.html?q=calculator`);
  assert(await count(sessionId)===1,'Home search did not open matching results.');

  await navigate(sessionId,'/pages/browse.html',1440,900);
  assert(await count(sessionId)===12,'Browse must show all 12 mock items.');
  assert(await evaluate(`document.querySelector('.desktop-nav a[href$="index.html"]') !== null && document.querySelector('.desktop-nav a[href$="browse.html"]') !== null`,sessionId),'Main navigation links are missing.');
  await evaluate(`document.querySelector('.favorite-button').click()`,sessionId);
  assert(await evaluate(`document.querySelector('.favorite-button').getAttribute('aria-pressed') === 'true'`,sessionId),'Favorite interaction failed.');
  await evaluate(`(() => { const el=document.querySelector('input[name="category"][value="textbooks"]'); el.checked=true; el.dispatchEvent(new Event('change',{bubbles:true})); })()`,sessionId);
  await waitCount(sessionId,4);
  await evaluate(`(() => { const el=document.querySelector('input[name="min_price"]'); el.value='60000'; el.dispatchEvent(new Event('input',{bubbles:true})); })()`,sessionId);
  await waitCount(sessionId,2);
  await evaluate(`(() => { const el=document.querySelector('input[name="condition"][value="new"]'); el.checked=true; el.dispatchEvent(new Event('change',{bubbles:true})); })()`,sessionId);
  await waitCount(sessionId,1);
  assert((await evaluate(`document.querySelector('.product-title').textContent`,sessionId)).includes('English Grammar'),'Combined filters returned the wrong product.');
  await evaluate(`(() => { const el=document.querySelector('#sort-select'); el.value='price_desc'; el.dispatchEvent(new Event('change',{bubbles:true})); })()`,sessionId);
  assert((await evaluate('location.search',sessionId)).includes('sort=price_desc'),'Sort is not synchronized with the URL.');
  await evaluate(`document.querySelector('.clear-filter-button').click()`,sessionId);
  await waitCount(sessionId,12);

  await navigate(sessionId,'/pages/search.html?q=textbook',1440,900);
  assert(await count(sessionId)===3,'Search should find three textbooks.');
  await navigate(sessionId,'/pages/search.html?q=does-not-exist',1440,900);
  assert(await count(sessionId)===0,'Unknown keyword should have zero results.');
  assert(await evaluate(`!document.getElementById('empty-state').hidden`,sessionId),'Empty state is missing.');
  await evaluate(`document.getElementById('clear-empty').click()`,sessionId);
  await waitCount(sessionId,12);
  assert(exceptions.length===0,`JavaScript exceptions: ${exceptions.join('; ')}`);
  assert(consoleErrors.length===0,`Console errors: ${consoleErrors.join('; ')}`);
  console.log('PASS: desktop/mobile viewport, filter combinations, sorting URL, search and empty state; no JavaScript exceptions.');
  console.log(`Screenshots: ${screenshots}`);
} finally {
  if (ws) ws.close();
  browser.kill();
  const tempRoot = path.resolve(tmpdir()) + path.sep;
  if (path.resolve(profile).startsWith(tempRoot)) await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
