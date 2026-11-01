import { API_MODE, getCurrentUser, getUser, getUserStats, updateProfile } from './api.js';
import { renderShell, resolveAssetUrl } from './components.js';

renderShell();
const params = new URLSearchParams(location.search);
const explicitId = params.get('id');
const statusElement = document.getElementById('profile-status');
const content = document.getElementById('profile-content');
const errorPanel = document.getElementById('profile-error');
const editButton = document.getElementById('edit-profile-button');
const editPanel = document.getElementById('edit-panel');
const form = document.getElementById('profile-form');
const profileMessage = document.getElementById('profile-message');
let user;

function showError(message) {
  statusElement.textContent = '';
  content.hidden = true;
  document.getElementById('profile-error-message').textContent = message;
  errorPanel.hidden = false;
}

function text(id,value,fallback='Not provided') { document.getElementById(id).textContent = value || fallback; }

function renderAvatar(profile) {
  const avatar = document.getElementById('profile-avatar');
  avatar.replaceChildren();
  if (profile.avatar_url) {
    const image = document.createElement('img');
    image.src = resolveAssetUrl(profile.avatar_url);
    image.alt = '';
    avatar.append(image);
  } else {
    avatar.textContent = profile.display_name.split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
  }
}

function renderProfile(profile,stats) {
  document.title = `${profile.display_name} | NEU Student Marketplace`;
  renderAvatar(profile);
  text('profile-name',profile.display_name);
  document.getElementById('profile-subtitle').textContent = [profile.faculty,profile.cohort].filter(Boolean).join(' · ') || 'NEU student';
  text('profile-bio',profile.bio,'This student has not added an introduction yet.');
  text('profile-faculty',profile.faculty);
  text('profile-cohort',profile.cohort);
  text('profile-campus',profile.campus);
  text('profile-joined',profile.joined_at ? new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(new Date(profile.joined_at)) : null);
  ['total','available','reserved','sold'].forEach(key => { document.getElementById(`stat-${key}`).textContent = stats?.[key] ?? '—'; });
}

function clearErrors() {
  ['name','faculty','cohort','bio'].forEach(key => {
    document.getElementById(`${key}-error`).textContent = '';
    document.getElementById(`edit-${key === 'name' ? 'name' : key}`).removeAttribute('aria-invalid');
  });
}

function openEditor() {
  clearErrors();
  profileMessage.textContent = '';
  form.elements.display_name.value = user.display_name || '';
  form.elements.faculty.value = user.faculty || '';
  form.elements.cohort.value = user.cohort || '';
  form.elements.bio.value = user.bio || '';
  editPanel.hidden = false;
  editPanel.scrollIntoView({behavior:'smooth',block:'start'});
  form.elements.display_name.focus({preventScroll:true});
}

function closeEditor() {
  editPanel.hidden = true;
  clearErrors();
  editButton.focus();
}

function validate(values) {
  const errors = {};
  if (values.display_name.length < 2 || values.display_name.length > 80) errors.name = 'Enter a name between 2 and 80 characters.';
  if (values.faculty.length < 2 || values.faculty.length > 80) errors.faculty = 'Enter your faculty.';
  if (!/^K\d{2,3}$/i.test(values.cohort)) errors.cohort = 'Use a cohort such as K64.';
  if (values.bio.length > 300) errors.bio = 'Keep your introduction under 300 characters.';
  clearErrors();
  Object.entries(errors).forEach(([key,message]) => {
    document.getElementById(`${key}-error`).textContent = message;
    document.getElementById(`edit-${key}`).setAttribute('aria-invalid','true');
  });
  if (Object.keys(errors).length) document.getElementById(`edit-${Object.keys(errors)[0]}`).focus();
  return Object.keys(errors).length === 0;
}

async function init() {
  try {
    let profileId = explicitId;
    let currentUser = null;
    if (API_MODE === 'real') {
      if (profileId === null) {
        currentUser = await getCurrentUser();
        if (!currentUser) {
          const returnUrl = new URL('profile.html',location.href);
          location.assign(`login.html?returnTo=${encodeURIComponent(returnUrl.pathname)}`);
          return;
        }
      } else {
        try { currentUser = await getCurrentUser(); } catch { /* Public profiles remain readable. */ }
      }
      if (profileId === null) profileId = currentUser.id;
    } else if (profileId === null) {
      profileId = 1; // The no-ID route is the editable demo owner's profile.
    }
    user = await getUser(profileId);
    const stats = await getUserStats(user.id);
    renderProfile(user,stats);
    const isOwner = API_MODE === 'mock'
      ? user.id === 1 && (explicitId === null || (await getCurrentUser())?.id === 1)
      : currentUser?.id === user.id;
    editButton.hidden = !isOwner;
    statusElement.textContent = '';
    content.hidden = false;
  } catch(error) {
    showError(error.message || 'Unable to load this profile. Please try again.');
  }
}

editButton.addEventListener('click',openEditor);
document.getElementById('cancel-edit').addEventListener('click',closeEditor);
document.getElementById('cancel-edit-top').addEventListener('click',closeEditor);
form.addEventListener('submit',async event => {
  event.preventDefault();
  const values = {
    display_name:form.elements.display_name.value.trim(),
    faculty:form.elements.faculty.value.trim(),
    cohort:form.elements.cohort.value.trim().toUpperCase(),
    bio:form.elements.bio.value.trim()
  };
  if (!validate(values)) return;
  const saveButton = form.querySelector('[type="submit"]');
  saveButton.disabled = true;
  try {
    user = await updateProfile(user.id,values);
    renderProfile(user,await getUserStats(user.id));
    closeEditor();
    profileMessage.textContent = 'Profile updated in this browser.';
  } catch(error) {
    profileMessage.textContent = error.message || 'Unable to save your profile. Please try again.';
  } finally {
    saveButton.disabled = false;
  }
});

init();
