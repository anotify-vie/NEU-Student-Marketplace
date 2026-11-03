import { API_MODE, getCurrentUser, getConversations, getMessages, sendMessage, getUser, getItem, loadDemoConversations } from './api.js';
import { renderShell, resolveAssetUrl, formatPrice } from './components.js';

renderShell();
const layout = document.getElementById('chat-layout');
const list = document.getElementById('conversation-list');
const messages = document.getElementById('message-list');
const form = document.getElementById('message-form');
const input = document.getElementById('message-input');
const notice = document.getElementById('chat-notice');
const retry = document.getElementById('chat-retry');
const cards = new Map(), thread = new Map();
const requestedId = new URLSearchParams(location.search).get('conversationId');
const dateOptions = {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'};
let user, conversations = [], activeId, generation = 0, firstLoad = true;
let timer, refreshing = false, alive = true, ready = false, sending = false;

function showError(error) {
  if (error.status === 401) {
    location.replace(`login.html?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  notice.textContent = error.message || 'Unable to load messages. Please try again.';
  notice.classList.add('is-error'); retry.hidden = false;
}
function avatar(element,person) {
  element.replaceChildren();
  if (person.avatar_url) {
    const image = document.createElement('img'); image.src = resolveAssetUrl(person.avatar_url); image.alt = ''; element.append(image);
  } else element.textContent = person.display_name.split(/\s+/).slice(0,2).map(word => word[0]).join('').toUpperCase();
}
async function product(id) {
  try { return await getItem(id); }
  catch(error) {
    if (!error.message.includes('could not be found')) throw error;
    return {id,title:'Listing unavailable',image_urls:[],status:'deleted'};
  }
}
function productHeader(item) {
  const link = document.getElementById('thread-product');
  link.href = item.status === 'deleted' ? 'browse.html' : `product-detail.html?id=${item.id}`;
  const image = document.createElement('img'); image.src = resolveAssetUrl(item.image_urls[0]); image.alt = '';
  const title = document.createElement('span'); title.textContent = item.title;
  const price = document.createElement('small'); price.textContent = item.status === 'deleted' ? 'The listing has been removed.' : formatPrice(item.price); title.append(price);
  const badge = document.createElement('span'); badge.className = `status-badge status-${item.status}`;
  badge.textContent = {available:'Available',reserved:'Reserved',sold:'Sold',deleted:'Removed'}[item.status];
  link.replaceChildren(image,title,badge);
}
function renderConversations() {
  list.replaceChildren(...conversations.map(conversation => {
    const card = cards.get(conversation.id);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'conversation-button'; button.dataset.id = conversation.id;
    button.setAttribute('aria-current',String(conversation.id === activeId));
    const picture = document.createElement('span'); picture.className = 'chat-avatar'; avatar(picture,card.person);
    const copy = document.createElement('span'); copy.className = 'conversation-copy';
    const heading = document.createElement('span'); heading.className = 'conversation-name-row';
    const name = document.createElement('strong'); name.textContent = card.person.display_name;
    const time = document.createElement('time'); time.dateTime = conversation.updated_at;
    time.textContent = new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',...dateOptions}).format(new Date(conversation.updated_at));
    const item = document.createElement('p'); item.className = 'conversation-item'; item.textContent = card.item.title;
    const preview = document.createElement('p'); preview.textContent = card.last?.text || 'No messages yet';
    heading.append(name,time); copy.append(heading,item,preview); button.append(picture,copy);
    return button;
  }));
}
function setComposer() {
  input.disabled = !ready || sending;
  form.querySelector('button').disabled = !ready || sending;
}
function mergeMessages(incoming) {
  let changed = false;
  for (const message of incoming) {
    if (!thread.has(message.id)) { thread.set(message.id,message); changed = true; }
  }
  if (!changed) return;
  const sorted = [...thread.values()].sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  messages.replaceChildren(...sorted.map(message => {
    const row = document.createElement('li'); row.className = `message${message.sender_id === user.id ? ' message--out' : ''}`; row.dataset.id = message.id;
    const text = document.createElement('p'); text.textContent = message.text;
    const time = document.createElement('time'); time.dateTime = message.created_at;
    time.textContent = new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',...dateOptions}).format(new Date(message.created_at)); row.append(text,time);
    return row;
  }));
  messages.scrollTop = messages.scrollHeight;
  cards.get(activeId).last = sorted.at(-1);
  document.getElementById('thread-status').textContent = '';
  renderConversations();
}
async function selectConversation(id) {
  const card = cards.get(id); if (!card) return;
  const version = ++generation; activeId = id; ready = false; thread.clear(); messages.replaceChildren(); input.value = '';
  document.getElementById('message-error').textContent = '';
  document.getElementById('choose-conversation').hidden = true; document.getElementById('chat-thread').hidden = false;
  layout.classList.add('has-active'); setComposer();
  avatar(document.getElementById('thread-avatar'),card.person);
  const person = document.getElementById('thread-person'); person.textContent = card.person.display_name; person.href = `profile.html?id=${card.person.id}`;
  productHeader(card.item); renderConversations();
  const url = new URL(location.href); url.searchParams.set('conversationId',id); history.replaceState(null,'',url);
  document.getElementById('thread-status').textContent = 'Loading messages…';
  try {
    const incoming = await getMessages(id);
    if (!alive || version !== generation) return;
    mergeMessages(incoming); ready = true; setComposer();
    if (!incoming.length) document.getElementById('thread-status').textContent = 'No messages yet. Say hello!';
  } catch(error) {
    if (alive && version === generation) {
      document.getElementById('thread-status').textContent = 'Unable to load messages.';
      showError(error);
    }
  }
}
async function pollActive() {
  const id = activeId, version = generation;
  const [incoming,item] = await Promise.all([getMessages(id,Math.max(0,...thread.keys())),product(cards.get(id).item_id)]);
  if (!alive || id !== activeId || version !== generation) return;
  cards.get(id).item = item; productHeader(item); mergeMessages(incoming);
}
function schedule() {
  clearTimeout(timer);
  if (alive && !document.hidden) timer = setTimeout(refresh,4000);
}
async function refresh() {
  if (!alive || !user || refreshing || document.hidden) return;
  refreshing = true;
  try {
    const entries = await getConversations();
    const hydrated = await Promise.all(entries.map(async entry => {
      const previous = cards.get(entry.id);
      if (API_MODE === 'real') return {...entry,person:entry.other_user,last:entry.last_message};
      if (previous?.updated_at === entry.updated_at) return previous;
      const person = previous?.person || await getUser(entry.buyer_id === user.id ? entry.seller_id : entry.buyer_id);
      const item = previous?.item || await product(entry.item_id);
      const recent = entry.id === activeId && previous ? null : await getMessages(entry.id);
      return {...entry,person,item,last:recent ? recent.at(-1) : previous?.last};
    }));
    if (!alive) return;
    conversations = entries.sort((a,b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id);
    hydrated.forEach(card => cards.set(card.id,card));
    document.getElementById('conversation-status').textContent = '';
    document.getElementById('no-conversations').hidden = Boolean(entries.length);
    notice.textContent = ''; notice.classList.remove('is-error'); retry.hidden = true; renderConversations();
    if (activeId && !entries.some(entry => entry.id === activeId)) {
      generation++; activeId = null; ready = false; setComposer(); layout.classList.remove('has-active');
      document.getElementById('chat-thread').hidden = true; document.getElementById('choose-conversation').hidden = false;
      throw new Error('This conversation is unavailable or you do not have access.');
    }
    if (firstLoad) {
      firstLoad = false;
      if (requestedId !== null) {
        if (entries.some(entry => entry.id === Number(requestedId))) await selectConversation(Number(requestedId));
        else throw new Error('This conversation is unavailable or you do not have access.');
      } else if (entries.length && window.matchMedia('(min-width:701px)').matches) await selectConversation(entries[0].id);
    } else if (activeId) {
      if (!ready) await selectConversation(activeId);
      else await pollActive();
    }
  } catch(error) {
    if (alive) { document.getElementById('conversation-status').textContent = ''; showError(error); }
  } finally { refreshing = false; schedule(); }
}
list.addEventListener('click',event => { const button=event.target.closest('[data-id]'); if(button) selectConversation(Number(button.dataset.id)); });
document.getElementById('back-conversations').addEventListener('click',() => {
  generation++; activeId = null; ready = false; setComposer(); layout.classList.remove('has-active');
  document.getElementById('chat-thread').hidden = true; document.getElementById('choose-conversation').hidden = false;
  const url = new URL(location.href); url.searchParams.delete('conversationId'); history.replaceState(null,'',url); renderConversations();
});
input.addEventListener('input',() => { document.getElementById('message-error').textContent = ''; input.removeAttribute('aria-invalid'); });
input.addEventListener('keydown',event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
});
form.addEventListener('submit',async event => {
  event.preventDefault(); if (!ready || sending) return;
  const text = input.value.trim();
  if (!text || text.length > 1000) {
    document.getElementById('message-error').textContent = 'Enter a message between 1 and 1,000 characters.'; input.setAttribute('aria-invalid','true'); input.focus(); return;
  }
  const id = activeId, version = generation; sending = true; setComposer();
  try {
    const message = await sendMessage(id,text);
    if (!alive || version !== generation) return;
    input.value = ''; document.getElementById('message-error').textContent = ''; mergeMessages([message]);
    conversations = conversations.map(entry => entry.id === id ? {...entry,updated_at:message.created_at} : entry).sort((a,b) => b.updated_at.localeCompare(a.updated_at)); renderConversations();
  } catch(error) {
    if (alive && version === generation) {
      if (error.status === 401) showError(error);
      else document.getElementById('message-error').textContent = error.message;
    }
  } finally { sending = false; if(alive) {setComposer(); if(activeId === id) input.focus();} }
});
retry.addEventListener('click',refresh);
document.getElementById('demo-chat').addEventListener('click',async event => {
  event.target.disabled = true;
  try { await loadDemoConversations(); await refresh(); }
  catch(error) { showError(error); }
  finally { event.target.disabled = false; }
});
document.addEventListener('visibilitychange',() => { if(document.hidden) clearTimeout(timer); else refresh(); });
window.addEventListener('storage',refresh);
window.addEventListener('pagehide',() => {alive = false; generation++; clearTimeout(timer);});
window.addEventListener('pageshow',event => {if(event.persisted) {alive = true; refresh();}});
(async () => {
  try {
    user = await getCurrentUser();
    if (!user) return showError({status:401});
    document.getElementById('demo-chat').hidden = API_MODE !== 'mock' || ![1,2].includes(user.id);
    setComposer(); await refresh();
  } catch(error) { showError(error); }
})();
