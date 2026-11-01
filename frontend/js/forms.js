import { API_MODE, login, register, getCurrentUser, getItem, uploadImage, createItem, updateItem } from './api.js';
import { renderShell, resolveAssetUrl } from './components.js';

renderShell();
const page = document.body.dataset.page;
const form = document.getElementById('page-form');
const message = document.getElementById('form-message');
const isAuth = page === 'login' || page === 'register';
const isEdit = page === 'edit-listing';
const params = new URLSearchParams(location.search);
const images = [];
let item;
let pendingImages = 0;

// Resolve against the frontend root, including when hosted under a subdirectory.
function safeReturnTo(raw) {
  const root = new URL('../',import.meta.url);
  const fallback = new URL('index.html',root);
  if (!raw || /[\\\u0000-\u001f]/.test(raw) || raw.startsWith('//')) return fallback.href;
  try {
    const url = new URL(raw,location.href);
    const route = url.pathname.slice(root.pathname.length);
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname) || url.username || url.password ||
        !/^(index\.html|pages\/[a-z-]+\.html)$/.test(route) || /^pages\/(login|register)\.html$/.test(route)) return fallback.href;
    return url.href;
  } catch { return fallback.href; }
}

function fieldError(name,text = '') {
  const input = form.elements[name];
  document.getElementById(`${name}-error`).textContent = text;
  input.setAttribute('aria-invalid',String(Boolean(text)));
}
function validate(names) {
  let first;
  for (const name of names) {
    const input = form.elements[name];
    const value = input.value.trim();
    let error = '';
    if (!value) error = 'This field is required.';
    else if (name === 'email' && input.validity.typeMismatch) error = 'Enter a valid email address.';
    else if (name === 'display_name' && (value.length < 2 || value.length > 80)) error = 'Enter a name between 2 and 80 characters.';
    else if (name === 'password' && page === 'register' && input.value.length < 8) error = 'Use at least 8 characters.';
    else if (name === 'confirm_password' && input.value !== form.elements.password.value) error = 'Passwords do not match.';
    else if (name === 'price' && (!Number.isSafeInteger(Number(value)) || Number(value) < 0)) error = 'Enter a whole VND amount of 0 or more.';
    else if (input.maxLength > 0 && value.length > input.maxLength) error = `Use no more than ${input.maxLength} characters.`;
    fieldError(name,error);
    if (error) first ||= input;
  }
  if (!isAuth && !images.length) {
    fieldError('images','Add at least one product image.');
    first ||= form.elements.images;
  }
  first?.focus();
  return !first;
}
function feedback(text,error = false) {
  message.textContent = text;
  message.classList.toggle('is-error',error);
  message.focus();
}
function redirectToLogin() {
  const url = new URL('login.html',location.href);
  url.searchParams.set('returnTo',location.pathname + location.search);
  location.replace(url.href);
}

for (const input of form.querySelectorAll('input,select,textarea')) {
  input.setAttribute('aria-describedby',input.id === 'images' ? 'images-hint images-error' : `${input.name}-error`);
  input.addEventListener('input',() => { fieldError(input.name); message.textContent = ''; });
}
for (const button of document.querySelectorAll('.password-toggle')) {
  button.addEventListener('click',() => {
    const input = document.getElementById(button.getAttribute('aria-controls'));
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Hide' : 'Show';
    button.setAttribute('aria-pressed',String(visible));
    button.setAttribute('aria-label',`${visible ? 'Hide' : 'Show'} ${input.name === 'confirm_password' ? 'confirm password' : 'password'}`);
  });
}

