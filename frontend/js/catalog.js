import { getItems } from './api.js';
import { renderCards, renderShell } from './components.js';

renderShell();
if (window.matchMedia('(max-width: 800px)').matches) document.querySelector('.filter-disclosure').open = false;
const isSearch = document.body.dataset.page === 'search';
const filtersElement = document.getElementById('filters');
const grid = document.getElementById('product-grid');
const status = document.getElementById('catalog-status');
const count = document.getElementById('result-count');
const empty = document.getElementById('empty-state');
const sortSelect = document.getElementById('sort-select');
const searchInput = document.querySelector('.toolbar-search input');
const queryLabel = document.getElementById('query-label');
const loadMore = document.getElementById('load-more');
const visibleCount = document.getElementById('visible-count');
const PAGE_SIZE = 50;
let nextPage = 1;
let total = 0;
let loadingPage = null;
let loadedPages = new Set();

const categoryOptions = [
  ['','All Categories'],['textbooks','Textbooks'],['uniforms','Uniforms'],
  ['study_tools','Study Supplies'],['student_items','Student Essentials'],['other','Others']
];
const conditionOptions = [['','Any Condition'],['new','Like New'],['good','Good'],['fair','Fair']];
const allowedSorts = new Set(['newest','price_asc','price_desc']);
let state;
let requestId = 0;
let priceTimer;

function readState() {
  const params = new URLSearchParams(window.location.search);
  return {
    q:isSearch?(params.get('q') || '').trim():'',
    category:categoryOptions.some(([value]) => value === params.get('category')) ? (params.get('category') || '') : '',
    condition:conditionOptions.some(([value]) => value === params.get('condition')) ? (params.get('condition') || '') : '',
    min_price:params.get('min_price') || '',
    max_price:params.get('max_price') || '',
    sort:allowedSorts.has(params.get('sort')) ? params.get('sort') : 'newest'
  };
}

function radioGroup(name,title,options) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'filter-group';
  const legend = document.createElement('legend');
  legend.textContent = title;
  fieldset.append(legend);
  options.forEach(([value,label]) => {
    const option = document.createElement('label');
    option.className = 'filter-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    input.checked = state[name] === value;
    option.append(input,document.createTextNode(label));
    fieldset.append(option);
  });
  return fieldset;
}

function buildFilters() {
  filtersElement.replaceChildren();
  filtersElement.append(radioGroup('category','Category',categoryOptions));
  const priceGroup = document.createElement('fieldset');
  priceGroup.className = 'filter-group';
  const priceLegend = document.createElement('legend');
  priceLegend.textContent = 'Price Range';
  const row = document.createElement('div');
  row.className = 'price-inputs';
  const min = document.createElement('input');
  min.type = 'number'; min.name = 'min_price'; min.min = '0'; min.step = '1000'; min.placeholder = 'Min';
  min.setAttribute('aria-label','Minimum price in VND'); min.value = state.min_price;
  const max = document.createElement('input');
  max.type = 'number'; max.name = 'max_price'; max.min = '0'; max.step = '1000'; max.placeholder = 'Max';
  max.setAttribute('aria-label','Maximum price in VND'); max.value = state.max_price;
  row.append(min,document.createTextNode('–'),max);
  const hint = document.createElement('p'); hint.className = 'filter-hint'; hint.textContent = 'Prices in VND';
  const error = document.createElement('p'); error.className = 'filter-error'; error.id = 'price-error'; error.setAttribute('role','alert');
  priceGroup.append(priceLegend,row,hint,error);
  filtersElement.append(priceGroup,radioGroup('condition','Condition',conditionOptions));
  const clear = document.createElement('button');
  clear.type = 'button'; clear.className = 'button button-outline clear-filter-button'; clear.textContent = 'Clear Filters';
  clear.addEventListener('click',clearAll);
  filtersElement.append(clear);
}

function writeUrl() {
  const params = new URLSearchParams();
  if (isSearch && state.q) params.set('q',state.q);
  ['category','min_price','max_price','condition'].forEach(key => { if(state[key] !== '') params.set(key,state[key]); });
  if (state.sort !== 'newest') params.set('sort',state.sort);
  const query = params.toString();
  history.replaceState(null,'',`${window.location.pathname}${query?'?'+query:''}`);
}

function updateHeading() {
  if (isSearch) {
    queryLabel.textContent = state.q ? `for “${state.q}”` : '';
    searchInput.value = state.q;
  }
  sortSelect.value = state.sort;
}

