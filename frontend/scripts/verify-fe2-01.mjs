import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockItems } from '../js/mock-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const screenshots = process.env.SCREENSHOTS_DIR || path.resolve(root,'../docs/screenshots/fe2-01');
const chrome = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : 'google-chrome');
const profile = await mkdtemp(path.join(tmpdir(),'neu-fe2-01-'));
const requests = [], exceptions = [];
let realMode = false, failRoute = '', browser, ws, base, sessionId, nextId = 0;
const pending = new Map();
const realItems = new Map(mockItems.map(item => [item.id,item]));
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
function assert(ok,message) { if (!ok) throw new Error(message); }
function json(response,status,body) { response.writeHead(status,{'Content-Type':'application/json'}); response.end(JSON.stringify(body)); }
const server = createServer(async (request,response) => {
  try {
    const url = new URL(request.url,base);
    response.setHeader('Cache-Control','no-store');
    if (url.pathname.startsWith('/api/')) {
      let body = '';
      for await (const chunk of request) body += chunk;
      requests.push({route:url.pathname,method:request.method,body,headers:request.headers});
      if (url.pathname === failRoute) { failRoute = ''; return json(response,503,{detail:'Service unavailable. Please try again.'}); }
      if (url.pathname === '/api/auth/login') { response.setHeader('Set-Cookie','neu_test_session=1; HttpOnly; SameSite=Lax; Path=/'); return json(response,200,{id:2,display_name:'Ha Linh Tran'}); }
      if (url.pathname === '/api/auth/register') return json(response,201,{id:10,display_name:'Test Student'});
      if (url.pathname === '/api/auth/me') return json(response,request.headers.cookie ? 200 : 401,{id:2,display_name:'Ha Linh Tran'});
      if (url.pathname === '/api/uploads') return json(response,200,{image_url:'/assets/textbook.svg'});
      if (url.pathname === '/api/items' && request.method === 'POST') {
        const item = {...JSON.parse(body),id:200,seller_id:2,status:'available',created_at:new Date().toISOString()};
        realItems.set(200,item); return json(response,201,item);
      }
      const id = Number(url.pathname.split('/').pop());
      if (url.pathname.startsWith('/api/items/')) {
        if (request.method === 'PATCH') realItems.set(id,{...realItems.get(id),...JSON.parse(body)});
        return json(response,200,realItems.get(id));
      }
      if (url.pathname.startsWith('/api/users/')) return json(response,200,{id,display_name:'Ha Linh Tran'});
      return json(response,404,{detail:'Not found'});
    }
    const target = path.resolve(root,`.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
    if (!target.startsWith(root + path.sep)) { response.writeHead(403); return response.end(); }
    let body = await readFile(target);
    if (target.endsWith('/js/api.js')) body = Buffer.from(body.toString().replace(/^export const API_MODE = .*;$/m,`export const API_MODE = '${realMode ? 'real' : 'mock'}';`).replace(/^export const API_BASE_URL = .*;$/m,`export const API_BASE_URL = '${base}/api';`));
    response.writeHead(200,{'Content-Type':mime[path.extname(target)] || 'application/octet-stream'});
    response.end(body);
  } catch { response.writeHead(404); response.end('Not found'); }
});
function command(method,params = {},session = sessionId) {
  const id = ++nextId;
  return new Promise((resolve,reject) => {
    pending.set(id,{resolve,reject});
    ws.send(JSON.stringify({id,method,params,...(session ? {sessionId:session} : {})}));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression,message) {
  for (let i=0;i<80;i++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve,75));
  }
  throw new Error(message);
}
async function navigate(route,width = 1440) {
  await command('Emulation.setDeviceMetricsOverride',{width,height:width < 700 ? 844 : 1100,deviceScaleFactor:1,mobile:width < 700});
  await command('Page.navigate',{url:`${base}${route}`});
  await waitFor(`location.href === ${JSON.stringify(base + route)} && document.readyState === 'complete' && !!document.querySelector('.site-header .brand')`,'Navigation failed: ' + route);
}
async function fill(values) {
  await evaluate(`(() => { const f=document.getElementById('page-form'); for (const [name,value] of Object.entries(${JSON.stringify(values)})) f.elements[name].value=value; })()`);
}
async function submit() { await evaluate(`document.getElementById('page-form').requestSubmit()`); }
async function signedIn(id) { await evaluate(`sessionStorage.${id ? `setItem('neu-marketplace-demo-user-id','${id}')` : "removeItem('neu-marketplace-demo-user-id')"}`); }
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG5kAAAAASUVORK5CYII=';
async function selectImages(count = 1,type = 'image/png',size = 0,valid = true) {
  await evaluate(`(() => {
    const bytes=Uint8Array.from(atob('${png}'),c=>c.charCodeAt(0)); const transfer=new DataTransfer();
    for(let i=0;i<${count};i++) transfer.items.add(new File([${size ? `new Uint8Array(${size})` : valid ? 'bytes' : "'not an image'"}], 'image-'+i+'.png',{type:'${type}'}));
    const input=document.getElementById('images'); input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
}
const values = {title:'Campus test textbook',category:'textbooks',price:'45000',condition:'good',description:'A clean second-hand book.',location:'NEU - Zone A'};
async function loginAs(email = 'seller@example.com',password = 'MarketplaceDemo1!') { await fill({email,password}); await submit(); }

try {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = spawn(chrome,['--headless','--disable-gpu','--no-sandbox','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank']);
  const devtools = await new Promise((resolve,reject) => {
    let output = '';
    browser.on('error',reject);
    browser.on('exit',code => reject(new Error(`Chrome exited: ${code}`)));
    browser.stderr.on('data',chunk => { output += chunk; const match=output.match(/DevTools listening on (ws:\/\/\S+)/); if(match) resolve(match[1]); });
  });
  ws = new WebSocket(devtools);
  await new Promise((resolve,reject) => { ws.addEventListener('open',resolve,{once:true}); ws.addEventListener('error',reject,{once:true}); });
  ws.addEventListener('message',event => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.exceptionThrown') exceptions.push(data.params.exceptionDetails.text);
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') exceptions.push(JSON.stringify(data.params.args));
    if (pending.has(data.id)) { const task=pending.get(data.id); pending.delete(data.id); data.error ? task.reject(new Error(data.error.message)) : task.resolve(data.result); }
  });
  const target = await command('Target.createTarget',{url:'about:blank'});
  ({sessionId} = await command('Target.attachToTarget',{targetId:target.targetId,flatten:true}));
  await command('Page.enable'); await command('Runtime.enable');
  await mkdir(screenshots,{recursive:true});
  await navigate('/pages/login.html'); await signedIn(2);
  for (const name of ['login','register','create-listing','edit-listing']) {
    for (const width of [1440,390,320,768]) {
      await navigate(`/pages/${name}.html${name === 'edit-listing' ? '?id=101' : ''}`,width);
      await waitFor(`!document.getElementById('page-form').hidden`,'Form did not load: ' + name);
      assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'),`${name} overflows ${width}px`);
      if (width === 1440 || width === 390) {
        const {cssContentSize} = await command('Page.getLayoutMetrics');
        const result = await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:cssContentSize.height,scale:1}});
        await writeFile(path.join(screenshots,`${name}-${width === 1440 ? 'desktop' : 'mobile'}.png`),Buffer.from(result.data,'base64'));
      }
    }
  }
  await signedIn(null);
  for (const route of ['/pages/create-listing.html','/pages/edit-listing.html?id=101']) {
    await command('Page.navigate',{url:base + route});
    await waitFor(`location.pathname === '/pages/login.html' && document.getElementById('page-form') && new URLSearchParams(location.search).get('returnTo') === '${route}'`,'Guest guard failed');
  }
  await navigate('/pages/register.html?returnTo=%2Fpages%2Fcreate-listing.html');
  await submit();
  assert(await evaluate(`['email','password','display_name','confirm_password'].every(name => document.getElementById(name+'-error').textContent)`),'Required field errors missing');
  await fill({display_name:'Test Student',email:'invalid',password:'123',confirm_password:'different'}); await submit();
  assert(await evaluate(`document.getElementById('email-error').textContent && document.getElementById('password-error').textContent && document.getElementById('confirm_password-error').textContent`),'Invalid registration was accepted');
  await evaluate(`document.querySelector('.password-toggle').click()`);
  assert(await evaluate(`document.getElementById('password').type === 'text'`),'Password toggle failed');
  await evaluate(`document.querySelector('.password-toggle').click()`);
  assert(await evaluate(`document.getElementById('password').type === 'password'`),'Password hide failed');
  await fill({display_name:'Test Student',email:'student@example.com',password:'StudentDemo123!',confirm_password:'StudentDemo123!'}); await submit();
  await waitFor(`location.pathname === '/pages/login.html' && document.getElementById('form-message')?.textContent.includes('Account created')`,'Registration success failed');
  assert(await evaluate(`!localStorage.getItem('neu-marketplace-demo-accounts-v1').includes('StudentDemo123!')`),'Plaintext password persisted');
  await loginAs('student@example.com','wrong');
  await waitFor(`document.getElementById('form-message').textContent.includes('Incorrect')`,'Invalid login error missing');
  await loginAs('student@example.com','StudentDemo123!');
  await waitFor(`location.pathname === '/pages/create-listing.html' && document.getElementById('page-form')?.hidden === false`,'Login lost intended destination');
  assert(await evaluate(`(async()=>!(await(await import('/js/api.js')).getUser(10)).password_hash)()`),'Public profile leaked hash');
  await signedIn(null);
  await navigate('/pages/register.html');
  await fill({display_name:'Test Student',email:'student@example.com',password:'StudentDemo123!',confirm_password:'StudentDemo123!'}); await submit();
  await waitFor(`document.getElementById('form-message').textContent.includes('already exists')`,'Duplicate account error missing');
  for (const returnTo of ['https://example.com/','//example.com/','javascript:alert(1)','/pages/login.html','/pages/register.html','/\\example.com/']) {
    await navigate('/pages/login.html?returnTo=' + encodeURIComponent(returnTo));
    await loginAs();
    await waitFor(`location.pathname === '/index.html' && !!document.getElementById('recent-grid')`,'Unsafe redirect accepted: ' + returnTo);
    await signedIn(null);
  }
  await signedIn(1);
  await command('Page.navigate',{url:base + '/pages/edit-listing.html?id=101'});
  await waitFor(`location.pathname === '/pages/product-detail.html' && document.getElementById('product-title')?.textContent`,'Non-owner guard failed');
  await signedIn(2);
  await navigate('/pages/edit-listing.html?id=999');
  await waitFor(`!document.getElementById('page-error').hidden`,'Missing listing error missing');
  await navigate('/pages/create-listing.html');
  await waitFor(`!document.getElementById('page-form').hidden`,'Create form missing');
  await fill(values); await submit();
  assert(await evaluate(`document.getElementById('images-error').textContent`),'Missing images accepted');
  for (const args of [[6],[1,'image/gif'],[1,'image/png',5*1024*1024+1],[1,'image/png',0,false]]) {
    await selectImages(...args);
    await waitFor(`document.getElementById('images-error').textContent.length > 0 && !document.querySelector('#image-previews img')`,'Invalid images accepted');
  }
  await selectImages(5);
  await waitFor(`document.querySelectorAll('#image-previews img').length === 5`,'Five-image preview failed');
  await selectImages();
  assert(await evaluate(`document.getElementById('images-error').textContent.includes('at most 5')`),'Sixth image accepted');
  await evaluate(`(() => { for(let i=0;i<4;i++) document.querySelector('.remove-image').click(); })()`);
  assert(await evaluate(`document.querySelectorAll('#image-previews img').length === 1`),'Image removal failed');
  for (const price of ['-1','1.5']) {
    await fill({price}); await submit();
    assert(await evaluate(`document.getElementById('price-error').textContent`),'Invalid VND amount accepted');
  }
  await fill({price:'45000'}); await submit();
  await waitFor(`!document.getElementById('listing-success').hidden`,'Create failed');
  const createdPath = await evaluate(`new URL(document.getElementById('view-listing').href).pathname + new URL(document.getElementById('view-listing').href).search`);
  const createdId = Number(new URL(createdPath,base).searchParams.get('id'));
  await navigate(createdPath);
  await waitFor(`document.getElementById('product-title')?.textContent === '${values.title}' && document.getElementById('main-product-image').naturalWidth > 0`,'Created detail/image missing');
  await navigate(createdPath);
  await waitFor(`document.getElementById('main-product-image').naturalWidth > 0`,'Uploaded image did not survive reload');
  await navigate('/pages/browse.html');
  await waitFor(`document.getElementById('product-grid').textContent.includes('${values.title}')`,'Created listing absent from FE1 Browse');
  await navigate(`/pages/edit-listing.html?id=${createdId}`);
  await waitFor(`document.getElementById('title').value === '${values.title}'`,'Edit did not prefill');
  assert(await evaluate(`document.getElementById('cancel-link').getAttribute('href') === 'product-detail.html?id=${createdId}'`),'Edit Cancel points to the wrong page');
  await fill({title:'Updated campus textbook',price:'50000'});
  await evaluate(`document.querySelector('.remove-image').click()`); await selectImages();
  await waitFor(`document.querySelectorAll('#image-previews img').length === 1`,'Replacement image missing');
  await submit(); await waitFor(`!document.getElementById('listing-success').hidden`,'Edit save failed');
  await navigate(createdPath);
  await waitFor(`document.getElementById('product-title').textContent === 'Updated campus textbook' && document.getElementById('product-price').textContent === '50,000 VND'`,'Edited data did not persist');
  await signedIn(1);
  assert(await evaluate(`(async()=>{try {await(await import('/js/api.js')).updateItem(${createdId},${JSON.stringify({...values,price:45000,image_urls:['assets/textbook.svg']})}); return false;}catch(e){return e.message.includes('own listings');}})()`),'Mock API allowed non-owner edit');

  // Exercise REAL mode through a local HTTP API, including cookies, errors and retries.
  realMode = true;
  await navigate('/pages/login.html?returnTo=%2Fpages%2Fcreate-listing.html');
  failRoute = '/api/auth/login'; await loginAs();
  await waitFor(`document.getElementById('form-message').textContent.includes('Service unavailable')`,'Login API error missing');
  await loginAs();
  await waitFor(`location.pathname === '/pages/create-listing.html' && document.getElementById('page-form')?.hidden === false`,'Real cookie login failed');
  await fill(values); await selectImages();
  await waitFor(`document.querySelectorAll('#image-previews img').length === 1`,'Real preview missing');
  failRoute = '/api/uploads'; await submit();
  await waitFor(`document.getElementById('form-message').textContent.includes('Service unavailable') && !document.querySelector('[type=submit]').disabled`,'Upload error/retry missing');
  failRoute = '/api/items'; await submit();
  await waitFor(`document.getElementById('form-message').textContent.includes('Service unavailable') && !document.querySelector('[type=submit]').disabled`,'Create API error missing');
  await submit(); await waitFor(`!document.getElementById('listing-success').hidden`,'Real create retry failed');
  assert(requests.filter(req => req.route === '/api/uploads').length === 2,'Retry uploaded an already successful image again');
  await navigate('/pages/edit-listing.html?id=200');
  await waitFor(`document.getElementById('title').value === '${values.title}'`,'Real edit prefill failed');
  await fill({title:'Real edited textbook'}); failRoute = '/api/items/200'; await submit();
  await waitFor(`document.getElementById('form-message').textContent.includes('Service unavailable')`,'Edit API error missing');
  await submit(); await waitFor(`!document.getElementById('listing-success').hidden`,'Real edit retry failed');
  await navigate('/pages/register.html');
  await fill({display_name:'Test Student',email:'new@example.com',password:'StudentDemo123!',confirm_password:'StudentDemo123!'});
  failRoute = '/api/auth/register'; await submit();
  await waitFor(`document.getElementById('form-message').textContent.includes('Service unavailable')`,'Registration API error missing');
  await submit(); await waitFor(`location.pathname === '/pages/login.html' && document.getElementById('form-message')?.textContent.includes('Account created')`,'Real register success failed');
  await navigate('/pages/create-listing.html');
  await waitFor(`!document.getElementById('page-form').hidden`,'Authenticated create form missing');
  await fill(values); await selectImages();
  await waitFor(`document.querySelectorAll('#image-previews img').length === 1`,'Image missing before session-expiry test');
  await command('Network.clearBrowserCookies'); await submit();
  await waitFor(`location.pathname === '/pages/login.html' && new URLSearchParams(location.search).get('returnTo') === '/pages/create-listing.html'`,'Expired session did not return to Login');
  const posted = JSON.parse(requests.find(req => req.route === '/api/items' && req.method === 'POST').body);
  assert(Number.isInteger(posted.price) && !('seller_id' in posted) && posted.image_urls.length === 1,'Listing payload deviates from contract');
  assert(requests.some(req => req.route === '/api/uploads' && req.headers['content-type'].includes('multipart/form-data') && req.body.includes('name="file"')),'Upload payload deviates from contract');
  assert(requests.some(req => req.route === '/api/items' && req.headers.cookie?.includes('neu_test_session=1')),'Authenticated cookie missing');
  assert(!requests.filter(req => req.route === '/api/auth/register').some(req => 'confirm_password' in JSON.parse(req.body)),'Confirmation sent to backend');
  assert(exceptions.length === 0,'Browser errors: ' + exceptions.join('; '));
  console.log('PASS: four pages at 320/390/768/1440px; auth validation, password toggle, safe returnTo, owner guards, image limits/removal, create/edit persistence and FE1 integration; REAL-mode cookies, contract payloads and error/retry states; no JavaScript console errors.');
  console.log('Screenshots: ' + screenshots);
} finally {
  ws?.close(); browser?.kill();
  await new Promise(resolve => server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
