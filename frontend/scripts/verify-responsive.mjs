// Reproducible v1.1 layout/interaction audit in isolated mock storage.
// Real FastAPI/SQLite behavior is covered separately by verify-fullstack.mjs.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = process.env.SCREENSHOTS_DIR || path.resolve(root, '../docs/screenshots/v1.1');
const chrome = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : 'google-chrome');
const profile = await mkdtemp(path.join(tmpdir(), 'neu-responsive-'));
const widths = [320,375,430,768,1366,1920];
const pending = new Map(), errors = [], checks = [];
let browser, ws, session, base, nextId = 0;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(value, message) { if (!value) throw Error(message); }
const server = createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    let content = await readFile(file);
    if (file.replaceAll('\\','/').endsWith('/js/api.js')) content = Buffer.from(content.toString().replace(/^export const API_MODE = .*;$/m, "export const API_MODE = 'mock';"));
    res.writeHead(200, {'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
function command(method, params = {}, target = session) {
  const id = ++nextId;
  return new Promise((resolve,reject) => {
    pending.set(id,{resolve,reject});
    ws.send(JSON.stringify({id,method,params,...(target ? {sessionId:target} : {})}));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression) {
  for(let attempt=0;attempt<100;attempt++) { if(await evaluate(expression)) return; await wait(75); }
  throw Error(`Timed out: ${expression}`);
}
async function navigate(route, ready) {
  await command('Page.navigate',{url:base+route});
  await until(`location.pathname === ${JSON.stringify(route.split('?')[0])} && document.readyState === 'complete' && !!document.querySelector('.brand') && (${ready})`);
  await until(`[...document.images].every(image => image.complete && image.naturalWidth > 0)`);
  await evaluate('document.fonts.ready');
}
async function api(expression) { return evaluate(`(async()=>{const api=await import('/js/api.js');${expression}})()`); }
async function tap(selector) {
  const point = await evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);return {x,y,reachable:hit===el||el.contains(hit)};})()`);
  assert(point.reachable, `Control is covered: ${selector}`);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
}
async function key(key, code, virtualKey) {
  await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtualKey,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
  await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtualKey});
}
// Run in the browser so DOM geometry, wrapping and CSS visibility are checked.
function inspectLayout() {
  const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const label = el => el.id || el.className || el.tagName;
  const problems = [];
  if(document.documentElement.scrollWidth > innerWidth) problems.push('Horizontal page overflow');
  for(const selector of ['.header-inner','.form-actions','.toolbar-actions','.detail-actions','.thread-heading','.message-form','.quantity-picker']) {
    for(const group of document.querySelectorAll(selector)) {
      const children = [...group.children].filter(visible);
      for(let i=0;i<children.length;i++) {
        const a = children[i].getBoundingClientRect();
        if(a.left < -1 || a.right > innerWidth+1) problems.push(`Outside viewport: ${label(children[i])}`);
        for(let j=i+1;j<children.length;j++) {
          const b = children[j].getBoundingClientRect();
          if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1) problems.push(`Overlapping controls: ${label(children[i])} / ${label(children[j])}`);
        }
      }
    }
  }
  for(const el of document.querySelectorAll('button,.button')) {
    if(visible(el) && el.scrollWidth > el.clientWidth+2) problems.push(`Clipped button text: ${label(el)}`);
  }
  if(innerWidth<=800) {
    for(const el of document.querySelectorAll('.mobile-menu-button,.account-link,.favorite-button,.remove-image,.filter-option,.password-toggle,.form-actions .button,#back-conversations,#message-form button')) {
      if(visible(el)) {
        const r=el.getBoundingClientRect();
        if(r.height<43.5 || r.width<43.5) problems.push(`Small touch target: ${label(el)}`);
      }
    }
  }
  for(const field of document.querySelectorAll('.form-field')) {
    const name = field.querySelector(':scope > label');
    const control = field.querySelector(':scope > input:not(.sr-only),:scope > select,:scope > textarea,:scope > .password-input');
    if(name && control && visible(name) && visible(control) && name.getBoundingClientRect().bottom > control.getBoundingClientRect().top+1) problems.push(`Overlapping field label: ${label(control)}`);
  }
  return problems;
}
async function audit(name,width) {
  const problems = await evaluate(`(${inspectLayout.toString()})()`);
  assert(!problems.length, `${name} at ${width}px: ${problems.join('; ')}`);
  checks.push({page:name,width,result:'PASS'});
}
async function screenshot(name,width) {
  if(![320,768,1366].includes(width)) return;
  await evaluate('scrollTo(0,0)');
  const {cssContentSize} = await command('Page.getLayoutMetrics');
  const result = await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.ceil(cssContentSize.height),scale:1}});
  await writeFile(path.join(evidence,`${name}-${width}.png`),Buffer.from(result.data,'base64'));
}

try {
  await mkdir(evidence,{recursive:true});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  base = `http://127.0.0.1:${server.address().port}`;
  browser = spawn(chrome,['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  const socket = await new Promise((resolve,reject)=>{
    let log='';browser.once('error',reject);browser.once('exit',code=>reject(Error(`Chrome exited: ${code}`)));
    browser.stderr.on('data',chunk=>{log+=chunk;const match=log.match(/DevTools listening on (ws:\/\/\S+)/);if(match)resolve(match[1]);});
  });
  ws = new WebSocket(socket);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.method==='Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if(message.method==='Runtime.consoleAPICalled' && message.params.type==='error') errors.push(message.params.args.map(a=>a.value||a.description).join(' '));
    if(pending.has(message.id)) {const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}
  });
  const {targetId}=await command('Target.createTarget',{url:'about:blank'});
  ({sessionId:session}=await command('Target.attachToTarget',{targetId,flatten:true}));
  await command('Page.enable');await command('Runtime.enable');await command('Page.bringToFront');
  await command('Page.addScriptToEvaluateOnNewDocument',{source:"sessionStorage.setItem('neu-marketplace-demo-user-id','2')"});
  await navigate('/pages/login.html','!!document.getElementById("page-form")');
  const fixture = await api(`
    const noImage=await api.createItem({title:'Stationery Bundle',category:'other',quantity:3,price:100000,condition:'good',description:'Pens and notebooks.',location:'NEU Library'});
    const original=await api.getItem(101);
    await api.updateItem(101,{...original,image_urls:[...original.image_urls,'assets/karate.svg','assets/lamp.svg']});
    sessionStorage.setItem('neu-marketplace-demo-user-id','1');
    const conversation=await api.openConversation(noImage.id);
    await api.sendMessage(conversation.id,'Could we meet at the library?');
    sessionStorage.setItem('neu-marketplace-demo-user-id','2');
    await api.sendMessage(conversation.id,'Yes, after class. '+ 'A'.repeat(100));
    return {item:noImage.id,conversation:conversation.id};
  `);
  const formReady = '!document.getElementById("page-form").hidden';
  const detailReady = '!document.getElementById("detail-content").hidden';
  const pages = [
    ['home','/index.html','document.querySelectorAll(".product-card").length>0'],
    ['browse','/pages/browse.html','document.querySelectorAll(".product-card").length>0'],
    ['search','/pages/search.html?q=textbook','document.querySelectorAll(".product-card").length>0'],
    ['detail','/pages/product-detail.html?id=101',detailReady],
    ['no-image',`/pages/product-detail.html?id=${fixture.item}`,detailReady],
    ['login','/pages/login.html',formReady],
    ['register','/pages/register.html',formReady],
    ['create','/pages/create-listing.html',formReady],
    ['edit','/pages/edit-listing.html?id=101',formReady],
    ['edit-no-image',`/pages/edit-listing.html?id=${fixture.item}`,formReady],
    ['profile','/pages/profile.html?id=2','!document.getElementById("profile-content").hidden'],
    ['my-listings','/pages/my-listings.html','document.querySelectorAll("#listing-rows tr").length>0'],
    ['chat',`/pages/chat.html?conversationId=${fixture.conversation}`,'document.querySelectorAll(".message").length===2 && !document.getElementById("message-input").disabled'],
    ['sold','/pages/product-detail.html?id=113',detailReady],
  ];
  for(const width of widths) {
    await command('Emulation.setDeviceMetricsOverride',{width,height:width<800?844:1100,deviceScaleFactor:1,mobile:width<800});
    for(const [name,route,ready] of pages) {
      await navigate(route,ready);
      await audit(name,width);
      if(name==='home' && width<=768) {
        await tap('.mobile-menu-button');
        assert(await evaluate('document.getElementById("mobile-nav").classList.contains("open")'),'Mobile menu did not open');
        await audit('navigation-open',width);await screenshot('navigation-open',width);
        await key('Escape','Escape',27);
        assert(await evaluate('document.activeElement===document.querySelector(".mobile-menu-button") && !document.getElementById("mobile-nav").classList.contains("open")'),'Escape/focus failed');
      }
      if(name==='browse' || name==='search') {
        if(width<=768) {
          await evaluate('document.querySelector(".filter-disclosure summary").focus()');
          await key('Enter','Enter',13);
          await until('document.querySelector(".filter-disclosure").open');
        }
        assert(await evaluate('document.querySelector(".filter-disclosure").open'),'Filters inaccessible');
        await audit(`${name}-filters-open`,width);await screenshot(`${name}-filters-open`,width);
        await tap('.filter-option:has(input[name="condition"][value="good"])');
        await until('new URLSearchParams(location.search).get("condition")==="good" && !document.getElementById("catalog-status").textContent.includes("Loading")');
        await audit(`${name}-filtered`,width);
      }
      if(name==='detail') {
        await tap('.thumbnail-button:nth-child(2)');
        assert(await evaluate('document.querySelector(".thumbnail-button:nth-child(2)").getAttribute("aria-pressed")==="true"'),'Gallery selection failed');
      }
      if(name==='no-image') {
        assert(await evaluate('document.getElementById("main-product-image").src.endsWith("placeholder.svg")'),'Placeholder missing');
        await evaluate('document.getElementById("selected-quantity").value=2;document.getElementById("selected-quantity").dispatchEvent(new Event("input",{bubbles:true}))');
        assert(await evaluate('document.getElementById("selected-price").textContent.includes("66,667")'),'Quantity price failed');
        assert(await evaluate('document.getElementById("quantity-hint").textContent.includes("does not place an order")'),'Quantity guidance missing');
      }
      if(name==='create' || name==='edit' || name==='edit-no-image') {
        assert(await evaluate('document.getElementById("images-hint").textContent.includes("add them later")'),'Later-image guidance missing');
      }
      if(name==='chat') {
        const composer = await evaluate('(() => {const box=document.getElementById("chat-layout").getBoundingClientRect(),input=document.getElementById("message-input").getBoundingClientRect();return input.top>=box.top && input.bottom<=box.bottom;})()');
        assert(composer,`Chat composer clipped at ${width}px`);
        if(width<=430) {
          await tap('#back-conversations');
          assert(await evaluate('!document.getElementById("chat-layout").classList.contains("has-active")'),'Chat Back failed');
          await audit('chat-conversations',width);await screenshot('chat-conversations',width);
          await tap('.conversation-button');
          await until('!document.getElementById("message-input").disabled');
        }
      }
      if(name==='sold') assert(await evaluate('document.querySelector(".quantity-picker").hidden && document.getElementById("chat-button").disabled'),'Sold controls enabled');
      await screenshot(name,width);
    }
    console.log(`PASS responsive ${width}px: pages, open filters/menu, gallery, quantity, forms and populated chat`);
  }
  assert(!errors.length,'Browser errors: '+errors.join('; '));
  await writeFile(path.join(evidence,'responsive-results.json'),JSON.stringify({mode:'mock',widths,checks,browserErrors:errors},null,2)+'\n');
  console.log(`PASS ${checks.length} layout states; screenshots and results: ${evidence}`);
} finally {
  ws?.close();
  if(browser && browser.pid && browser.exitCode===null) {const exited=new Promise(resolve=>browser.once('exit',resolve));browser.kill();await exited;}
  await new Promise(resolve=>server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
