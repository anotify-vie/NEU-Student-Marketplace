import { getItem, getUser, getCurrentUser, openConversation } from './api.js';
import { selectedPrice } from './pricing.js';
import { renderShell, formatPrice, resolveAssetUrl, isFavorite, toggleFavorite } from './components.js';

renderShell();
const params = new URLSearchParams(location.search);
const id = params.get('id');
const statusElement = document.getElementById('detail-status');
const content = document.getElementById('detail-content');
const errorPanel = document.getElementById('detail-error');
const chatButton = document.getElementById('chat-button');
const favoriteButton = document.getElementById('favorite-button');
const actionMessage = document.getElementById('action-message');
const categoryNames = {textbooks:'Textbooks',uniforms:'Uniforms',study_tools:'Study Supplies',student_items:'Student Essentials',other:'Others'};
const conditionNames = {new:'Like New',good:'Good',fair:'Fair'};
const statusNames = {available:'Available',reserved:'Reserved',sold:'Sold'};

function showError(message) {
  statusElement.textContent = '';
  content.hidden = true;
  document.getElementById('detail-error-message').textContent = message;
  errorPanel.hidden = false;
}

function renderAvatar(container,user) {
  container.replaceChildren();
  if (user.avatar_url) {
    const image = document.createElement('img');
    image.src = resolveAssetUrl(user.avatar_url);
    image.alt = '';
    container.append(image);
  } else {
    container.textContent = user.display_name.split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
  }
}

function renderGallery(item) {
  const images = item.image_urls?.length ? item.image_urls : [null];
  const main = document.getElementById('main-product-image');
  const thumbnails = document.getElementById('thumbnail-list');
  const buttons = [];
  function choose(index) {
    main.src = resolveAssetUrl(images[index]);
    main.alt = `${item.title}, image ${index+1} of ${images.length}`;
    buttons.forEach((button,buttonIndex) => button.setAttribute('aria-pressed',String(index===buttonIndex)));
  }
  images.forEach((raw,index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumbnail-button';
    button.setAttribute('aria-label',`View image ${index+1} of ${images.length}`);
    const image = document.createElement('img');
    image.src = resolveAssetUrl(raw);
    image.alt = '';
    button.append(image);
    button.addEventListener('click',() => choose(index));
    buttons.push(button);
  });
  thumbnails.replaceChildren(...buttons);
  choose(0);
}

function updateFavorite(item) {
  const active = isFavorite(item.id);
  favoriteButton.setAttribute('aria-pressed',String(active));
  favoriteButton.textContent = active ? '♥ Remove from Favorites' : '♡ Add to Favorites';
}

function setupQuantity(item) {
  const total = item.quantity || 1;
  const input = document.getElementById('selected-quantity');
  if (item.status === 'sold') {
    document.querySelector('.quantity-info').textContent = 'Total listing price · Sold';
    document.querySelector('.quantity-picker').hidden = true;
    return;
  }
  document.getElementById('product-quantity').textContent = total;
  input.max = total;
  input.value = 1;
  function update() {
    let count = Math.floor(Number(input.value));
    if (!count || count < 1) count = 1;
    if (count > total) count = total;
    const price = selectedPrice(item.price,total,count);
    document.getElementById('selected-price').textContent = `Estimated price for ${count}: ${formatPrice(price)}`;
  }
  input.addEventListener('input',update);
  input.addEventListener('change',() => { input.value = Math.min(total,Math.max(1,Math.floor(Number(input.value)) || 1)); update(); });
  update();
}

async function renderDetail(item,seller) {
  document.title = `${item.title} | NEU Student Marketplace`;
  document.getElementById('breadcrumb-item').textContent = item.title;
  document.getElementById('product-title').textContent = item.title;
  document.getElementById('product-price').textContent = formatPrice(item.price);
  setupQuantity(item);
  document.getElementById('product-description').textContent = item.description || 'No description provided.';
  document.getElementById('product-location').textContent = item.location || 'Ask the seller';
  const category = document.getElementById('product-category');
  category.textContent = categoryNames[item.category] || 'Others';
  category.href = `browse.html?category=${encodeURIComponent(item.category)}`;
  document.getElementById('product-condition').textContent = conditionNames[item.condition] || item.condition;
  const posted = document.getElementById('posted-date');
  posted.dateTime = item.created_at;
  posted.textContent = `Posted ${new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(item.created_at))}`;
  const listingStatus = document.getElementById('product-status');
  listingStatus.className = `status-badge status-${item.status}`;
  listingStatus.textContent = statusNames[item.status] || item.status;
  document.getElementById('seller-name').textContent = seller.display_name;
  document.getElementById('seller-link').href = `profile.html?id=${encodeURIComponent(seller.id)}`;
  renderAvatar(document.getElementById('seller-avatar'),seller);
  renderGallery(item);
  updateFavorite(item);
  favoriteButton.addEventListener('click',() => { toggleFavorite(item.id); updateFavorite(item); });

  if (item.status === 'sold') {
    chatButton.disabled = true;
    chatButton.textContent = 'Sold — Chat Unavailable';
    actionMessage.textContent = 'This item has been sold. New conversations are unavailable.';
  } else {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser?.id === item.seller_id) {
        chatButton.disabled = true;
        chatButton.textContent = 'Your Listing';
        chatButton.classList.add('is-own-listing');
        chatButton.title = 'This is your listing. Other users can contact you about it.';
      }
    } catch(error) {
      actionMessage.textContent = error.message || 'Unable to check your account.';
    }
    chatButton.addEventListener('click',async () => {
      chatButton.disabled = true;
      chatButton.setAttribute('aria-busy','true');
      actionMessage.textContent = '';
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          const returnUrl = new URL(`product-detail.html?id=${encodeURIComponent(item.id)}`,location.href);
          location.assign(`login.html?returnTo=${encodeURIComponent(returnUrl.pathname + returnUrl.search)}`);
          return;
        }
        const conversation = await openConversation(item.id);
        location.assign(`chat.html?conversationId=${encodeURIComponent(conversation.id)}`);
      } catch(error) {
        actionMessage.textContent = error.message || 'Unable to open the conversation.';
        chatButton.disabled = false;
      } finally {
        chatButton.removeAttribute('aria-busy');
      }
    });
  }
  statusElement.textContent = '';
  content.hidden = false;
}

async function loadDetail() {
  errorPanel.hidden = true;
  content.hidden = true;
  statusElement.textContent = 'Loading product…';
  try {
    const item = await getItem(id);
    const seller = await getUser(item.seller_id);
    await renderDetail(item,seller);
  } catch(error) {
    showError(error.message || 'Unable to load this listing. Please try again.');
  }
}
document.getElementById('detail-retry').addEventListener('click',loadDetail);
loadDetail();
