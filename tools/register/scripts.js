/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

const ADMIN_LINK = 'https://admin.hlx.page';
const REGISTER_LINK = `${ADMIN_LINK}/register`;

const LINKS = {
  connect: `${REGISTER_LINK}/connect`,
  disconnect: `${REGISTER_LINK}/disconnect`,
  info: `${REGISTER_LINK}/info`,
  login: `${REGISTER_LINK}/login`,
};

// utility functions
function getFormData(form) {
  const data = {};
  [...form.elements].forEach((field) => {
    const { name, type, value } = field;
    if (name && type && value) {
      switch (type) {
        case 'number':
        case 'range':
          data[name] = parseFloat(value, 10);
          break;
        case 'date':
        case 'datetime-local':
          data[name] = new Date(value);
          break;
        case 'checkbox':
          if (field.checked) {
            if (data[name]) data[name].push(value);
            else data[name] = [value];
          }
          break;
        case 'radio':
          if (field.checked) data[name] = value;
          break;
        case 'url':
          data[name] = new URL(value);
          break;
        case 'file':
          data[name] = field.files;
          break;
        default:
          data[name] = value;
      }
    }
  });
  return data;
}

async function loadInfo(owner, repo) {
  const url = `${LINKS.info}/${owner}/${repo}`;
  const resp = await fetch(url);
  if (!resp.ok) return false;
  // window.history.pushState({ owner, repo }, '', `/tools/service-setup/connect/${owner}/${repo}`);
  const info = await resp.json();
  return info;
}

// loading button management
function showLoadingButton(button) {
  const { width } = button.getBoundingClientRect();
  button.style.minWidth = `${width}px`;
  button.dataset.label = button.textContent;
  button.innerHTML = '<i class="symbol symbol-loading"></i>';
}

function resetLoadingButton(button) {
  button.removeAttribute('style');
  button.textContent = button.dataset.label;
  button.disabled = false;
}

// progress bar management
function resetProgressBar() {
  const progressEvent = new CustomEvent('updateProgress', {
    detail: { reset: true },
  });
  document.dispatchEvent(progressEvent);
}

function updateProgressBar(direction, steps) {
  const progressEvent = new CustomEvent('updateProgress', {
    detail: { progress: direction, steps },
  });
  document.dispatchEvent(progressEvent);
}

// form management
function toggleResetButton(button, state) {
  button.disabled = state;
}

function enableLogin(form, info) {
  form.dataset.path = `${ADMIN_LINK}/login/${info.owner}/${info.repo}`;
}

function enableDisconnect(form, info) {
  form.dataset.path = `${LINKS.disconnect}/${info.owner}/${info.repo}`;
}

function displayError(form, message) {
  const div = document.createElement('div');
  div.className = 'form-error';
  div.textContent = message;
  const buttonWrapper = form.querySelector('button[type="submit"]').parentElement;
  buttonWrapper.parentElement.insertBefore(div, buttonWrapper);
}

function disableForm(form) {
  [...form.elements].forEach((el) => {
    el.disabled = true;
  });
}

/**
 * Manages the progress between different forms in a multi-step form process.
 *
 * @param {NodeListOf<HTMLFormElement>} forms - Form elements representing the steps
 * @param {HTMLFormElement} active - Currently active form
 * @param {number} [steps = 1] - Number of steps to move, default is 1
 * @param {boolean} [direction = true] - Direction of progress (true is forward, false is backward)
 */
function progressForm(forms, active, steps = 1, direction = true) {
  // calculate the index of the new active form based on the number of steps and direction
  const index = [...forms].indexOf(active);
  const newIndex = direction ? index + steps : index - steps;
  // update the visibility of each form based on the new index
  forms.forEach((form, i) => form.setAttribute('aria-hidden', i !== newIndex));
  // enable all form elements in the new active form
  const current = forms[newIndex];
  [...current.elements].forEach((el) => {
    el.disabled = false;
  });
  // update progress bar
  updateProgressBar(direction, 1);
}

function resetForm(form, i) {
  form.reset();
  form.setAttribute('aria-hidden', !!i);
  // reset button
  const button = form.querySelector('button[type="submit"]');
  if (button && button.dataset.label) resetLoadingButton(button);
  // remove error
  const error = form.querySelector('.form-error');
  if (error) error.remove();
  [...form.elements].forEach((el) => {
    el.disabled = false;
  });
}

function resetForms(forms) {
  forms.forEach((form, i) => resetForm(form, i));
  resetProgressBar();
}

// table management
function resetTable() {
  const table = document.getElementById('registerTable');
  table.setAttribute('aria-hidden', true);
  table.removeAttribute('class');
  table.querySelectorAll('tr > td:last-of-type').forEach((cell) => {
    cell.textContent = '-';
  });
}

