import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5500';
const screenshots = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../docs/screenshots/fe1-02');
const profile = await mkdtemp(path.join(tmpdir(),'neu-fe1-02-chrome-'));
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
async function waitFor(sessionId,expression,message) {
  for (let i=0;i<60;i++) {
    if (await evaluate(expression,sessionId)) return;
    await wait(100);
  }
  throw new Error(message);
}
async function navigate(sessionId,url,width=1440,height=1000,expected=url) {
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700},sessionId);
  await command('Page.navigate',{url:`${base}${url}`},sessionId);
  await waitFor(sessionId,`location.href === ${JSON.stringify(`${base}${expected}`)} && document.readyState === 'complete' && !!document.querySelector('.site-header .brand') && document.querySelector('.content-status')?.textContent.trim() === ''`,`Page did not render: ${url}`);
}
async function screenshot(sessionId,name) {
  await waitFor(sessionId,`[...document.querySelectorAll('#detail-content:not([hidden]) img, #profile-content:not([hidden]) img')].every(img => img.complete && img.naturalWidth > 0)`,`Images did not load: ${name}`);
  const result = await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);
  await writeFile(path.join(screenshots,name),Buffer.from(result.data,'base64'));
}

try {
  ws = new WebSocket(await browserUrl());
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

  for (const [name,url] of [['product-detail','/pages/product-detail.html?id=101'],['profile','/pages/profile.html']]) {
    if (name === 'profile') await evaluate(`sessionStorage.setItem('neu-marketplace-demo-user-id','1')`,sessionId);
    for (const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
      await navigate(sessionId,url,width,height);
      assert(await evaluate('document.documentElement.scrollWidth <= window.innerWidth',sessionId),`${name} overflows ${width} px viewport.`);
      await screenshot(sessionId,`${name}-${label}.png`);
    }
    for (const width of [320,768]) {
      await navigate(sessionId,url,width,844);
      assert(await evaluate('document.documentElement.scrollWidth <= window.innerWidth',sessionId),`${name} overflows ${width} px viewport.`);
    }
  }
  await evaluate(`sessionStorage.removeItem('neu-marketplace-demo-user-id')`,sessionId);

  await navigate(sessionId,'/pages/profile.html');
  assert(await evaluate(`document.getElementById('edit-profile-button').hidden`,sessionId),'Guests must not edit the demo owner profile.');
  assert(await evaluate(`document.querySelector('.account-link').getAttribute('href').endsWith('/pages/login.html') && document.querySelector('.account-label').textContent === 'Log In'`,sessionId),'Guest account entry must lead to Login.');
  assert(await evaluate(`(async () => { try { await (await import('/js/api.js')).updateProfile(1,{display_name:'Guest Change',faculty:'Faculty of Economics',cohort:'K64',bio:''}); return false; } catch(error) { return error.message.includes('Please log in'); } })()`,sessionId),'Guest profile update was not rejected.');

  await navigate(sessionId,'/pages/browse.html');
  await evaluate(`document.querySelector('.product-card .product-title a').click()`,sessionId);
  await waitFor(sessionId,`location.pathname === '/pages/product-detail.html' && new URLSearchParams(location.search).get('id') === '101' && document.getElementById('product-title')?.textContent === 'Microeconomics Textbook'`,'Product card did not open the correct detail page.');
  assert(await evaluate(`document.getElementById('product-title').textContent === 'Microeconomics Textbook' && document.getElementById('product-price').textContent === '45,000 VND'`,sessionId),'Product ID 101 data is incorrect.');
  assert(await evaluate(`document.querySelectorAll('.thumbnail-button').length === 3`,sessionId),'Product thumbnails are missing.');
  await evaluate(`document.querySelectorAll('.thumbnail-button')[1].click()`,sessionId);
  assert(await evaluate(`document.getElementById('main-product-image').src.includes('textbook-pages.svg') && document.querySelectorAll('.thumbnail-button')[1].getAttribute('aria-pressed') === 'true'`,sessionId),'Thumbnail switching failed.');
  assert(await evaluate(`document.getElementById('seller-link').getAttribute('href') === 'profile.html?id=2'`,sessionId),'Seller profile link has the wrong ID.');
  await evaluate(`document.getElementById('favorite-button').click()`,sessionId);
  assert(await evaluate(`document.getElementById('favorite-button').getAttribute('aria-pressed') === 'true'`,sessionId),'Detail favorite toggle failed.');
  await evaluate(`document.getElementById('seller-link').click()`,sessionId);
  await waitFor(sessionId,`location.href === ${JSON.stringify(`${base}/pages/profile.html?id=2`)} && document.getElementById('profile-name')?.textContent === 'Ha Linh Tran'`,'Seller profile did not open.');
  assert(await evaluate(`document.getElementById('edit-profile-button').hidden`,sessionId),'A public seller profile must not expose Edit Profile.');

  await navigate(sessionId,'/pages/item-detail.html?id=101',1440,900,'/pages/product-detail.html?id=101');
  await navigate(sessionId,'/pages/product-detail.html?id=113');
  assert(await evaluate(`document.getElementById('product-status').textContent === 'Sold' && document.getElementById('chat-button').disabled`,sessionId),'Sold item must disable chat.');
  await navigate(sessionId,'/pages/product-detail.html?id=115');
  assert(await evaluate(`document.getElementById('product-status').textContent === 'Reserved' && !document.getElementById('chat-button').disabled`,sessionId),'Reserved item state is incorrect.');
  await navigate(sessionId,'/pages/product-detail.html?id=999');
  assert(await evaluate(`!document.getElementById('detail-error').hidden && document.getElementById('detail-content').hidden`,sessionId),'Missing product error state is absent.');

  await evaluate(`sessionStorage.setItem('neu-marketplace-demo-user-id','1')`,sessionId);
  await navigate(sessionId,'/pages/profile.html');
  assert(await evaluate(`document.querySelector('.account-link').getAttribute('href').endsWith('/pages/profile.html') && document.querySelector('.account-label').textContent === 'Profile'`,sessionId),'Signed-in account entry must lead to Profile.');
  assert(await evaluate(`!document.getElementById('edit-profile-button').hidden && document.getElementById('stat-total').textContent === '3' && document.getElementById('stat-sold').textContent === '2'`,sessionId),'Owner profile or statistics are incorrect.');
  await evaluate(`document.getElementById('edit-profile-button').click()`,sessionId);
  await evaluate(`(() => { document.getElementById('edit-name').value='A'; document.getElementById('profile-form').requestSubmit(); })()`,sessionId);
  assert(await evaluate(`document.getElementById('name-error').textContent.length > 0 && document.getElementById('edit-name').getAttribute('aria-invalid') === 'true'`,sessionId),'Profile validation failed.');
  await evaluate(`(() => { document.getElementById('edit-name').value='Mai Anh Nguyen Updated'; document.getElementById('profile-form').requestSubmit(); })()`,sessionId);
  await waitFor(sessionId,`document.getElementById('profile-name').textContent === 'Mai Anh Nguyen Updated' && document.getElementById('edit-panel').hidden`,'Profile save failed.');
  await navigate(sessionId,'/pages/profile.html');
  assert(await evaluate(`document.getElementById('profile-name').textContent === 'Mai Anh Nguyen Updated'`,sessionId),'Mock profile edit did not persist after reload.');
  await navigate(sessionId,'/pages/profile.html?id=999');
  assert(await evaluate(`!document.getElementById('profile-error').hidden`,sessionId),'Missing profile error state is absent.');
  await evaluate(`sessionStorage.setItem('neu-marketplace-demo-user-id','1')`,sessionId);
  await navigate(sessionId,'/pages/profile.html?id=1');
  assert(await evaluate(`!document.getElementById('edit-profile-button').hidden`,sessionId),'Signed-in owner must be able to edit their explicit profile URL.');
  await navigate(sessionId,'/pages/profile.html?id=2');
  assert(await evaluate(`document.getElementById('edit-profile-button').hidden`,sessionId),'A signed-in user must not edit another profile.');
  assert(await evaluate(`(async () => { try { await (await import('/js/api.js')).updateProfile(2,{display_name:'Wrong Owner',faculty:'Faculty of Economics',cohort:'K64',bio:''}); return false; } catch(error) { return error.message.includes('profile owner'); } })()`,sessionId),'Mock API allowed another user to edit this profile.');
  await evaluate(`sessionStorage.setItem('neu-marketplace-demo-user-id','2')`,sessionId);
  await navigate(sessionId,'/pages/profile.html');
  assert(await evaluate(`document.getElementById('profile-name').textContent === 'Ha Linh Tran' && !document.getElementById('edit-profile-button').hidden`,sessionId),'Account Profile must show the signed-in user.');
  await evaluate(`sessionStorage.removeItem('neu-marketplace-demo-user-id')`,sessionId);

  assert(exceptions.length===0,`JavaScript exceptions: ${exceptions.join('; ')}`);
  assert(consoleErrors.length===0,`Console errors: ${consoleErrors.join('; ')}`);

  await navigate(sessionId,'/pages/product-detail.html?id=101');
  await evaluate(`document.getElementById('chat-button').click()`,sessionId);
  await waitFor(sessionId,`location.pathname === '/pages/login.html' && new URLSearchParams(location.search).get('returnTo') === '/pages/product-detail.html?id=101'`,'Guest chat did not redirect to Login with returnTo.');
  await navigate(sessionId,'/pages/product-detail.html?id=101');
  await evaluate(`sessionStorage.setItem('neu-marketplace-demo-user-id','1')`,sessionId);
  await navigate(sessionId,'/pages/product-detail.html?id=101');
  await evaluate(`document.getElementById('chat-button').click()`,sessionId);
  await waitFor(sessionId,`location.pathname === '/pages/chat.html' && new URLSearchParams(location.search).get('conversationId') === '1101'`,'Authenticated chat did not route to the item conversation.');
  await navigate(sessionId,'/pages/product-detail.html?id=101');
  await evaluate(`sessionStorage.setItem('neu-marketplace-demo-user-id','2')`,sessionId);
  await navigate(sessionId,'/pages/product-detail.html?id=101');
  assert(await evaluate(`document.getElementById('chat-button').disabled && document.getElementById('chat-button').textContent === 'Your Listing'`,sessionId),'Seller must not chat about their own listing.');

  console.log('PASS: detail and profile at 320/390/768/1440 px; thumbnails, statuses, seller navigation, guest/auth chat routing, owner edit and validation, persistence, missing states; no JavaScript console errors on implemented pages.');
  console.log(`Screenshots: ${screenshots}`);
} finally {
  if (ws) ws.close();
  browser.kill();
  const tempRoot = path.resolve(tmpdir()) + path.sep;
  if (path.resolve(profile).startsWith(tempRoot)) await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
