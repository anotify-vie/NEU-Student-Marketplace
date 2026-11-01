import { getCurrentUser, logout } from './api.js';

const root = document.body.dataset.root || '.';
const page = document.body.dataset.page || '';
const path = target => `${root}/${target}`;

function icon(name) {
  const paths = {
    search:'<circle cx="10.7" cy="10.7" r="6.2"/><path d="m15.4 15.4 4.1 4.1"/>',
    heart:'<path d="M20.8 8.5c0 4.1-8.8 10.4-8.8 10.4S3.2 12.6 3.2 8.5a4.4 4.4 0 0 1 8.8-.8 4.4 4.4 0 0 1 8.8.8Z"/>',
    user:'<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.5c.4-3.6 2.6-5.5 6.5-5.5s6.1 1.9 6.5 5.5"/>'
  };
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

export function renderShell() {
  const accountTarget = 'pages/login.html';
  const accountLabel = 'Account';
  document.getElementById('site-header').innerHTML = `<div class="header-inner"><a class="brand" href="${path('index.html')}" aria-label="NEU Student Marketplace home"><span class="brand-mark" aria-hidden="true">N</span><span>NEU Student Marketplace</span></a><nav class="desktop-nav" aria-label="Main navigation"><a href="${path('index.html')}" ${page==='home'?'aria-current="page"':''}>Home</a><a href="${path('pages/browse.html')}" ${page==='browse'||page==='search'?'aria-current="page"':''}>Categories</a><a href="${path('pages/my-listings.html')}" ${page==='my-listings'?'aria-current="page"':''}>My Listings</a><a href="${path('pages/chat.html')}" ${page==='chat'?'aria-current="page"':''}>Messages</a></nav><div class="header-actions"><a class="icon-link" href="${path('pages/search.html')}" aria-label="Search">${icon('search')}</a><a class="account-link" href="${path(accountTarget)}" aria-label="Checking account"><span class="avatar" aria-hidden="true">${icon('user')}</span><span class="account-label">${accountLabel}</span></a><button class="logout-button" type="button" hidden>Log Out</button></div><button class="mobile-menu-button" type="button" aria-label="Open menu" aria-controls="mobile-nav" aria-expanded="false">☰</button></div><nav class="mobile-nav" id="mobile-nav" aria-label="Mobile navigation"><a href="${path('index.html')}">Home</a><a href="${path('pages/browse.html')}">Categories</a><a href="${path('pages/search.html')}">Search</a><a href="${path('pages/my-listings.html')}" ${page==='my-listings'?'aria-current="page"':''}>My Listings</a><a href="${path('pages/chat.html')}" ${page==='chat'?'aria-current="page"':''}>Messages</a><a class="mobile-account-link" href="${path(accountTarget)}">${accountLabel}</a><button class="logout-button" type="button" hidden>Log Out</button></nav><p class="session-notice" role="alert" hidden></p>`;
  document.getElementById('site-footer').innerHTML = `<div class="footer-inner"><span>© 2026 NEU Student Marketplace. Made for the student community.</span><nav class="footer-links" aria-label="Footer navigation"><a href="${path('index.html')}">Home</a><a href="${path('pages/browse.html')}">Browse</a><a href="${path('pages/search.html')}">Search</a></nav></div>`;
  const menuButton = document.querySelector('.mobile-menu-button');
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded',String(open));
    menuButton.setAttribute('aria-label',open?'Close menu':'Open menu');
    document.getElementById('mobile-nav').classList.toggle('open',open);
  });
  const closeMenu = () => {
    menuButton.setAttribute('aria-expanded','false');
    menuButton.setAttribute('aria-label','Open menu');
    document.getElementById('mobile-nav').classList.remove('open');
  };
  document.addEventListener('keydown',event => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') { closeMenu(); menuButton.focus(); }
  });
  document.addEventListener('click',event => { if (!document.getElementById('site-header').contains(event.target)) closeMenu(); });
  window.matchMedia('(max-width:800px)').addEventListener('change',closeMenu);
  const accountLink = document.querySelector('.account-link');
  const mobileAccountLink = document.querySelector('.mobile-account-link');
  return getCurrentUser().then(user => {
    const target = path(user ? 'pages/profile.html' : 'pages/login.html');
    const label = user ? 'Profile' : 'Log In';
    accountLink.href = target;
    accountLink.setAttribute('aria-label',user ? 'View profile' : 'Log in');
    accountLink.querySelector('.account-label').textContent = label;
    mobileAccountLink.href = target;
    mobileAccountLink.textContent = label;
    document.querySelectorAll('.logout-button').forEach(button => {
      button.hidden = !user;
      button.addEventListener('click',async () => {
        document.querySelectorAll('.logout-button').forEach(control => { control.disabled = true; });
        try { await logout(); location.assign(path('index.html')); }
        catch(error) {
          const notice = document.querySelector('.session-notice');
          notice.textContent = error.message || 'Unable to log out. Please try again.';
          notice.hidden = false;
          document.querySelectorAll('.logout-button').forEach(control => { control.disabled = false; });
        }
      });
    });
  }).catch(() => {
    accountLink.setAttribute('aria-label','Account status unavailable');
  });
}

