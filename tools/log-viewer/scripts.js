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

// date management
function pad(number) {
  return number.toString().padStart(2, '0');
}

function toReadableDate(date) {
  const [day, mm, dd, yyyy] = date.toString().split(' ');
  const hours = date.getHours();
  // eslint-disable-next-line no-nested-ternary
  const adjustedHours = hours === 0
    ? 12 : hours > 12
      ? hours - 12 : hours;
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? 'pm' : 'am';
  const str = `${day}, ${mm} ${dd}, ${yyyy} at ${pad(adjustedHours)}:${pad(minutes)} ${suffix}`;
  return str;
}

function toDateTimeLocal(date) {
  // convert date
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  // convert time
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toISO(str) {
  const date = new Date(str);
  return date.toISOString();
}

function calculatePastDate(days, hours, mins, now = new Date()) {
  const newDate = now;
  if (days > 0) newDate.setDate(newDate.getDate() - days);
  if (hours > 0) newDate.setHours(newDate.getHours() - hours);
  if (mins > 0) newDate.seMinutes(newDate.geMinutes() - mins);
  return newDate;
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

// form management
function toggleResetButton(button, state) {
  button.disabled = state;
}

function disableForm(form) {
  [...form.elements].forEach((el) => {
    el.disabled = true;
  });
}

function enableForm(form) {
  resetLoadingButton(form.querySelector('button[type="submit"]'));
  [...form.elements].forEach((el) => {
    el.disabled = false;
  });
}

function writePathURL(data) {
  const {
    route, ref, repo, owner, path,
  } = data;
  let siteURL = `https://${ref}--${repo}--${owner}.hlx.`;
  if (route === 'preview') {
    siteURL += `page${path}`;
    return siteURL;
  }
  if (route === 'publish') {
    siteURL += `live${path}`;
    return siteURL;
  }
  if (route === 'config') {
    return `https://admin.hlx.page/${route}/${data.org}/sites/${data.site}.json`;
  }
  if (route === 'code' || route === 'job') {
    return `https://github.com/${owner}/${repo}/tree/${ref}`;
  }
  return false;
}

function buildCell(data, type) {
  const cell = document.createElement('td');
  if (type) {
    cell.className = `log-${type}`;
    if (type === 'time') {
      const date = new Date(data);
      cell.textContent = toReadableDate(date);
    } else if (type === 'path') {
      const url = writePathURL(data);
      cell.innerHTML = `<a href="${url}" target="_blank">${data.path}</a>`;
    } else if (type === 'method') {
      cell.innerHTML = `<code>${data}</code>`;
    } else if (type === 'status') {
      cell.innerHTML = `<span class="http${Math.floor(data / 100) % 10}">${data}</span>`;
    } else if (type === 'duration') {
      cell.dataset.type = 'numerical';
      cell.textContent = `${(data / 1000).toFixed(1)} s`;
    } else {
      cell.textContent = data;
    }
  } else {
    cell.textContent = data;
  }
  return cell;
}

function clearTable(table) {
  table.parentElement.setAttribute('aria-hidden', true);
  table.innerHTML = '';
}

function displayLogs(logs) {
  const table = document.querySelector('table');
  table.setAttribute('aria-hidden', false);
  const body = table.querySelector('tbody');
  logs.forEach((log) => {
    // route determines path
    const {
      timestamp, route, method, status, duration,
    } = log;
    const row = document.createElement('tr');
    const timeCell = buildCell(timestamp, 'time');
    const routeCell = buildCell(route || 'event');
    const pathCell = buildCell(log, 'path');
    const methodCell = buildCell(method || '', 'method');
    const statusCell = buildCell(status || '', 'status');
    const durationCell = buildCell(duration || '', 'duration');
    // eslint-disable-next-line max-len
    [timeCell, routeCell, pathCell, methodCell, statusCell, durationCell].forEach((cell) => {
      row.append(cell);
    });
    body.append(row);
  });
}

async function fetchLogs(owner, repo) {
  const from = document.getElementById('date-from');
  const fromValue = encodeURIComponent(toISO(from.value));
  const to = document.getElementById('date-to');
  const toValue = encodeURIComponent(toISO(to.value));
  const url = `https://admin.hlx.page/log/${owner}/${repo}/main?from=${fromValue}&to=${toValue}`;
  const req = await fetch(url, { credentials: 'include' });
  const res = await req.json();
  displayLogs(res.entries);
}

function enableLogin(owner, repo, form) {
  const url = new URL(`https://admin.hlx.page/login/${owner}/${repo}/main`);
  url.searchParams.set('extensionId', 'cookie');

  const loginWindow = window.open(url, 'Sign in', 'popup,top=233,left=233,width=700,height=467');
  loginWindow.focus();

  const pollTimer = setInterval(() => {
    if (loginWindow.closed) {
      clearInterval(pollTimer);
      enableForm(form);
      fetchLogs(owner, repo);
    }
  }, 1500);
}

function updateTableCaption(fromTime, toTime = false) {
  const from = document.getElementById('logs-from');
  const to = document.getElementById('logs-to');
  const spanTo = document.getElementById('to');
  from.textContent = fromTime;

  to.setAttribute('aria-hidden', !toTime);
  spanTo.setAttribute('aria-hidden', !toTime);
  to.textContent = toTime || '';
}

function updateTimeframe(value, label) {
  const now = new Date();
  const from = document.getElementById('date-from');
  const to = document.getElementById('date-to');
  [from, to].forEach((field) => {
    field.readOnly = true;
  });
  to.value = toDateTimeLocal(now);
  if (value.includes(':')) {
    const [days, hours, mins] = value.split(':').map((v) => parseInt(v, 10));
    const date = calculatePastDate(days, hours, mins);
    from.value = toDateTimeLocal(date);
    updateTableCaption(label.toLowerCase());
  } else if (value === 'today') {
    const midnight = now;
    midnight.setHours(0, 0, 0, 0);
    from.value = toDateTimeLocal(midnight);
    updateTableCaption(value);
  } else if (value === 'custom') {
    [from, to].forEach((field) => {
      field.removeAttribute('readonly');
    });
  }
}

function registerListeners(doc) {
  const GITHUB_FORM = doc.getElementById('github-form');
  const GITHUB_FIELD = doc.getElementById('github-url');
  const PICKER_FIELD = doc.getElementById('timeframe');
  const PICKER_OPTIONS = doc.querySelectorAll('.picker-field li');
  const TABLE = doc.querySelector('table > tbody');
  const RESET_BUTTON = doc.getElementById('github-reset');

  GITHUB_FORM.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = getFormData(e.srcElement);
    const [, owner, repo] = data['github-url'].pathname.split('/');
    if (owner && repo) {
      disableForm(GITHUB_FORM);
      clearTable(TABLE);
      showLoadingButton(e.submitter);
      toggleResetButton(RESET_BUTTON, false);
      enableLogin(owner, repo, GITHUB_FORM);
    }
  });

  GITHUB_FIELD.addEventListener('input', () => {
    clearTable(TABLE);
  });

  PICKER_FIELD.addEventListener('click', () => {
    const expanded = PICKER_FIELD.getAttribute('aria-expanded') === 'true';
    PICKER_FIELD.setAttribute('aria-expanded', !expanded);
  });

  PICKER_OPTIONS.forEach((option) => {
    option.addEventListener('click', () => {
      PICKER_FIELD.value = option.textContent;
      PICKER_FIELD.setAttribute('aria-expanded', false);
      PICKER_OPTIONS.forEach((o) => o.setAttribute('aria-selected', o === option));
      // update to and from
      updateTimeframe(option.dataset.value, option.textContent);
    });
  });
}

registerListeners(document);

function initDateTo(doc) {
  const to = doc.getElementById('date-to');
  to.value = toDateTimeLocal(new Date());
  to.setAttribute('max', toDateTimeLocal(new Date()));

  setInterval(() => {
    const now = new Date();
    to.setAttribute('max', toDateTimeLocal(now));
  }, 60 * 1000);
}

initDateTo(document);
updateTimeframe('1:00:00', 'last 24 hours');
