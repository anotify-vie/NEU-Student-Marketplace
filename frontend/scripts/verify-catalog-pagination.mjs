import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/chromium');
const profile = await mkdtemp(path.join(tmpdir(),'neu-pagination-'));
const fixture = Array.from({length:63},(_,i)=>({id:1001+i,seller_id:2,title:`Test Listing ${i+1}`,description:'Pagination fixture',category:i<51?'textbooks':'other',price:10000+i*1000,condition:'good',status:'available',image_urls:['assets/textbook.svg'],location:'NEU',created_at:new Date(Date.UTC(2026,9,31,12,0,0)-i*60000).toISOString()}));
const server = createServer(async(req,res)=>{
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root,'.'+pathname);
    if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
    const data = pathname === '/js/mock-data.js' ? Buffer.from(`export const mockItems = ${JSON.stringify(fixture)};`) : await readFile(file);
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
    res.end(data);
  } catch {res.writeHead(404).end();}
});
const port = await new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const browser = spawn(chrome,['--headless','--no-sandbox','--disable-gpu','--no-proxy-server','--proxy-bypass-list=*','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws, nextId=0;const pending=new Map();
const wait = ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function browserUrl(){let output='';for await(const chunk of browser.stderr){output+=chunk.toString();const found=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(found)return found[1];}throw new Error('Chrome failed to launch');}
function command(method,params={},sessionId){const id=++nextId;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
async function evaluate(expression,sessionId){const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(result.exceptionDetails)throw Error(result.exceptionDetails.text);return result.result.value;}
async function until(expression,sessionId){for(let i=0;i<70;i++){if(await evaluate(expression,sessionId))return;await wait(100);}throw Error('Timed out waiting for '+expression+'; state='+JSON.stringify(await evaluate("({url:location.href,cards:document.querySelectorAll('.product-card').length,status:document.getElementById('catalog-status')?.textContent,button:document.getElementById('load-more')?.outerHTML})",sessionId))); }
try{
 ws=new WebSocket(await browserUrl());await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
 ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}});
 const {targetId}=await command('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
 await command('Page.enable',{},sessionId);
 await command('Page.addScriptToEvaluateOnNewDocument',{source: "localStorage.setItem('neu-marketplace-api-mode','mock')"},sessionId);
 await command('Runtime.enable',{},sessionId);
 for(const page of ['/pages/browse.html','/pages/search.html?q=test']){
  await command('Page.navigate',{url:`http://127.0.0.1:${port}${page}`},sessionId);
  await until(`document.querySelectorAll('.product-card').length===50 && !document.getElementById('load-more').hidden`,sessionId);
  if(!await evaluate(`document.getElementById('result-count').textContent==='(63)' && document.getElementById('visible-count').textContent==='Showing 50 of 63 listings'`,sessionId))throw Error('Initial total/visible count mismatch');
  await evaluate(`document.getElementById('load-more').click()`,sessionId);
  await until(`document.querySelectorAll('.product-card').length===63 && document.getElementById('load-more').hidden`,sessionId);
  if(!await evaluate(`document.getElementById('visible-count').textContent==='Showing 63 of 63 listings'`,sessionId))throw Error('Final count mismatch');
  await evaluate(`document.getElementById('sort-select').value='price_desc';document.getElementById('sort-select').dispatchEvent(new Event('change',{bubbles:true}))`,sessionId);
  await until(`document.querySelectorAll('.product-card').length===50 && !document.getElementById('load-more').hidden`,sessionId);
  console.log('PASS '+page+': 50 -> 63, Load More hidden, sort resets page');
 }
 await evaluate(`document.querySelector('input[name="category"][value="textbooks"]').click()`,sessionId);
 await until(`document.querySelectorAll('.product-card').length===50 && document.getElementById('result-count').textContent==='(51)'`,sessionId);
 await evaluate(`document.getElementById('load-more').click()`,sessionId);
 await until(`document.querySelectorAll('.product-card').length===51 && document.getElementById('load-more').hidden`,sessionId);
 console.log('PASS filtered search: 51 results across 2 pages');
} finally {ws?.close();browser.kill();server.close();await new Promise(resolve=>browser.once('exit',resolve));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