const favoritesKey = 'neu-marketplace-demo-favorites';
const memoryFavorites = new Set();
function favoriteIds() {
  try { return new Set(JSON.parse(localStorage.getItem(favoritesKey) || '[]')); }
  catch { return new Set(memoryFavorites); }
}
export function isFavorite(id) { return favoriteIds().has(id); }
export function toggleFavorite(id) {
  const ids = favoriteIds();
  if (ids.has(id)) ids.delete(id); else ids.add(id);
  memoryFavorites.clear(); ids.forEach(value => memoryFavorites.add(value));
  try { localStorage.setItem(favoritesKey,JSON.stringify([...ids])); } catch { /* Use memory when storage is unavailable. */ }
  return ids.has(id);
}
export function formatPrice(value) { return `${new Intl.NumberFormat('en-US').format(value)} VND`; }
export function resolveAssetUrl(raw) {
  if (!raw) return new URL('../assets/placeholder.svg', import.meta.url).href;
  if (/^(https?:|data:|blob:)/.test(raw)) return raw;
  if (raw.startsWith('/uploads/')) return `http://127.0.0.1:8000${raw}`;
  return new URL(`../${raw.replace(/^\//,'')}`, import.meta.url).href;
}
export function productImageUrl(item) { return resolveAssetUrl(item.image_urls?.[0]); }

export function createProductCard(item) {
  const card = document.createElement('article');
  card.className = 'product-card';
  const imageLink = document.createElement('a');
  imageLink.className = 'product-image-link';
  imageLink.href = `${path('pages/product-detail.html')}?id=${encodeURIComponent(item.id)}`;
  imageLink.setAttribute('aria-label',`View ${item.title}`);
  const image = document.createElement('img');
  image.src = productImageUrl(item);
  image.alt = item.title;
  image.loading = 'eager';
  imageLink.append(image);
  const favorite = document.createElement('button');
  favorite.type = 'button';
  favorite.className = 'favorite-button';
  favorite.innerHTML = icon('heart');
  function updateFavorite() {
    const active = isFavorite(item.id);
    favorite.setAttribute('aria-pressed',String(active));
    favorite.setAttribute('aria-label',`${active?'Remove':'Add'} ${item.title} ${active?'from':'to'} demo favorites`);
    favorite.querySelector('svg').setAttribute('fill',active?'currentColor':'none');
  }
  updateFavorite();
  favorite.addEventListener('click', () => {
    toggleFavorite(item.id);
    updateFavorite();
  });
  const info = document.createElement('div');
  info.className = 'product-info';
  const title = document.createElement('h3');
  title.className = 'product-title';
  const titleLink = document.createElement('a');
  titleLink.href = imageLink.href;
  titleLink.textContent = item.title;
  title.append(titleLink);
  const price = document.createElement('p');
  price.className = 'product-price';
  price.textContent = formatPrice(item.price);
  const meta = document.createElement('div');
  meta.className = 'product-meta';
  const condition = document.createElement('span');
  condition.className = 'condition-badge';
  condition.textContent = {new:'Like New',good:'Good',fair:'Fair'}[item.condition] || item.condition;
  const date = document.createElement('span');
  date.className = 'product-date';
  date.textContent = new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(item.created_at));
  meta.append(condition,date);
  info.append(title,price,meta);
  card.append(imageLink,favorite,info);
  return card;
}

export function renderCards(container, items) {
  container.replaceChildren(...items.map(createProductCard));
}
