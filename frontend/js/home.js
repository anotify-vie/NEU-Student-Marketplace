import { getItems } from './api.js';
import { renderCards, renderShell } from './components.js';

renderShell();
const grid = document.getElementById('recent-grid');
const status = document.getElementById('recent-status');
async function loadRecent() {
  status.textContent = 'Loading listings…';
  grid.replaceChildren();
  try {
    const result = await getItems({sort:'newest',status:'available',page_size:4});
    renderCards(grid,result.items);
    status.textContent = result.items.length ? '' : 'No listings yet. Check back soon.';
  } catch(error) {
    status.textContent = error.message || 'Unable to load listings. Please try again.';
    const retry = document.createElement('button');
    retry.className = 'button button-outline';
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.addEventListener('click',loadRecent,{once:true});
    status.append(document.createElement('br'),retry);
  }
}
loadRecent();
