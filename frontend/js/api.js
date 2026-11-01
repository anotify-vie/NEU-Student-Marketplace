import { mockItems } from './mock-data.js';

// FE2 can keep this public interface and add the remaining auth/write methods.
// Change to 'real' after the backend is available and the contract is approved.
export const API_MODE = 'mock';
export const API_BASE_URL = 'http://127.0.0.1:8000/api';
export const MOCK_SESSION_KEY = 'neu-marketplace-demo-user-id';

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function searchMockItems(query) {
  const keyword = String(query.q || '').trim().toLocaleLowerCase();
  const min = numberOrNull(query.min_price);
  const max = numberOrNull(query.max_price);
  let items = mockItems.filter(item => {
    if (item.status !== (query.status || 'available')) return false;
    if (keyword && !`${item.title} ${item.description}`.toLocaleLowerCase().includes(keyword)) return false;
    if (query.category && item.category !== query.category) return false;
    if (query.condition && item.condition !== query.condition) return false;
    if (min !== null && item.price < min) return false;
    if (max !== null && item.price > max) return false;
    return true;
  });
  const sort = query.sort || 'newest';
  if (sort === 'price_asc') items.sort((a,b) => a.price - b.price || b.created_at.localeCompare(a.created_at));
  else if (sort === 'price_desc') items.sort((a,b) => b.price - a.price || b.created_at.localeCompare(a.created_at));
  else items.sort((a,b) => b.created_at.localeCompare(a.created_at));
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.page_size) || 50));
  return {items:items.slice((page-1)*pageSize,page*pageSize),total:items.length,page,page_size:pageSize};
}

export async function getItems(query = {}) {
  if (API_MODE === 'mock') return searchMockItems(query);
  const parameters = new URLSearchParams();
  Object.entries(query).forEach(([key,value]) => { if (value !== '' && value !== null && value !== undefined) parameters.set(key,String(value)); });
  const response = await fetch(`${API_BASE_URL}/items?${parameters}`, {credentials:'include'});
  if (!response.ok) throw new Error('Unable to load listings. Please try again.');
  return response.json();
}

export async function getCurrentUser() {
  if (API_MODE === 'mock') {
    try {
      const id = Number(sessionStorage.getItem(MOCK_SESSION_KEY));
      return Number.isSafeInteger(id) && id > 0 ? {id} : null;
    } catch { return null; }
  }
  const response = await fetch(`${API_BASE_URL}/auth/me`, {credentials:'include'});
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Unable to check your account. Please try again.');
  return response.json();
}
