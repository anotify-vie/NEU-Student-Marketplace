// Actual FastAPI + SQLite + browser integration. No npm dependencies.
// PYTHON must point to an interpreter with backend/requirements.txt installed.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporary = await mkdtemp(path.join(tmpdir(), 'neu-fullstack-'));
const python = process.env.PYTHON || path.join(root, 'backend/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const chrome = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/chromium');
const pending = new Map(), exceptions = [], requests = [];
let apiPort, backend, browser, ws, nextId = 0, failure, holdNextListing = false, heldListing;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(ok, message) { if (!ok) throw Error(message); }
function command(method, params = {}, sessionId) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
  });
}
async function evaluate(session, expression) {
  const result = await command('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true}, session);
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(session, expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(session, expression)) return;
    await wait(100);
  }
  throw Error(`Timed out: ${expression}\n` + JSON.stringify(await evaluate(session, `({url:location.href,text:document.body.innerText.slice(-2500)})`)));
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(root, 'frontend', '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(path.join(root, 'frontend') + path.sep)) { res.writeHead(403).end(); return; }
    let data = await readFile(file);
    // Keep production mode selection; only change the ephemeral backend port.
    if (file.replaceAll('\\','/').endsWith('/js/api.js')) data = Buffer.from(data.toString().replace(':8000/api', `:${apiPort}/api`));
    res.writeHead(200, {'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
async function tab(base) {
  const {browserContextId} = await command('Target.createBrowserContext');
  const {targetId} = await command('Target.createTarget', {url:'about:blank', browserContextId});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten:true});
  await command('Page.enable', {}, sessionId);
  await command('Runtime.enable', {}, sessionId);
  await command('Network.enable', {}, sessionId);
  await command('Fetch.enable', {patterns:[{urlPattern:'*/api/*', requestStage:'Request'}]}, sessionId);
  return {session:sessionId, base};
}
async function navigate(t, route) {
  await command('Page.navigate', {url:t.base + route}, t.session);
  await until(t.session, `location.href.startsWith(${JSON.stringify(t.base)}) && document.readyState === 'complete' && !!document.querySelector('.brand')`);
}
async function submit(t, values) {
  await evaluate(t.session, `(() => { const form=document.querySelector('form#page-form,form#profile-form'); for(const [key,value] of Object.entries(${JSON.stringify(values)})) form.elements[key].value=value; form.requestSubmit(); })()`);
}
async function account(t, email, name, returnTo = '/index.html') {
  await navigate(t, `/pages/register.html?returnTo=${encodeURIComponent(returnTo)}`);
  await submit(t, {display_name:name, email, password:'Secret123!', confirm_password:'Secret123!'});
  await until(t.session, `location.pathname === '/pages/login.html' && document.getElementById('form-message')?.textContent.includes('Account created')`);
  await submit(t, {email, password:'WrongPassword'});
  await until(t.session, `document.getElementById('form-message')?.textContent.includes('Incorrect email or password')`);
  await submit(t, {email, password:'Secret123!'});
  await until(t.session, `location.pathname === ${JSON.stringify(returnTo.split('?')[0])} && document.readyState === 'complete'`);
}
async function api(t, expression) {
  return evaluate(t.session, `(async () => { const api=await import('/js/api.js'); ${expression} })()`);
}

try {
  const port = await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, () => resolve(server.address().port)); });
  // Reserve a free port, then hand it to Uvicorn.
  const reservation = createServer();
  apiPort = await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', () => resolve(reservation.address().port)); });
  await new Promise(resolve => reservation.close(resolve));
  let backendLogs = '';
  backend = spawn(python, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(apiPort)], {
    cwd:path.join(root, 'backend'), env:{...process.env, MARKETPLACE_DB_PATH:path.join(temporary, 'test.db'), MARKETPLACE_UPLOADS_DIR:path.join(temporary, 'uploads'), CORS_ORIGINS:`http://127.0.0.1:${port},http://localhost:${port}`}, stdio:['ignore','pipe','pipe'],
  });
  backend.on('error', error => { backendLogs += error.message; });
  backend.stdout.on('data', data => { backendLogs += data; }); backend.stderr.on('data', data => { backendLogs += data; });
  let healthy = false;
  for (let i = 0; i < 60; i++) {
    healthy = await fetch(`http://127.0.0.1:${apiPort}/api/health`).then(r => r.ok).catch(() => false);
    if (healthy) break;
    await wait(100);
  }
  assert(healthy, 'Backend failed to start: ' + backendLogs);
  const blocked = await fetch(`http://127.0.0.1:${apiPort}/api/items`, {headers:{Origin:'http://untrusted.example'}});
  assert(!blocked.headers.has('access-control-allow-origin'), 'CORS allowed an unlisted origin');
  browser = spawn(chrome, ['--headless','--no-sandbox','--disable-gpu','--no-proxy-server','--remote-debugging-port=0', `--user-data-dir=${path.join(temporary, 'chrome')}`, 'about:blank'], {stdio:['ignore','ignore','pipe']});
  browser.on('error', error => { throw error; });
  let output = '', socketUrl;
  for await (const chunk of browser.stderr) {
    output += chunk; socketUrl = output.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
    if (socketUrl) break;
  }
  assert(socketUrl, 'Chrome failed to start: ' + output);
  ws = new WebSocket(socketUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, {once:true}));
  ws.addEventListener('message', async event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id); pending.delete(message.id);
      message.error ? task.reject(Error(message.error.message)) : task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (message.method === 'Fetch.requestPaused') {
      const {requestId, request} = message.params, url = new URL(request.url);
      requests.push({url, method:request.method, session:message.sessionId});
      if (failure?.(url, request)) {
        failure = null;
        await command('Fetch.fulfillRequest', {requestId, responseCode:503, responseHeaders:[{name:'Content-Type', value:'application/json'},{name:'Access-Control-Allow-Origin', value:request.headers.Origin || request.headers.origin},{name:'Access-Control-Allow-Credentials', value:'true'}], body:Buffer.from(JSON.stringify({detail:'Service unavailable. Please try again.'})).toString('base64')}, message.sessionId);
      } else if (holdNextListing && url.pathname === '/api/items' && request.method === 'GET') {
        holdNextListing = false;
        heldListing = {requestId, session:message.sessionId};
      } else await command('Fetch.continueRequest', {requestId}, message.sessionId).catch(() => {});
    }
  });
  const seller = await tab(`http://127.0.0.1:${port}`), buyer = await tab(`http://127.0.0.1:${port}`);
  await navigate(seller, '/pages/browse.html');
  await until(seller.session, `!document.getElementById('empty-state').hidden`);
  await navigate(seller, '/pages/create-listing.html');
  await until(seller.session, `location.pathname === '/pages/login.html' && new URLSearchParams(location.search).get('returnTo') === '/pages/create-listing.html'`);
  await account(seller, 'seller@example.com', 'Test Seller', '/pages/create-listing.html');
  await until(seller.session, `document.getElementById('page-form') && !document.getElementById('page-form').hidden`);
  await submit(seller, {});
  assert(await evaluate(seller.session, `document.getElementById('title-error').textContent.length > 0`), 'Listing validation missing');
  await evaluate(seller.session, `(() => { const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;const raw=atob(canvas.toDataURL('image/png').split(',')[1]);const file=new File([Uint8Array.from(raw,c=>c.charCodeAt(0))],'book.png',{type:'image/png'});const transfer=new DataTransfer();transfer.items.add(file);const input=document.getElementById('images');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await until(seller.session, `document.querySelectorAll('#image-previews img').length === 1`);
  await submit(seller, {title:'Integration Textbook',category:'textbooks',price:'45000',condition:'good',description:'A useful textbook.',location:'NEU Library'});
  await until(seller.session, `!document.getElementById('listing-success').hidden`);
  const listingId = await evaluate(seller.session, `Number(new URL(document.getElementById('view-listing').href).searchParams.get('id'))`);
  await navigate(seller, `/pages/product-detail.html?id=${listingId}`);
  await until(seller.session, `!document.getElementById('detail-content').hidden && document.getElementById('main-product-image').naturalWidth > 0`);
  assert(await evaluate(seller.session, `document.getElementById('chat-button').textContent === 'Your Listing'`), 'Owner could chat with self');
  await navigate(seller, `/pages/edit-listing.html?id=${listingId}`);
  await until(seller.session, `!document.getElementById('page-form').hidden`);
  await submit(seller, {title:'Updated Integration Textbook', price:'50000'});
  await until(seller.session, `!document.getElementById('listing-success').hidden`);
  const listing = await api(seller, `return api.getItem(${listingId});`);
  assert(listing.title === 'Updated Integration Textbook' && listing.price === 50000, 'Listing edit did not persist');
  assert(listing.quantity === 1, 'Default quantity should be 1');
  // v1.1 on the real backend: image-free listing, quantity pricing, later image, partial update, image removal
  const pickImage = `(() => { const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;const raw=atob(canvas.toDataURL('image/png').split(',')[1]);const file=new File([Uint8Array.from(raw,c=>c.charCodeAt(0))],'photo.png',{type:'image/png'});const transfer=new DataTransfer();transfer.items.add(file);const input=document.getElementById('images');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true})); })()`;
  const formReady = `!document.getElementById('page-form').hidden`;
  const savedOk = `!document.getElementById('listing-success').hidden`;
  const previews = count => `document.querySelectorAll('#image-previews img').length === ${count}`;
  await navigate(seller, '/pages/create-listing.html');
  await until(seller.session, formReady);
  await submit(seller, {title:'Stationery Bundle',category:'other',quantity:'3',price:'100000',condition:'good',description:'Pens and notebooks.',location:'NEU Library'});
  await until(seller.session, savedOk);
  const bundleId = await evaluate(seller.session, `Number(new URL(document.getElementById('view-listing').href).searchParams.get('id'))`);
  const bundle = await api(seller, `return api.getItem(${bundleId});`);
  assert(bundle.quantity === 3 && bundle.price === 100000 && bundle.image_urls.length === 0, 'Image-free listing with quantity was not saved');
  await navigate(seller, `/pages/product-detail.html?id=${bundleId}`);
  await until(seller.session, `!document.getElementById('detail-content').hidden && document.getElementById('main-product-image').src.endsWith('placeholder.svg') && document.getElementById('main-product-image').naturalWidth > 0`);
  for (const [quantity, expected] of [[1,'33,333 VND'],[2,'66,667 VND'],[3,'100,000 VND']]) {
    const text = await evaluate(seller.session, `(() => { const input=document.getElementById('selected-quantity'); input.value='${quantity}'; input.dispatchEvent(new Event('input',{bubbles:true})); return document.getElementById('selected-price').textContent; })()`);
    assert(text.includes(expected), `Real selected price for ${quantity} should be ${expected}`);
  }
  await navigate(seller, `/pages/edit-listing.html?id=${bundleId}`);
  await until(seller.session, `${formReady} && document.getElementById('quantity').value === '3'`);
  await evaluate(seller.session, pickImage);
  await until(seller.session, previews(1));
  await submit(seller, {});
  await until(seller.session, savedOk);
  const withImage = await api(seller, `return api.getItem(${bundleId});`);
  assert(withImage.image_urls.length === 1 && withImage.quantity === 3, 'Adding an image later failed');
  await navigate(seller, `/pages/edit-listing.html?id=${bundleId}`);
  await until(seller.session, `${formReady} && ${previews(1)}`);
  await submit(seller, {title:'Stationery Bundle Edited'});
  await until(seller.session, savedOk);
  const kept = await api(seller, `return api.getItem(${bundleId});`);
  assert(kept.title === 'Stationery Bundle Edited' && JSON.stringify(kept.image_urls) === JSON.stringify(withImage.image_urls), 'Existing image changed when editing another field');
  const partial = await api(seller, `return api.updateItem(${bundleId},{title:'Stationery Bundle Partial',category:'other',price:100000,condition:'good',description:'Pens and notebooks.',location:'NEU Library'});`);
  assert(partial.quantity === 3 && JSON.stringify(partial.image_urls) === JSON.stringify(withImage.image_urls), 'Update without quantity/images changed them');
  await navigate(seller, `/pages/edit-listing.html?id=${bundleId}`);
  await until(seller.session, `${formReady} && ${previews(1)}`);
  await submit(seller, {quantity:'0'});
  assert(await evaluate(seller.session, `document.getElementById('quantity-error').textContent.length > 0`), 'Quantity 0 accepted');
  await evaluate(seller.session, `document.querySelector('.remove-image').click()`);
  await submit(seller, {quantity:'3'});
  await until(seller.session, savedOk);
  const removed = await api(seller, `return api.getItem(${bundleId});`);
  assert(removed.image_urls.length === 0 && removed.quantity === 3, 'Removing the image failed');
  await api(seller, `await api.deleteItem(${bundleId});`);
  const cookies = await command('Network.getCookies', {urls:[seller.base]}, seller.session);
  assert(cookies.cookies.some(cookie => cookie.name === 'session_token' && cookie.httpOnly && cookie.sameSite === 'Lax'), 'Session cookie attributes missing');
  assert(await evaluate(seller.session, `!document.cookie.includes('session_token')`), 'Session cookie exposed to JavaScript');
  console.log('PASS register/login, safe return, validation, real upload, create/edit, persisted image and HTTP-only cookies');

  await navigate(seller, '/pages/profile.html');
  await until(seller.session, `document.getElementById('stat-total').textContent === '1' && !document.getElementById('edit-profile-button').hidden`);
  await evaluate(seller.session, `document.getElementById('edit-profile-button').click()`);
  failure = (url, request) => url.pathname === '/api/users/me' && request.method === 'PATCH';
  await submit(seller, {display_name:'Updated Seller',faculty:'Economics',cohort:'',bio:'Hello NEU'});
  await until(seller.session, `document.getElementById('profile-message').textContent.includes('Service unavailable')`);
  assert(await evaluate(seller.session, `!document.getElementById('edit-panel').hidden && document.getElementById('profile-message').classList.contains('is-error')`), 'Failed profile save lost editor or error style');
  await submit(seller, {});
  await until(seller.session, `document.getElementById('profile-message').textContent === 'Profile updated successfully.'`);
  await navigate(seller, '/pages/profile.html');
  await until(seller.session, `document.getElementById('profile-name').textContent === 'Updated Seller'`);
  console.log('PASS real profile statistics, save error/retry, optional cohort, accurate success message and persistence');

  await account(buyer, 'buyer@example.com', 'Test Buyer');
  await navigate(buyer, '/pages/search.html?q=integration');
  await until(buyer.session, `document.querySelectorAll('.product-card').length === 1`);
  await navigate(buyer, `/pages/product-detail.html?id=${listingId}`);
  await until(buyer.session, `!document.getElementById('detail-content').hidden`);
  await evaluate(buyer.session, `document.getElementById('chat-button').click()`);
  await until(buyer.session, `location.pathname === '/pages/chat.html' && !document.getElementById('message-input')?.disabled`);
  const conversationId = await evaluate(buyer.session, `Number(new URLSearchParams(location.search).get('conversationId'))`);
  // The thread can still be reloading right after the composer enables, so retry the empty submit until validation shows.
  await until(buyer.session, `(document.getElementById('message-form').requestSubmit(), document.getElementById('message-error').textContent.includes('Enter a message'))`);
  await evaluate(buyer.session, `document.getElementById('message-input').value='Is this available?';document.getElementById('message-form').requestSubmit()`);
  await until(buyer.session, `document.querySelector('.message')?.textContent.includes('Is this available?')`);
  await navigate(seller, `/pages/chat.html?conversationId=${conversationId}`);
  await until(seller.session, `document.querySelector('.message')?.textContent.includes('Is this available?') && !document.getElementById('message-input').disabled`);
  await evaluate(seller.session, `document.getElementById('message-input').value='Yes, meet at NEU.';document.getElementById('message-form').requestSubmit()`);
  await until(buyer.session, `document.querySelectorAll('.message').length === 2`);
  await navigate(buyer, `/pages/chat.html?conversationId=${conversationId}`);
  await until(buyer.session, `document.querySelectorAll('.message').length === 2`);
  assert(await api(buyer, `try { await api.updateItemStatus(${listingId},'sold');return false; } catch(error) { return error.status===403; }`), 'Buyer changed seller status');
  await navigate(seller, '/pages/my-listings.html');
  await until(seller.session, `!!document.querySelector('tr[data-id="${listingId}"] select')`);
  await evaluate(seller.session, `const select=document.querySelector('tr[data-id="${listingId}"] select');select.value='sold';select.dispatchEvent(new Event('change',{bubbles:true}))`);
  await until(seller.session, `document.getElementById('listings-feedback').textContent === 'Listing status updated.'`);
  await until(buyer.session, `document.querySelector('#thread-product .status-badge')?.textContent === 'Sold'`);
  await navigate(buyer, `/pages/product-detail.html?id=${listingId}`);
  await until(buyer.session, `document.getElementById('product-status').textContent === 'Sold' && document.getElementById('chat-button').disabled`);
  assert(await api(buyer, `return (await api.getUserStats(${listing.seller_id})).sold === 1;`), 'Public sold count stale');
  await navigate(buyer, `/pages/product-detail.html?id=${listingId}`);
  await until(buyer.session, `!document.getElementById('detail-content').hidden`);
  assert(await evaluate(buyer.session, `document.querySelector('.quantity-picker').hidden && !document.querySelector('.quantity-info').textContent.includes('available') && document.querySelector('.quantity-info').textContent.includes('Sold') && document.getElementById('chat-button').disabled`), 'Sold listing still offers quantity selection or chat');
  console.log('PASS search/detail, two-account chat and polling, history after reload, owner authorization and Mark Sold');

  // Enough real records to exercise page two; reuse the seller's uploaded image.
  await api(seller, `for(let i=0;i<63;i++) await api.createItem({title:'Pagination '+i,category:'other',price:i,condition:'good',description:'Pagination fixture',location:'NEU',image_urls:${JSON.stringify(listing.image_urls)}});`);
  for (const route of ['/pages/browse.html', '/pages/search.html?q=Pagination']) {
    await navigate(buyer, route);
    await until(buyer.session, `document.querySelectorAll('.product-card').length === 50`);
    failure = url => url.pathname === '/api/items' && url.searchParams.get('page') === '2';
    await evaluate(buyer.session, `for(let i=0;i<10;i++) document.getElementById('load-more').click()`);
    await until(buyer.session, `document.querySelector('#catalog-status button')?.textContent === 'Retry'`);
    assert(await evaluate(buyer.session, `document.querySelectorAll('.product-card').length === 50`), 'Page-two failure removed existing results');
    const before = requests.filter(r => r.url.pathname === '/api/items' && r.url.searchParams.get('page') === '2').length;
    await evaluate(buyer.session, `const retry=document.querySelector('#catalog-status button');for(let i=0;i<10;i++) {retry.click();document.getElementById('load-more').click();}`);
    await until(buyer.session, `document.querySelectorAll('.product-card').length === 63 && document.getElementById('load-more').hidden`);
    const after = requests.filter(r => r.url.pathname === '/api/items' && r.url.searchParams.get('page') === '2').length;
    assert(after - before === 1, 'Duplicate page-two retry request');
    assert(await evaluate(buyer.session, `new Set([...document.querySelectorAll('.product-title a')].map(a=>a.href)).size===63`), 'Duplicate cards');
    const start = requests.filter(r => r.url.pathname === '/api/items').length;
    await evaluate(buyer.session, `const min=document.querySelector('[name="min_price"]');min.value='10';min.dispatchEvent(new Event('input',{bubbles:true}));const sort=document.getElementById('sort-select');sort.value='price_desc';sort.dispatchEvent(new Event('change',{bubbles:true}));`);
    await until(buyer.session, `document.querySelectorAll('.product-card').length === 50 && document.getElementById('result-count').textContent === '(53)'`);
    await wait(350);
    assert(requests.filter(r => r.url.pathname === '/api/items').length - start === 1, 'Price debounce duplicated sort request');
    assert(await evaluate(buyer.session, `const prices=[...document.querySelectorAll('.product-price')].map(p=>Number(p.textContent.replace(/[^0-9]/g,'')));prices.every((p,i)=>!i || prices[i-1]>=p)`), 'Real sorting wrong');
    await evaluate(buyer.session, `document.querySelector('.clear-filter-button').click()`);
    await until(buyer.session, `document.getElementById('result-count').textContent === '(63)'`);
  }
  await navigate(buyer, '/pages/search.html?q=does-not-exist');
  await until(buyer.session, `!document.getElementById('empty-state').hidden`);
  assert(await api(buyer, `try {await api.getItems({page:0});return false;}catch(error){return error.status===422 && error.message.includes('page:');}`), 'Validation error lost its field or HTTP status');
  await navigate(buyer, '/pages/browse.html');
  await until(buyer.session, `document.querySelectorAll('.product-card').length === 50`);
  holdNextListing = true;
  await evaluate(buyer.session, `document.getElementById('sort-select').value='price_asc';document.getElementById('sort-select').dispatchEvent(new Event('change',{bubbles:true}))`);
  for (let i=0; i<50 && !heldListing; i++) await wait(100);
  assert(heldListing, 'Did not hold obsolete listing request');
  assert(await evaluate(buyer.session, `document.getElementById('catalog-status').textContent.includes('Loading') && document.querySelectorAll('.product-card').length===0`), 'Loading state shows outdated results');
  await evaluate(buyer.session, `document.querySelector('[name="category"][value="textbooks"]').click()`);
  await until(buyer.session, `!document.getElementById('empty-state').hidden && document.getElementById('result-count').textContent==='(0)'`);
  await command('Fetch.continueRequest', {requestId:heldListing.requestId}, heldListing.session).catch(() => {});
  await wait(300);
  assert(await evaluate(buyer.session, `document.querySelectorAll('.product-card').length===0 && document.getElementById('result-count').textContent==='(0)'`), 'Obsolete response replaced filtered results');
  console.log('PASS real Browse/Search pagination, error/retry, repeated clicks, unique cards, price/sort request count, validation errors, loading/empty and obsolete-response isolation');

  await navigate(seller, '/pages/my-listings.html');
  await until(seller.session, `!!document.querySelector('[data-delete="${listingId}"]')`);
  await evaluate(seller.session, `document.querySelector('[data-delete="${listingId}"]').click();document.querySelector('#delete-form button[value="delete"]').click()`);
  await until(seller.session, `document.getElementById('listings-feedback').textContent === 'Listing deleted.'`);
  assert(await api(buyer, `try {await api.getItem(${listingId});return false;}catch(error){return error.status===404;}`), 'Deleted listing still accessible');
  await evaluate(buyer.session, `document.querySelector('.logout-button').click()`);
  await until(buyer.session, `location.pathname === '/index.html' && document.querySelector('.account-label')?.textContent === 'Log In'`);
  assert(await api(buyer, `return await api.getCurrentUser() === null;`), 'Logout retained session');
  assert(await api(buyer, `try {await api.getMyItems();return false;}catch(error){return error.status===401;}`), 'Guest accessed private listings');

  // Same host pairing must also work when both servers are addressed as localhost.
  const local = await tab(`http://localhost:${port}`);
  await account(local, 'local@example.com', 'Local Student');
  assert(await api(local, `return (await api.getCurrentUser()).email === 'local@example.com';`), 'localhost cookie authentication failed');
  assert(await api(local, `const components=await import('/js/components.js');return new URL(components.resolveAssetUrl('/uploads/test.png')).hostname === 'localhost';`), 'Upload host differs from API host');
  await navigate(local, '/pages/browse.html');
  await until(local.session, `document.querySelectorAll('.product-card').length === 50`);
  await command('Network.emulateNetworkConditions', {offline:true, latency:0, downloadThroughput:0, uploadThroughput:0}, local.session);
  await evaluate(local.session, `document.getElementById('sort-select').value='price_asc';document.getElementById('sort-select').dispatchEvent(new Event('change',{bubbles:true}))`);
  await until(local.session, `document.querySelector('#catalog-status button')?.textContent === 'Retry'`);
  await command('Network.emulateNetworkConditions', {offline:false, latency:0, downloadThroughput:-1, uploadThroughput:-1}, local.session);
  await evaluate(local.session, `document.querySelector('#catalog-status button').click()`);
  await until(local.session, `document.querySelectorAll('.product-card').length === 50`);
  const restricted = await tab(`http://127.0.0.1:${port}`);
  await command('Page.addScriptToEvaluateOnNewDocument', {source:"Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };"}, restricted.session);
  await navigate(restricted, '/pages/browse.html');
  await until(restricted.session, `document.querySelectorAll('.product-card').length === 50`);
  assert(await api(restricted, `return api.API_MODE === 'real';`), 'Unavailable storage prevented real mode');
  assert(exceptions.length === 0, 'Browser exceptions: ' + JSON.stringify(exceptions));
  console.log('PASS delete, logout, unauthorized state, localhost cookies/upload URLs, CORS allowlist, offline/retry and unavailable storage; no uncaught browser exceptions');
} finally {
  ws?.close();
  for (const child of [browser, backend]) {
    if (child && child.exitCode === null && child.pid) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill(); await exited;
    }
  }
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, {recursive:true, force:true, maxRetries:5, retryDelay:100});
}
