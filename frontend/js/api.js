import { mockItems } from './mock-data.js';
import { mockUsers } from './mock-users.js';

// FE2 can keep this public interface and add the remaining auth/write methods.
// Change to 'real' after the backend is available and the contract is approved.
export const API_MODE = 'mock';
export const API_BASE_URL = 'http://127.0.0.1:8000/api';
export const MOCK_SESSION_KEY = 'neu-marketplace-demo-user-id';
export const MOCK_CONVERSATIONS_KEY = 'neu-marketplace-demo-conversations-v1';
let memoryConversations = [];

function mockConversations() {
  try {
    const raw = localStorage.getItem(MOCK_CONVERSATIONS_KEY);
    if (raw === null) return [...memoryConversations];
    const saved = JSON.parse(raw);
    return Array.isArray(saved) ? saved.filter(entry => Number.isSafeInteger(entry.id) && Number.isSafeInteger(entry.item_id) && Number.isSafeInteger(entry.buyer_id) && Number.isSafeInteger(entry.seller_id)) : [];
  } catch { return [...memoryConversations]; }
}

function saveMockConversations(conversations) {
  memoryConversations = conversations.map(entry => ({...entry}));
  try { localStorage.setItem(MOCK_CONVERSATIONS_KEY,JSON.stringify(conversations)); } catch { /* Keep mock conversations in memory. */ }
}

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

export async function getItem(id) {
  const itemId = Number(id);
  if (!Number.isSafeInteger(itemId) || itemId < 1) throw new Error('This listing could not be found.');
  if (API_MODE === 'mock') {
    const item = mockItems.find(entry => entry.id === itemId);
    if (!item) throw new Error('This listing could not be found.');
    return {...item,image_urls:[...item.image_urls]};
  }
  const response = await fetch(`${API_BASE_URL}/items/${itemId}`, {credentials:'include'});
  if (response.status === 404) throw new Error('This listing could not be found.');
  if (!response.ok) throw new Error('Unable to load this listing. Please try again.');
  return response.json();
}

function storedMockProfile(id) {
  try {
    const saved = JSON.parse(localStorage.getItem(`neu-marketplace-demo-profile-${id}`) || '{}');
    return Object.fromEntries(['display_name','faculty','cohort','bio'].filter(key => typeof saved[key] === 'string').map(key => [key,saved[key]]));
  }
  catch { return {}; }
}

export async function getUser(id) {
  const userId = Number(id);
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error('This profile could not be found.');
  if (API_MODE === 'mock') {
    const user = mockUsers.find(entry => entry.id === userId);
    if (!user) throw new Error('This profile could not be found.');
    return {...user,...storedMockProfile(userId)};
  }
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {credentials:'include'});
  if (response.status === 404) throw new Error('This profile could not be found.');
  if (!response.ok) throw new Error('Unable to load this profile. Please try again.');
  return response.json();
}

export async function getUserStats(id) {
  if (API_MODE !== 'mock') return null; // A public statistics endpoint is not defined in API v1.
  const items = mockItems.filter(item => item.seller_id === Number(id));
  return {total:items.length,available:items.filter(item => item.status === 'available').length,reserved:items.filter(item => item.status === 'reserved').length,sold:items.filter(item => item.status === 'sold').length};
}

export async function updateProfile(id,values) {
  if (API_MODE !== 'mock') throw new Error('Profile editing is waiting for an approved API endpoint.');
  const userId = Number(id);
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== userId) throw new Error('Please log in as the profile owner to edit this profile.');
  const user = await getUser(userId);
  const updated = {...user,display_name:values.display_name,faculty:values.faculty,cohort:values.cohort,bio:values.bio};
  localStorage.setItem(`neu-marketplace-demo-profile-${userId}`,JSON.stringify({display_name:updated.display_name,faculty:updated.faculty,cohort:updated.cohort,bio:updated.bio}));
  return updated;
}

export async function getCurrentUser() {
  if (API_MODE === 'mock') {
    try { return mockUsers.find(user => user.id === Number(sessionStorage.getItem(MOCK_SESSION_KEY))) || null; }
    catch { return null; }
  }
  const response = await fetch(`${API_BASE_URL}/auth/me`, {credentials:'include'});
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Unable to check your account. Please try again.');
  return response.json();
}

export async function openConversation(itemId) {
  if (API_MODE === 'mock') {
    const user = await getCurrentUser();
    if (!user) throw new Error('Please log in to contact the seller.');
    const item = await getItem(itemId);
    if (item.status === 'sold') throw new Error('This item has already been sold.');
    if (item.seller_id === user.id) throw new Error('You cannot chat about your own listing.');
    const conversations = mockConversations();
    const existing = conversations.find(entry => entry.buyer_id === user.id && entry.item_id === item.id);
    if (existing) return {...existing};
    const nextId = conversations.reduce((highest,entry) => Math.max(highest,entry.id),1000) + 1;
    const conversation = {id:nextId,item_id:item.id,buyer_id:user.id,seller_id:item.seller_id,updated_at:new Date().toISOString()};
    saveMockConversations([...conversations,conversation]);
    return {...conversation};
  }
  const response = await fetch(`${API_BASE_URL}/conversations`, {method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({item_id:Number(itemId)})});
  if (!response.ok) throw new Error('Unable to open the conversation. Please try again.');
  return response.json();
}

export async function getConversations() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Please log in to view conversations.');
  if (API_MODE === 'mock') return mockConversations().filter(entry => entry.buyer_id === user.id || entry.seller_id === user.id);
  const response = await fetch(`${API_BASE_URL}/conversations`, {credentials:'include'});
  if (!response.ok) throw new Error('Unable to load conversations. Please try again.');
  return response.json();
}