function renderImages() {
  const previews = document.getElementById('image-previews');
  previews.replaceChildren(...images.map((entry,index) => {
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    image.src = entry.preview;
    image.alt = `Product image ${index + 1}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'remove-image';
    button.textContent = '×';
    button.setAttribute('aria-label',`Remove image ${index + 1}`);
    button.addEventListener('click',() => {
      if (entry.file) URL.revokeObjectURL(entry.preview);
      images.splice(index,1);
      fieldError('images');
      renderImages();
      (previews.querySelector('button') || form.elements.images).focus();
    });
    figure.append(image,button);
    return figure;
  }));
}

if (isAuth) {
  const switchLink = document.getElementById('auth-switch');
  const returnTo = safeReturnTo(params.get('returnTo'));
  const switchUrl = new URL(switchLink.href);
  switchUrl.searchParams.set('returnTo',new URL(returnTo).pathname + new URL(returnTo).search);
  switchLink.href = switchUrl.href;
  const demo = document.querySelector('.demo-note');
  if (demo) demo.hidden = API_MODE !== 'mock';
  if (params.get('registered') === '1') feedback('Account created. Please log in.');
} else {
  form.elements.images.addEventListener('change',async event => {
    const files = [...event.target.files];
    event.target.value = '';
    if (images.length + files.length > 5) return fieldError('images','You can add at most 5 images.');
    if (files.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024)) return fieldError('images','Choose JPEG, PNG or WebP images, up to 5 MB each.');
    // Decode before accepting a file so renamed/non-image files cannot enter the preview.
    const selected = files.map(file => ({file,preview:URL.createObjectURL(file)}));
    pendingImages++;
    try {
      await Promise.all(selected.map(entry => {
        const image = new Image();
        image.src = entry.preview;
        return image.decode();
      }));
      if (images.length + selected.length > 5) throw new Error('Too many images');
      images.push(...selected);
      fieldError('images');
      renderImages();
    } catch {
      selected.forEach(entry => URL.revokeObjectURL(entry.preview));
      fieldError('images','Unable to add these images. Choose valid images and keep the total at 5 or fewer.');
    } finally { pendingImages--; }
  });
  window.addEventListener('pagehide',() => images.filter(entry => entry.file).forEach(entry => URL.revokeObjectURL(entry.preview)));
  document.getElementById('retry-load').addEventListener('click',loadListing);
  loadListing();
}

async function loadListing() {
  const status = document.getElementById('page-status');
  const error = document.getElementById('page-error');
  status.textContent = 'Loading your listing…';
  error.hidden = true;
  form.hidden = true;
  try {
    const user = await getCurrentUser();
    if (!user) return redirectToLogin();
    if (isEdit) {
      item = await getItem(params.get('id'));
      if (item.seller_id !== user.id) {
        const url = new URL('product-detail.html',location.href);
        url.searchParams.set('id',item.id);
        url.searchParams.set('notice','owner-only');
        location.replace(url.href);
        return;
      }
      for (const name of ['title','category','price','condition','description','location']) form.elements[name].value = item[name];
      images.splice(0,images.length,...item.image_urls.map(url => ({url,preview:resolveAssetUrl(url)})));
      renderImages();
      document.getElementById('cancel-link').href = `product-detail.html?id=${item.id}`;
    }
    status.textContent = '';
    form.hidden = false;
  } catch(error) {
    status.textContent = '';
    document.getElementById('page-error-message').textContent = error.message || 'Unable to load this listing.';
    document.getElementById('page-error').hidden = false;
  }
}

form.addEventListener('submit',async event => {
  event.preventDefault();
  if (pendingImages) return feedback('Please wait for the image previews to finish.',true);
  const names = isAuth ? ['email','password',...(page === 'register' ? ['display_name','confirm_password'] : [])] : ['title','category','price','condition','description','location'];
  if (!validate(names)) return;
  const submit = form.querySelector('[type="submit"]');
  if (submit.disabled) return;
  const label = submit.textContent;
  const controls = [...form.querySelectorAll('input,select,textarea,button')];
  controls.forEach(control => { control.disabled = true; });
  form.setAttribute('aria-busy','true');
  submit.textContent = isAuth ? 'Please wait…' : 'Saving…';
  try {
    const values = Object.fromEntries(names.map(name => [name,name.includes('password') ? form.elements[name].value : form.elements[name].value.trim()]));
    if (page === 'login') {
      await login(values);
      location.assign(safeReturnTo(params.get('returnTo')));
    } else if (page === 'register') {
      const {display_name,email,password} = values;
      await register({display_name,email,password});
      const url = new URL('login.html',location.href);
      url.searchParams.set('registered','1');
      url.searchParams.set('returnTo',safeReturnTo(params.get('returnTo')));
      location.assign(url.href);
    } else {
      if (!await getCurrentUser()) return redirectToLogin();
      values.price = Number(values.price);
      // Freeze controls while files upload; retries reuse successful upload URLs.
      const imageUrls = [];
      for (const entry of images) {
        entry.url ||= await uploadImage(entry.file);
        imageUrls.push(entry.url);
      }
      const saved = await (isEdit ? updateItem(item.id,{...values,image_urls:imageUrls}) : createItem({...values,image_urls:imageUrls}));
      form.hidden = true;
      document.getElementById('view-listing').href = `product-detail.html?id=${saved.id}`;
      document.getElementById('listing-success').hidden = false;
      document.getElementById('view-listing').focus();
    }
  } catch(error) {
    if (!isAuth && error.status === 401) return redirectToLogin();
    feedback(error.message || 'Unable to save. Please try again.',true);
  } finally {
    controls.forEach(control => { control.disabled = false; });
    submit.textContent = label;
    form.removeAttribute('aria-busy');
  }
});