function updateTable(data, step) {
  const table = document.getElementById('registerTable');
  table.removeAttribute('aria-hidden');
  if (step) table.className = step;
  Object.keys(data).forEach((key) => {
    const cell = table.querySelector(`[data-key="${key}"]`);
    if (cell) {
      const value = data[key];
      if (value.startsWith('http')) {
        const a = document.createElement('a');
        a.href = value;
        a.textContent = value;
        a.setAttribute('target', '_blank');
        cell.textContent = '';
        cell.append(a);
      } else cell.textContent = data[key] || '-';
    }
  });
}

// init
function registerListeners(doc) {
  const forms = doc.body.querySelectorAll('form');
  const GITHUB_FORM = doc.getElementById('github-form');
  const SIGNIN_FORM = doc.getElementById('signin-form');
  const USER_FORM = doc.getElementById('connect-user-form');
  const APP_FORM = doc.getElementById('connect-app-form');
  const DISCONNECT_FORM = doc.getElementById('disconnect-form');
  const RESET_BUTTON = doc.getElementById('register-reset');

  GITHUB_FORM.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = getFormData(e.srcElement);
    const [, owner, repo] = data['github-url'].pathname.split('/');
    if (owner && repo) {
      disableForm(GITHUB_FORM);
      showLoadingButton(e.submitter);
      toggleResetButton(RESET_BUTTON, false);
      const info = await loadInfo(owner, repo);
      if (info.error) {
        resetForm(GITHUB_FORM);
        displayError(GITHUB_FORM, info.error);
        throw new Error(info.error);
      } else if (info) {
        updateTable(info);
        enableLogin(SIGNIN_FORM, info);
        enableDisconnect(DISCONNECT_FORM, info);
        progressForm(forms, GITHUB_FORM);
        resetLoadingButton(e.submitter);
      }
    }
  });

  SIGNIN_FORM.addEventListener('submit', (e) => {
    e.preventDefault();
    const { path } = e.target.dataset;
    if (path) {
      disableForm(SIGNIN_FORM);
      showLoadingButton(e.submitter);
      const url = new URL(path);
      const [,, owner, repo] = url.pathname.split('/');
      const params = new URLSearchParams(url.search);
      params.set('extensionId', 'cookie');
      url.search = params.toString();

      const loginWindow = window.open(url.toString(), 'Sign in', 'popup,top=233,left=233,width=700,height=467');
      loginWindow.focus();

      const pollTimer = setInterval(() => {
        if (loginWindow.closed) {
          clearInterval(pollTimer);
          fetch(`https://admin.hlx.page/profile/${owner}/${repo}`, { credentials: 'include' })
            .then((res) => res.json())
            .then(async (json) => {
              if (json.error) throw new Error(json.error);
              else {
                const { profile } = json;
                if (profile.error) throw new Error(profile.error);
                const info = await loadInfo(owner, repo);
                info.authInfo = profile;
                // TODO: check if user vs. app (update table props, progress form additional step)
                updateTable({ user: `${profile.name} <${profile.email}>` }, 'user');
                progressForm(forms, SIGNIN_FORM);
                resetLoadingButton(e.submitter);
              }
            })
            .catch((error) => {
              throw new Error(error);
            });
        }
      }, 1500);
    }
  });

  USER_FORM.addEventListener('submit', (e) => {
    e.preventDefault();
    disableForm(USER_FORM);
    showLoadingButton(e.submitter);
    // enable user connection
    progressForm(forms, USER_FORM, 2);
    resetLoadingButton(e.submitter);
  });

  APP_FORM.addEventListener('submit', (e) => {
    e.preventDefault();
    disableForm(APP_FORM);
    showLoadingButton(e.submitter);
    // enable application connection
    progressForm(forms, APP_FORM);
    resetLoadingButton(e.submitter);
  });

  DISCONNECT_FORM.addEventListener('submit', (e) => {
    e.preventDefault();
    disableForm(DISCONNECT_FORM);
    showLoadingButton(e.submitter);
    // enable disconnection
    const { path } = e.target.dataset;
    if (path) {
      const { pathname } = new URL(path);
      const [,,, owner, repo] = pathname.split('/');
      try {
        const url = `${LINKS.disconnect}/${owner}/${repo}`;
        fetch(url, { method: 'POST' })
          .then(async (resp) => {
            if (!resp.ok) {
              const text = await resp.text();
              resetLoadingButton(e.submitter);
              throw new Error(text);
            } else {
              const info = await loadInfo(owner, repo);
              // TODO: determine if USER or APP, this will change the value of steps (currently 2)
              progressForm(forms, DISCONNECT_FORM, 2, false);
              resetLoadingButton(e.submitter);
              resetTable();
              updateTable(info);
            }
          });
      } catch (error) {
        resetLoadingButton(e.submitter);
        throw new Error(error);
      }
    }
  });

  RESET_BUTTON.addEventListener('click', () => {
    resetForms(forms);
    resetTable();
    toggleResetButton(RESET_BUTTON, true);
  });
}

registerListeners(document);
