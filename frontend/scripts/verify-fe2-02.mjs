import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockItems } from '../js/mock-data.js';
import { mockUsers } from '../js/mock-users.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const screenshots = process.env.SCREENSHOTS_DIR || path.resolve(root,'../docs/screenshots/fe2-02');
const chrome = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : 'google-chrome');
const profile = await mkdtemp(path.join(tmpdir(),'neu-fe2-02-'));
const requests = [], errors = [], pending = new Map();
let base, browser, ws, session, nextId=0, realMode=false, failRoute='', failMethod='', delayThread=false;
const realItems = new Map(mockItems.map(item => [item.id,{...item}]));
const realConversations = [{id:1001,item_id:101,buyer_id:1,seller_id:2,updated_at:'2026-11-01T10:00:00Z'},{id:1002,item_id:102,buyer_id:2,seller_id:3,updated_at:'2026-11-01T09:00:00Z'}];
const realMessages = [{id:1,conversation_id:1001,sender_id:1,text:'Is the textbook available?',created_at:'2026-11-01T10:00:00Z'},{id:2,conversation_id:1002,sender_id:3,text:'We can meet near the library.',created_at:'2026-11-01T09:00:00Z'}];
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
function assert(value,message) { if (!value) throw new Error(message); }
function json(response,status,data) { response.writeHead(status,{'Content-Type':'application/json'}); response.end(JSON.stringify(data)); }
const server = createServer(async (request,response) => {
  try {
    const url = new URL(request.url,base); response.setHeader('Cache-Control','no-store');
    if (url.pathname.startsWith('/api/')) {
      let body=''; for await (const chunk of request) body+=chunk;
      requests.push({route:url.pathname,query:url.search,method:request.method,body,cookie:request.headers.cookie});
      if (url.pathname===failRoute && (!failMethod || failMethod===request.method)) { failRoute=''; failMethod=''; return json(response,503,{detail:'Service unavailable. Please try again.'}); }
      if (url.pathname==='/api/auth/me') return json(response,request.headers.cookie?200:401,{id:2,display_name:'Ha Linh Tran'});
      if (url.pathname==='/api/auth/logout') { response.setHeader('Set-Cookie','neu_test_session=; Max-Age=0; Path=/'); response.writeHead(204); return response.end(); }
      if (url.pathname==='/api/conversations') return json(response,200,realConversations.map(entry => ({...entry,
        other_user:mockUsers.find(user=>user.id===(entry.buyer_id===2?entry.seller_id:entry.buyer_id)),
        item:realItems.get(entry.item_id),last_message:realMessages.filter(message=>message.conversation_id===entry.id).at(-1)||null,
      })));
      if (url.pathname==='/api/me/items') return json(response,200,[...realItems.values()].filter(item=>item.seller_id===2));
      const messageRoute=url.pathname.match(/^\/api\/conversations\/(\d+)\/messages$/);
      if (messageRoute) {
        const id=Number(messageRoute[1]);
        if (delayThread && id===1001 && request.method==='GET') { delayThread=false; await wait(600); }
        if (request.method==='POST') {
          const message={id:Math.max(...realMessages.map(entry=>entry.id))+1,conversation_id:id,sender_id:2,text:JSON.parse(body).text,created_at:new Date().toISOString()};
          realMessages.push(message); realConversations.find(entry=>entry.id===id).updated_at=message.created_at; return json(response,201,message);
        }
        return json(response,200,realMessages.filter(entry=>entry.conversation_id===id && entry.id>Number(url.searchParams.get('after_id')||0)));
      }
      if (url.pathname.startsWith('/api/users/')) return json(response,200,mockUsers.find(user=>user.id===Number(url.pathname.split('/').pop())));
      const itemRoute=url.pathname.match(/^\/api\/items\/(\d+)(\/status)?$/);
      if (itemRoute) {
        const id=Number(itemRoute[1]);
        if(request.method==='DELETE') {realItems.delete(id);response.writeHead(204);return response.end();}
        if(request.method==='PATCH') realItems.set(id,{...realItems.get(id),...JSON.parse(body)});
        return json(response,realItems.has(id)?200:404,realItems.get(id)||{detail:'This listing could not be found.'});
      }
      return json(response,404,{detail:'Not found'});
    }
    const file=path.resolve(root,`.${decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)}`);
    if(!file.startsWith(root+path.sep)) {response.writeHead(403);return response.end();}
    let data=await readFile(file);
    if(file.replaceAll('\\','/').endsWith('/js/api.js')) data=Buffer.from(data.toString().replace(/^export const API_MODE = .*;$/m,`export const API_MODE = '${realMode ? 'real' : 'mock'}';`).replace(/^export const API_BASE_URL = .*;$/m,`export const API_BASE_URL = '${base}/api';`));
    response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});response.end(data);
  } catch {response.writeHead(404);response.end('Not found');}
});
function command(method,params={},target=session) {
  const id=++nextId;
  return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(target?{sessionId:target}:{})}));});
}
async function evaluate(expression,target=session) {
  const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},target);
  if(result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression,message,target=session) {
  for(let i=0;i<100;i++) {if(await evaluate(expression,target)) return;await wait(75);}
  throw new Error(message);
}
async function navigate(route,width=1440,target=session) {
  await command('Emulation.setDeviceMetricsOverride',{width,height:width<700?844:1050,deviceScaleFactor:1,mobile:width<700},target);
  await command('Page.navigate',{url:base+route},target);
  await waitFor(`location.pathname===${JSON.stringify(route.split('?')[0])} && document.readyState==='complete' && !!document.querySelector('.site-header .brand')`,'Page did not load: '+route,target);
}
async function account(id,target=session) {await evaluate(`sessionStorage.${id?`setItem('neu-marketplace-demo-user-id','${id}')`:`removeItem('neu-marketplace-demo-user-id')`}`,target);}
async function screenshot(name,width) {
  await waitFor(`[...document.images].every(image=>image.complete && image.naturalWidth>0)`,'Images missing: '+name);
  const {cssContentSize}=await command('Page.getLayoutMetrics');
  const result=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:cssContentSize.height,scale:1}});
  await writeFile(path.join(screenshots,name+'.png'),Buffer.from(result.data,'base64'));
}
const api=expression=>`(async()=>{const api=await import('/js/api.js');${expression}})()`;
async function newTab() {
  const {targetId}=await command('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
  await command('Page.enable',{},sessionId);await command('Runtime.enable',{},sessionId);return sessionId;
}

try {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
  browser=spawn(chrome,['--headless','--disable-gpu','--no-sandbox','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank']);
  const devtools=await new Promise((resolve,reject)=>{
    let logs='';browser.on('error',reject);browser.on('exit',code=>reject(new Error('Chrome exited: '+code)));
    browser.stderr.on('data',chunk=>{logs+=chunk;const match=logs.match(/DevTools listening on (ws:\/\/\S+)/);if(match)resolve(match[1]);});
  });
  ws=new WebSocket(devtools);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{
    const data=JSON.parse(event.data);
    if(data.method==='Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
    if(data.method==='Runtime.consoleAPICalled' && data.params.type==='error') errors.push(JSON.stringify(data.params.args));
    if(pending.has(data.id)) {const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(new Error(data.error.message)):task.resolve(data.result);}
  });
  session=await newTab();await command('Page.bringToFront');await mkdir(screenshots,{recursive:true});
  await navigate('/pages/login.html');
  for(const route of ['/pages/chat.html','/pages/my-listings.html']) {
    await command('Page.navigate',{url:base+route});
    await waitFor(`location.pathname==='/pages/login.html' && new URLSearchParams(location.search).get('returnTo')==='${route}'`,'Guest guard failed');
  }
  await account(2);
  // Simulate an existing issue #3 browser database; the v2 migration must retain it.
  const saved={...mockItems[0],id:777,title:'Economics Workbook',seller_id:2};
  await evaluate(`new Promise((resolve,reject)=>{const open=indexedDB.open('neu-marketplace-demo',1);open.onupgradeneeded=()=>open.result.createObjectStore('items',{keyPath:'id'});open.onsuccess=()=>{const tx=open.result.transaction('items','readwrite');tx.objectStore('items').put(${JSON.stringify(saved)});tx.oncomplete=()=>{open.result.close();resolve(true);};};open.onerror=reject;})`);
  await navigate('/pages/my-listings.html');
  await waitFor(`!!document.querySelector('tr[data-id="777"]')`,'Database upgrade lost previous listings');
  await navigate('/pages/chat.html');
  await waitFor(`!document.getElementById('no-conversations').hidden`,'Empty chat missing');
  // Complete the public Detail → Login → Chat handoff using the actual forms.
  await account(null);await navigate('/pages/product-detail.html?id=101');
  await waitFor(`document.getElementById('product-title').textContent==='Microeconomics Textbook'`,'Detail not ready');
  await evaluate(`document.getElementById('chat-button').click()`);
  await waitFor(`location.pathname==='/pages/login.html' && !!document.getElementById('page-form')`,'Detail did not route guest to Login');
  await evaluate(`document.getElementById('email').value='buyer@example.com';document.getElementById('password').value='MarketplaceDemo1!';document.getElementById('page-form').requestSubmit()`);
  await waitFor(`location.pathname==='/pages/product-detail.html' && document.getElementById('product-title')?.textContent==='Microeconomics Textbook'`,'Login did not restore Detail');
  await evaluate(`document.getElementById('chat-button').click()`);
  await waitFor(`location.pathname==='/pages/chat.html' && document.getElementById('thread-status')?.textContent.includes('Say hello')`,'Buyer did not open the item conversation');
  await evaluate(`document.querySelector('.header-actions .logout-button').click()`);
  await waitFor(`location.pathname==='/index.html'`,'Mock logout failed');
  await navigate('/pages/login.html?returnTo=%2Fpages%2Fchat.html');
  await evaluate(`document.getElementById('email').value='seller@example.com';document.getElementById('password').value='MarketplaceDemo1!';document.getElementById('page-form').requestSubmit()`);
  await waitFor(`location.pathname==='/pages/chat.html' && document.querySelectorAll('.conversation-button').length===1`,'Seller cannot see buyer conversation');
  await evaluate(`document.getElementById('demo-chat').click()`);
  await waitFor(`document.querySelectorAll('.conversation-button').length>=3`,'Demo conversations missing');
  const conversationId=await evaluate(api(`return (await api.getConversations()).find(entry=>entry.item_id===101 && entry.buyer_id===1).id;`));
  const count=await evaluate(api('return (await api.getConversations()).length;'));
  await evaluate(`document.getElementById('demo-chat').click()`);
  await waitFor(`!document.getElementById('demo-chat').disabled`,'Demo reload did not finish');
  assert(await evaluate(api('return (await api.getConversations()).length;'))===count,'Demo action duplicates conversations');
  await navigate(`/pages/chat.html?conversationId=${conversationId}`);
  await waitFor(`document.querySelectorAll('.message').length===2`,'Seed messages missing');
  await evaluate(`document.getElementById('message-input').value='  ';document.getElementById('message-form').requestSubmit()`);
  assert(await evaluate(`document.getElementById('message-error').textContent.length>0 && document.querySelectorAll('.message').length===2`),'Empty message accepted');
  await evaluate(`document.getElementById('message-input').value='I can meet after class.';document.getElementById('message-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))`);
  await waitFor(`document.querySelectorAll('.message').length===3 && document.querySelector('.message:last-child').classList.contains('message--out')`,'Enter did not send');
  await navigate(`/pages/chat.html?conversationId=${conversationId}`);
  await waitFor(`document.querySelectorAll('.message').length===3`,'Message did not persist after reload');
  const second=await newTab();await navigate('/pages/login.html',1440,second);await account(1,second);await command('Page.bringToFront');
  await evaluate(api(`await api.sendMessage(${conversationId},'Could we meet at the library tomorrow?');`),second);
  await waitFor(`document.querySelector('.message:last-child')?.textContent.includes('Could we meet at the library tomorrow?')`,'Incoming cross-account message not received');
  assert(await evaluate(`!document.querySelector('.message:last-child').classList.contains('message--out') && document.getElementById('message-list').scrollTop+document.getElementById('message-list').clientHeight>=document.getElementById('message-list').scrollHeight-3`),'Incoming style or auto-scroll failed');
  await account(4,second);
  for(const action of [`getMessages(${conversationId})`,`sendMessage(${conversationId},'Forbidden')`,`deleteItem(101)`,`updateItemStatus(101,'sold')`]) {
    assert(await evaluate(api(`try{await api.${action};return false;}catch(error){return error.status===403;}`),second),'Unauthorized API access: '+action);
  }
  await command('Page.navigate',{url:'about:blank'},second);
  for(const [label,width] of [['desktop',1440],['tablet',768],['mobile',390]]) {
    await navigate(`/pages/chat.html?conversationId=${conversationId}`,width);
    await waitFor(`document.querySelectorAll('.message').length===4`,'Chat screenshot not ready');await screenshot(`chat-${label}`,width);
    await navigate('/pages/my-listings.html',width);await waitFor(`!!document.querySelector('tr[data-id="101"]')`,'Listings screenshot not ready');await screenshot(`my-listings-${label}`,width);
  }
  await navigate(`/pages/chat.html?conversationId=${conversationId}`,320);
  await waitFor(`document.querySelectorAll('.message').length===4`,'Mobile thread missing');
  await evaluate(`document.getElementById('back-conversations').click()`);
  assert(await evaluate(`!document.getElementById('chat-layout').classList.contains('has-active') && document.getElementById('chat-thread').hidden`),'Mobile Back did not restore conversation list');
  await evaluate(`document.querySelector('.conversation-button').click()`);
  await waitFor(`document.getElementById('chat-layout').classList.contains('has-active') && !document.getElementById('message-input').disabled`,'Mobile conversation selection failed');
  // Audit every implemented screen at narrow mobile, mobile, tablet and desktop widths.
  const routes=['/index.html','/pages/browse.html','/pages/search.html?q=textbook','/pages/product-detail.html?id=101','/pages/profile.html','/pages/login.html','/pages/register.html','/pages/create-listing.html','/pages/edit-listing.html?id=101','/pages/chat.html?conversationId='+conversationId,'/pages/my-listings.html'];
  for(const route of routes) {
    for(const width of [320,390,768,801,1024,1440]) {
      await navigate(route,width);
      await waitFor(`!document.querySelector('.content-status')?.textContent.includes('Loading')`,'Loading never completed: '+route);
      assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`${route} overflows ${width}px`);
      if(width===390 && !route.includes('chat.html') && !route.includes('my-listings.html')) await screenshot('audit-'+(route.includes('index.html')?'home':route.split('/').pop().split('.')[0])+'-mobile',width);
    }
  }
  await navigate('/pages/my-listings.html',390);
  await waitFor(`!!document.querySelector('tr[data-id="101"]')`,'Listings not ready');
  await evaluate(`document.querySelector('.mobile-menu-button').click()`);
  assert(await evaluate(`document.querySelector('.mobile-menu-button').getAttribute('aria-expanded')==='true' && document.querySelector('.mobile-nav a[href$="chat.html"]')!==null`),'Mobile navigation missing');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  assert(await evaluate(`document.querySelector('.mobile-menu-button').getAttribute('aria-expanded')==='false'`),'Escape did not close navigation');
  await evaluate(`document.querySelector('tr[data-id="101"] .listing-status-select').value='reserved';document.querySelector('tr[data-id="101"] select').dispatchEvent(new Event('change',{bubbles:true}))`);
  await waitFor(`document.querySelector('tr[data-id="101"] select').value==='reserved' && !document.querySelector('tr[data-id="101"] select').disabled`,'Status update failed');
  await evaluate(`document.getElementById('tab-reserved').click()`);
  assert(await evaluate(`document.querySelectorAll('#listing-rows tr').length===1`),'Reserved filter failed');
  await evaluate(`document.getElementById('tab-all').click();document.querySelector('tr[data-id="101"] select').value='available';document.querySelector('tr[data-id="101"] select').dispatchEvent(new Event('change',{bubbles:true}))`);
  await waitFor(`document.querySelector('tr[data-id="101"] select').value==='available' && !document.querySelector('tr[data-id="101"] select').disabled`,'Reserved→Available failed');
  const editHref=await evaluate(`document.querySelector('tr[data-id="101"] .listing-actions a').getAttribute('href')`);assert(editHref==='edit-listing.html?id=101','Edit action URL wrong');
  await evaluate(`document.querySelector('tr[data-id="101"] .listing-actions a').click()`);
  await waitFor(`location.pathname==='/pages/edit-listing.html' && document.getElementById('title')?.value==='Microeconomics Textbook'`,'Edit action did not load existing listing');
  await navigate('/pages/my-listings.html');await waitFor(`!!document.querySelector('tr[data-id="101"]')`,'Listings not ready');
  await evaluate(`document.querySelector('tr[data-id="101"] select').value='sold';document.querySelector('tr[data-id="101"] select').dispatchEvent(new Event('change',{bubbles:true}))`);
  await waitFor(`document.querySelector('tr[data-id="101"] select').value==='sold' && document.querySelector('tr[data-id="101"] select').disabled`,'Sold status not final');
  assert(await evaluate(api(`try{await api.updateItemStatus(101,'available');return false;}catch{return true;}`)),'Sold listing reopened');
  await navigate('/pages/product-detail.html?id=101');await waitFor(`document.getElementById('product-status').textContent==='Sold' && document.getElementById('chat-button').disabled`,'Detail status inconsistent');
  await account(1);assert(await evaluate(api(`try{await api.openConversation(101);return false;}catch{return true;}`)),'Sold listing accepted new conversation');
  await account(2);await navigate(`/pages/chat.html?conversationId=${conversationId}`);await waitFor(`document.querySelectorAll('.message').length===4`,'Sold item history disappeared');
  await navigate('/pages/my-listings.html');await waitFor(`!!document.querySelector('tr[data-id="101"]')`,'Listings not ready');
  await evaluate(`document.querySelector('[data-delete="101"]').click();document.querySelector('#delete-form button[value="cancel"]').click()`);
  assert(await evaluate(`!document.getElementById('delete-dialog').open && !!document.querySelector('tr[data-id="101"]')`),'Delete Cancel removed listing');
  await evaluate(`document.querySelector('[data-delete="101"]').click();document.querySelector('#delete-form button[value="delete"]').click()`);
  await waitFor(`!document.querySelector('tr[data-id="101"]') && !document.getElementById('delete-dialog').open`,'Delete failed');
  await navigate('/pages/my-listings.html');await waitFor(`!!document.querySelector('tr[data-id="777"]') && !document.querySelector('tr[data-id="101"]')`,'Deleted fixture reappeared after reload');
  await navigate(`/pages/chat.html?conversationId=${conversationId}`);await waitFor(`document.getElementById('thread-product').textContent.includes('Listing unavailable') && document.querySelectorAll('.message').length===4`,'Deletion broke existing conversation');
  await navigate('/pages/my-listings.html');await waitFor(`!!document.querySelector('tr[data-id="777"]')`,'Listings missing');
  await evaluate(`document.getElementById('tab-sold').click()`);assert(await evaluate(`!document.getElementById('listings-empty').hidden`),'Empty status filter missing');
  // Long user-provided text must not break FE1 or management layouts.
  await evaluate(api(`const item=await api.getItem(777);await api.updateItem(777,{...item,title:'A'.repeat(120)});await api.updateProfile(2,{display_name:'B'.repeat(80),faculty:'Faculty of Economics',cohort:'K63',bio:'C'.repeat(300)});`));
  for(const route of ['/pages/product-detail.html?id=777','/pages/profile.html','/pages/my-listings.html']) {
    await navigate(route,320);await waitFor(`!document.querySelector('.content-status')?.textContent.includes('Loading')`,'Stress page not loaded');
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Long text overflows: '+route);
  }
  await navigate('/pages/my-listings.html');
  await evaluate(api(`await api.register({display_name:'New Student',email:'new@example.com',password:'StudentDemo123!'});await api.login({email:'new@example.com',password:'StudentDemo123!'});`));
  await navigate('/pages/my-listings.html');await waitFor(`!document.getElementById('listings-empty').hidden`,'New account empty listings missing');
  await navigate('/pages/chat.html');await waitFor(`!document.getElementById('no-conversations').hidden && document.getElementById('demo-chat').hidden`,'New account empty chat missing');

  // REAL mode: API contracts, errors, polling, old-response isolation and lifecycle.
  await command('Page.navigate',{url:'about:blank'});realMode=true;
  await command('Network.setCookie',{name:'neu_test_session',value:'1',url:base,httpOnly:true});
  await navigate('/pages/my-listings.html');await waitFor(`!!document.querySelector('tr[data-id="101"]')`,'Real own-items endpoint failed');
  failRoute='/api/items/101/status';failMethod='PATCH';
  await evaluate(`document.querySelector('tr[data-id="101"] select').value='reserved';document.querySelector('tr[data-id="101"] select').dispatchEvent(new Event('change',{bubbles:true}))`);
  await waitFor(`document.getElementById('listings-feedback').textContent.includes('Service unavailable') && document.querySelector('tr[data-id="101"] select').value==='available'`,'Status error did not restore UI');
  await evaluate(`document.querySelector('tr[data-id="101"] select').value='reserved';document.querySelector('tr[data-id="101"] select').dispatchEvent(new Event('change',{bubbles:true}))`);
  await waitFor(`document.querySelector('tr[data-id="101"] select').value==='reserved' && !document.querySelector('tr[data-id="101"] select').disabled`,'Real status retry failed');
  failRoute='/api/items/101';failMethod='DELETE';
  await evaluate(`document.querySelector('[data-delete="101"]').click();document.querySelector('#delete-form button[value="delete"]').click()`);
  await waitFor(`document.getElementById('delete-error').textContent.includes('Service unavailable') && document.getElementById('delete-dialog').open`,'Delete API error missing');
  await evaluate(`document.querySelector('#delete-form button[value="cancel"]').click()`);
  failRoute='/api/me/items';await navigate('/pages/my-listings.html');await waitFor(`!document.getElementById('listings-retry').hidden`,'Listing load error missing');
  await evaluate(`document.getElementById('listings-retry').click()`);await waitFor(`!!document.querySelector('tr[data-id="101"]') && document.getElementById('listings-retry').hidden`,'Listing load Retry failed');
  failRoute='/api/conversations';await navigate('/pages/chat.html?conversationId=1001');await waitFor(`!document.getElementById('chat-retry').hidden`,'Chat load error missing');
  await evaluate(`document.getElementById('chat-retry').click()`);await waitFor(`document.querySelector('.message')?.textContent.includes('Is the textbook')`,'Chat Retry failed');
  const before=realMessages.length;
  failRoute='/api/conversations/1001/messages';failMethod='POST';
  await evaluate(`document.getElementById('message-input').value='Real message';document.getElementById('message-form').requestSubmit()`);
  await waitFor(`document.getElementById('message-error').textContent.includes('Service unavailable') && !document.getElementById('message-input').disabled`,'Send error missing');
  assert(realMessages.length===before,'Failed send added a message');
  await evaluate(`document.getElementById('message-form').requestSubmit()`);await waitFor(`document.querySelector('.message:last-child').textContent.includes('Real message')`,'Send retry failed');
  const incoming={id:100,conversation_id:1001,sender_id:1,text:'Incoming through REST polling',created_at:new Date(Date.now()+1000).toISOString()};realMessages.push(incoming);
  realConversations[0].updated_at=incoming.created_at;
  await waitFor(`document.querySelector('.message:last-child').textContent.includes('Incoming through REST polling')`,'REST polling did not receive message');
  assert(requests.some(entry=>entry.route==='/api/conversations/1001/messages' && entry.query.includes('after_id=')),'Incremental after_id polling missing');
  // A delayed response for conversation 1001 must not overwrite 1002 after selection.
  await evaluate(`document.querySelector('[data-id="1002"]').click()`);await waitFor(`document.querySelector('.message')?.textContent.includes('We can meet')`,'Conversation switch failed');
  delayThread=true;await evaluate(`document.querySelector('[data-id="1001"]').click();document.querySelector('[data-id="1002"]').click()`);
  await waitFor(`document.querySelector('.message')?.textContent.includes('We can meet')`,'Second selection did not load');await wait(800);
  assert(await evaluate(`document.querySelectorAll('.message').length===1 && document.querySelector('.message').textContent.includes('We can meet')`),'Stale thread response overwrote selection');
  await navigate('/pages/chat.html?conversationId=999');await waitFor(`document.getElementById('chat-notice').textContent.includes('do not have access')`,'Unauthorized conversation URL not handled');
  assert(!requests.some(entry=>entry.route==='/api/conversations/999/messages'),'UI fetched unauthorized conversation messages');
  await navigate('/pages/chat.html?conversationId=1001');await waitFor(`document.querySelectorAll('.message').length===3`,'Real thread missing');
  const background=await newTab();await command('Page.bringToFront',{},background);
  await waitFor('document.hidden','Chat did not become hidden');await wait(600);
  const countHidden=requests.filter(entry=>entry.route==='/api/conversations').length;await wait(4500);
  assert(requests.filter(entry=>entry.route==='/api/conversations').length===countHidden,'Polling continued in hidden tab');
  await command('Page.bringToFront');await waitFor('!document.hidden','Chat did not resume');
  await command('Page.navigate',{url:base+'/pages/my-listings.html'});await waitFor(`location.pathname==='/pages/my-listings.html' && !!document.querySelector('tr[data-id="101"]')`,'Navigation failed');await wait(500);
  const countAway=requests.filter(entry=>entry.route==='/api/conversations').length;await wait(4500);
  assert(requests.filter(entry=>entry.route==='/api/conversations').length===countAway,'Polling continued after leaving Chat');
  await evaluate(`document.querySelector('[data-delete="101"]').click();document.querySelector('#delete-form button[value="delete"]').click()`);await waitFor(`!document.querySelector('tr[data-id="101"]')`,'Real DELETE 204 failed');
  assert(requests.filter(entry=>entry.route==='/api/items/101/status').every(entry=>Object.keys(JSON.parse(entry.body)).join()==='status'),'Status payload deviates from contract');
  assert(requests.filter(entry=>entry.method==='POST' && entry.route.endsWith('/messages')).every(entry=>Object.keys(JSON.parse(entry.body)).join()==='text'),'Message payload deviates from contract');
  assert(requests.filter(entry=>entry.route.endsWith('/messages')).every(entry=>entry.cookie?.includes('neu_test_session')),'Credentials missing from messaging requests');
  await navigate('/pages/my-listings.html');await waitFor(`!document.querySelector('.header-actions .logout-button').hidden`,'Log Out missing');
  await evaluate(`document.querySelector('.header-actions .logout-button').click()`);await waitFor(`location.pathname==='/index.html'`,'Logout did not return Home');
  await command('Page.navigate',{url:base+'/pages/chat.html'});await waitFor(`location.pathname==='/pages/login.html'`,'Logged-out user could access Chat');
  assert(!errors.length,'JavaScript errors: '+errors.join('; '));
  console.log('PASS: Chat, messages across two accounts, ownership, persistence, listing filters/status/edit/delete, migration, all 11 pages at 320/390/768/801/1024/1440px; REAL API contracts, errors, polling/visibility/navigation and stale-response guards; no console errors.');
  console.log('Screenshots: '+screenshots);
} finally {
  ws?.close();browser?.kill();await new Promise(resolve=>server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
