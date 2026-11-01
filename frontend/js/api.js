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

function searchMockItems(query, catalogue) {
  const keyword = String(query.q || '').trim().toLocaleLowerCase();
  const min = numberOrNull(query.min_price);
  const max = numberOrNull(query.max_price);
  let items = catalogue.filter(item => {
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
  if (API_MODE === 'mock') return searchMockItems(query, await allMockItems());
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
    const item = (await allMockItems()).find(entry => entry.id === itemId);
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
    const user = mockUsers.find(entry => entry.id === userId) || mockAccounts().find(entry => entry.id === userId);
    if (!user) throw new Error('This profile could not be found.');
    const {email, password_hash, salt, ...publicUser} = user;
    return {...publicUser,...storedMockProfile(userId)};
  }
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {credentials:'include'});
  if (response.status === 404) throw new Error('This profile could not be found.');
  if (!response.ok) throw new Error('Unable to load this profile. Please try again.');
  return response.json();
}

export async function getUserStats(id) {
  if (API_MODE !== 'mock') return null; // A public statistics endpoint is not defined in API v1.
  const items = (await allMockItems()).filter(item => item.seller_id === Number(id));
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
    try {
      const id = Number(sessionStorage.getItem(MOCK_SESSION_KEY));
      return id ? await getUser(id) : null;
    }
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

// Mock account records contain password hashes only. These fixtures are demo accounts.
const accountsKey = 'neu-marketplace-demo-accounts-v1';
const demoHash = 'bffbc8471b56fc97f58cbdc1e434d1bbc7cb3ec29974f48adf3984376aff987d';
function mockAccounts() {
  const demo = [{id:1,email:'buyer@example.com'},{id:2,email:'seller@example.com'}]
    .map(account => ({...account,salt:'neu-marketplace-demo',password_hash:demoHash}));
  return [...demo,...JSON.parse(localStorage.getItem(accountsKey) || '[]')];
}

async function passwordHash(password,salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256);
  return Array.from(new Uint8Array(bits),byte => byte.toString(16).padStart(2,'0')).join('');
}

async function request(route,options = {}) {
  let response;
  try { response = await fetch(`${API_BASE_URL}${route}`,{credentials:'include',...options}); }
  catch { throw new Error('Unable to reach the server. Please try again.'); }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(typeof body?.detail === 'string' ? body.detail : 'The request failed. Please check your input and try again.');
    error.status = response.status;
    throw error;
  }
  return body;
}
function jsonRequest(method,body) {
  return {method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
}

export async function login({email,password}) {
  if (API_MODE !== 'mock') return request('/auth/login',jsonRequest('POST',{email,password}));
  const account = mockAccounts().find(entry => entry.email === email.trim().toLowerCase());
  if (!account || await passwordHash(password,account.salt) !== account.password_hash) throw new Error('Incorrect email or password.');
  sessionStorage.setItem(MOCK_SESSION_KEY,String(account.id));
  return getUser(account.id);
}

export async function register({display_name,email,password}) {
  if (API_MODE !== 'mock') return request('/auth/register',jsonRequest('POST',{display_name,email,password}));
  const accounts = mockAccounts();
  email = email.trim().toLowerCase();
  if (accounts.some(account => account.email === email)) throw new Error('An account with this email already exists.');
  const id = Math.max(...mockUsers.map(user => user.id),...accounts.map(user => user.id)) + 1;
  const salt = crypto.randomUUID();
  const user = {id,display_name,email,salt,password_hash:await passwordHash(password,salt),avatar_url:null,joined_at:new Date().toISOString()};
  localStorage.setItem(accountsKey,JSON.stringify([...accounts.filter(account => ![1,2].includes(account.id)),user]));
  return getUser(id);
}

// IndexedDB keeps up to five 5 MB images per listing without localStorage's small quota.
let mockDatabase;
function itemStore(method,value) {
  mockDatabase ||= new Promise((resolve,reject) => {
    const open = indexedDB.open('neu-marketplace-demo',1);
    open.onupgradeneeded = () => open.result.createObjectStore('items',{keyPath:'id'});
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(new Error('Unable to open demo storage. Please allow browser storage and reload.'));
  });
  return mockDatabase.then(database => new Promise((resolve,reject) => {
    const transaction = database.transaction('items',method === 'getAll' ? 'readonly' : 'readwrite');
    const operation = transaction.objectStore('items')[method](...(value === undefined ? [] : [value]));
    transaction.oncomplete = () => resolve(operation.result);
    transaction.onabort = () => reject(new Error('Unable to save demo data. Check available browser storage and try again.'));
  }));
}
async function allMockItems() {
  return [...new Map([...mockItems,...await itemStore('getAll')].map(item => [item.id,item])).values()];
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const error = new Error('Please log in to continue.');
    error.status = 401;
    throw error;
  }
  return user;
}

export async function uploadImage(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) throw new Error('Choose JPEG, PNG or WebP images, up to 5 MB each.');
  if (API_MODE !== 'mock') {
    const body = new FormData();
    body.append('file',file);
    return (await request('/uploads',{method:'POST',body})).image_url;
  }
  await requireUser();
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read this image. Please select it again.'));
    reader.readAsDataURL(file);
  });
}

function listingValues(values) {
  const data = Object.fromEntries(['title','category','price','condition','description','location','image_urls'].map(key => [key,values[key]]));
  if (!data.title?.trim() || !data.description?.trim() || !data.location?.trim() ||
      !['textbooks','uniforms','study_tools','student_items','other'].includes(data.category) ||
      !['new','good','fair'].includes(data.condition) || !Number.isSafeInteger(data.price) || data.price < 0 ||
      !Array.isArray(data.image_urls) || data.image_urls.length < 1 || data.image_urls.length > 5) throw new Error('Please complete all listing fields and include 1–5 images.');
  return data;
}
export async function createItem(values) {
  const data = listingValues(values);
  if (API_MODE !== 'mock') return request('/items',jsonRequest('POST',data));
  const user = await requireUser();
  const item = {...data,id:Math.max(0,...(await allMockItems()).map(entry => entry.id)) + 1,seller_id:user.id,status:'available',created_at:new Date().toISOString()};
  await itemStore('put',item);
  return item;
}
export async function updateItem(id,values) {
  const data = listingValues(values);
  if (API_MODE !== 'mock') return request(`/items/${Number(id)}`,jsonRequest('PATCH',data));
  const user = await requireUser();
  const item = await getItem(id);
  if (item.seller_id !== user.id) throw new Error('You can only edit your own listings.');
  const updated = {...item,...data};
  await itemStore('put',updated);
  return updated;
}