function validPriceRange() {
  const min = state.min_price === '' ? 0 : Number(state.min_price);
  const max = state.max_price === '' ? Infinity : Number(state.max_price);
  let message = '';
  if (!Number.isFinite(min) || min < 0 || Number.isNaN(max) || max < 0) message = 'Enter a valid price of 0 VND or more.';
  else if (min > max) message = 'Minimum price cannot exceed maximum price.';
  document.getElementById('price-error').textContent = message;
  return !message;
}

function updateLoadMore() {
  const shown = grid.querySelectorAll('.product-card').length;
  visibleCount.textContent = total ? `Showing ${shown} of ${total} listings` : '';
  loadMore.hidden = !total || shown >= total;
}

async function fetchPage(page, currentRequest) {
  if (currentRequest !== requestId) return;

  // Prevent duplicate or concurrent requests
  if (loadingPage !== null || loadedPages.has(page)) return;

  loadingPage = page;
  loadMore.disabled = true;
  loadMore.textContent = 'Loading…';

  try {
    const result = await getItems({
      ...state,
      status: 'available',
      page,
      page_size: PAGE_SIZE
    });

    if (currentRequest !== requestId) return;

    if (
      !result ||
      !Array.isArray(result.items) ||
      !Number.isFinite(Number(result.total))
    ) {
      throw new Error('Invalid listing response. Please try again.');
    }

    // Prevent appending the same page twice
    if (loadedPages.has(page)) return;

    total = Number(result.total);

    if (page === 1) {
      renderCards(grid, result.items);
    } else {
      const additions = document.createElement('div');
      renderCards(additions, result.items);
      grid.append(...additions.children);
    }

    loadedPages.add(page);
    nextPage = page + 1;

    count.textContent = `(${total})`;
    empty.hidden = total > 0;
    status.textContent = '';

    updateLoadMore();

  } catch (error) {
    if (currentRequest !== requestId) return;

    if (page === 1) {
      grid.replaceChildren();
      total = 0;
      count.textContent = '';
      empty.hidden = true;
      updateLoadMore();
    }

    status.textContent =
      error.message || 'Unable to load listings. Please try again.';

    const retry = document.createElement('button');
    retry.className = 'button button-outline';
    retry.type = 'button';
    retry.textContent = 'Retry';

    retry.addEventListener('click', () => {
      if (loadingPage !== null) return;

      if (page === 1) {
        loadProducts();
      } else {
        fetchPage(page, currentRequest);
      }
    });

    status.append(document.createElement('br'), retry);

  } finally {
    // Only the active request can release the lock
    if (currentRequest === requestId) {
      loadingPage = null;
      loadMore.disabled = false;
      loadMore.textContent = 'Load More';
    }
  }
}

async function loadProducts() {
  updateHeading();
  const currentRequest = ++requestId;
  loadingPage = null;
  loadedPages = new Set();
  nextPage = 1;
  total = 0;
  loadMore.hidden = true;
  visibleCount.textContent = '';
  if (!validPriceRange()) {
    grid.replaceChildren();
    count.textContent = '';
    empty.hidden = true;
    status.textContent = '';
    return;
  }
  status.textContent = isSearch ? 'Searching listings…' : 'Loading listings…';
  empty.hidden = true;
  await fetchPage(1,currentRequest);
}

loadMore.addEventListener('click', () => {
  if (
    loadingPage !== null ||
    loadMore.disabled ||
    loadMore.hidden ||
    loadedPages.has(nextPage)
  ) return;

  fetchPage(nextPage, requestId);
});

function clearAll() {
  clearTimeout(priceTimer);
  state = {q:'',category:'',condition:'',min_price:'',max_price:'',sort:'newest'};
  buildFilters();
  writeUrl();
  loadProducts();
}

state = readState();
buildFilters();
loadProducts();
filtersElement.addEventListener('change',event => {
  if (event.target.matches('input[type="radio"]')) {
    state[event.target.name] = event.target.value;
    writeUrl();
    loadProducts();
  }
});
filtersElement.addEventListener('input',event => {
  if (event.target.matches('input[type="number"]')) {
    state[event.target.name] = event.target.value;
    clearTimeout(priceTimer);
    priceTimer = setTimeout(() => { if (validPriceRange()) writeUrl(); loadProducts(); },220);
  }
});
sortSelect.addEventListener('change',() => { state.sort = sortSelect.value; writeUrl(); loadProducts(); });
document.getElementById('clear-empty').addEventListener('click',clearAll);
window.addEventListener('popstate',() => { clearTimeout(priceTimer); state = readState(); buildFilters(); loadProducts(); });
