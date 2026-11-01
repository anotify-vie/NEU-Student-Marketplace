import { getMyItems, updateItemStatus, deleteItem } from './api.js';
import { renderShell, formatPrice, resolveAssetUrl } from './components.js';

renderShell();
const rows = document.getElementById('listing-rows');
const tabs = document.getElementById('listing-tabs');
const status = document.getElementById('listings-status');
const feedback = document.getElementById('listings-feedback');
const dialog = document.getElementById('delete-dialog');
const names = {all:'All',available:'Available',reserved:'Reserved',sold:'Sold'};
const transitions = {available:['reserved','sold'],reserved:['available','sold'],sold:[]};
let items = [], filter = 'all', deleting;

function showFeedback(text,error = false) {
  feedback.textContent = text;
  feedback.classList.toggle('is-error',error);
}
function authRedirect(error) {
  if (error.status !== 401) return false;
  location.replace(`login.html?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
  return true;
}
function render() {
  tabs.querySelectorAll('button').forEach(button => {
    const selected = button.dataset.status === filter;
    const total = items.filter(item => button.dataset.status === 'all' || item.status === button.dataset.status).length;
    button.textContent = `${names[button.dataset.status]} (${total})`;
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  document.getElementById('listing-panel').setAttribute('aria-labelledby',`tab-${filter}`);
  const visible = items.filter(item => filter === 'all' || item.status === filter);
  document.getElementById('listing-table').hidden = !visible.length;
  document.getElementById('listings-empty').hidden = Boolean(visible.length);
  document.getElementById('listings-empty-title').textContent = filter === 'all' ? 'No listings yet' : `No ${filter} listings`;
  rows.replaceChildren(...visible.map(item => {
    const row = document.createElement('tr');
    row.dataset.id = item.id;
    const product = document.createElement('td');
    const link = document.createElement('a');
    link.className = 'listing-product'; link.href = `product-detail.html?id=${item.id}`;
    const image = document.createElement('img');
    image.src = resolveAssetUrl(item.image_urls[0]); image.alt = '';
    const title = document.createElement('span'); title.textContent = item.title;
    link.append(image,title); product.append(link);
    const price = document.createElement('td');
    price.dataset.label = 'Price'; price.className = 'listing-price'; price.textContent = formatPrice(item.price);
    const state = document.createElement('td'); state.dataset.label = 'Status';
    const select = document.createElement('select');
    select.className = 'listing-status-select'; select.setAttribute('aria-label',`Status for ${item.title}`);
    [item.status,...transitions[item.status]].forEach(value => {
      const option = document.createElement('option'); option.value = value; option.textContent = names[value]; select.append(option);
    });
    select.value = item.status; select.disabled = item.status === 'sold'; state.append(select);
    const posted = document.createElement('td'); posted.dataset.label = 'Posted';
    const time = document.createElement('time'); time.dateTime = item.created_at;
    time.textContent = new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(item.created_at)); posted.append(time);
    const actions = document.createElement('td');
    const controls = document.createElement('div'); controls.className = 'listing-actions';
    const edit = document.createElement('a'); edit.className = 'button button-outline'; edit.href = `edit-listing.html?id=${item.id}`; edit.textContent = 'Edit'; edit.setAttribute('aria-label',`Edit ${item.title}`);
    const remove = document.createElement('button'); remove.className = 'button button-danger'; remove.type = 'button'; remove.dataset.delete = item.id; remove.textContent = 'Delete'; remove.setAttribute('aria-label',`Delete ${item.title}`);
    controls.append(edit,remove); actions.append(controls); row.append(product,price,state,posted,actions);
    return row;
  }));
}
async function load() {
  status.textContent = 'Loading your listings…';
  document.getElementById('listings-retry').hidden = true;
  try {
    items = await getMyItems(); render(); status.textContent = '';
  } catch(error) {
    if (authRedirect(error)) return;
    status.textContent = error.message || 'Unable to load your listings.';
    document.getElementById('listings-retry').hidden = false;
  }
}
function selectTab(button) { filter = button.dataset.status; render(); }
tabs.addEventListener('click',event => { const button=event.target.closest('button'); if(button) selectTab(button); });
tabs.addEventListener('keydown',event => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...tabs.querySelectorAll('button')];
  const index = buttons.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
  selectTab(buttons[next]); buttons[next].focus();
});
rows.addEventListener('change',async event => {
  const select = event.target.closest('select'); if (!select) return;
  const id = Number(select.closest('tr').dataset.id);
  const item = items.find(entry => entry.id === id);
  const previous = item.status; select.disabled = true;
  try {
    const updated = await updateItemStatus(id,select.value);
    items = items.map(entry => entry.id === id ? updated : entry); render(); showFeedback('Listing status updated.');
  } catch(error) {
    if (authRedirect(error)) return;
    select.value = previous; select.disabled = false; showFeedback(error.message,true);
  }
});
rows.addEventListener('click',event => {
  const button = event.target.closest('[data-delete]'); if (!button) return;
  deleting = items.find(item => item.id === Number(button.dataset.delete));
  document.getElementById('delete-description').textContent = `“${deleting.title}” will be permanently removed. This cannot be undone.`;
  document.getElementById('delete-error').textContent = ''; dialog.showModal();
});
document.getElementById('delete-form').addEventListener('submit',async event => {
  if (event.submitter?.value !== 'delete') return;
  event.preventDefault();
  if (event.submitter.disabled) return;
  const buttons = [...dialog.querySelectorAll('button')]; buttons.forEach(button => {button.disabled = true;});
  const id = deleting.id;
  try {
    await deleteItem(id); items = items.filter(item => item.id !== id);
    dialog.close(); render(); showFeedback('Listing deleted.');
    document.getElementById(`tab-${filter}`).focus();
  } catch(error) {
    if (!authRedirect(error)) document.getElementById('delete-error').textContent = error.message;
  } finally { buttons.forEach(button => {button.disabled = false;}); }
});
document.getElementById('listings-retry').addEventListener('click',load);
load();
