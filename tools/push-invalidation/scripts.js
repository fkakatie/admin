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

function updateTypeParam(value) {
  const params = new URLSearchParams(window.location.search);
  params.set('type', value);
  const url = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({ path: url }, '', url);
}

function displayResults(results, form) {
  let pre = document.getElementById('credentials-results');
  if (!pre) {
    const wrapper = document.createElement('div');
    wrapper.className = 'section';
    pre = document.createElement('pre');
    pre.id = 'credentials-results';
    wrapper.append(pre);
    form.parentElement.after(wrapper);
  }
  pre.textContent = results;
}

// init
function registerListeners(doc) {
  const CREDENTIALS_FORM = doc.getElementById('credentials-form');

  // custom radio interactions
  const radios = CREDENTIALS_FORM.querySelectorAll('input[type="radio"]');
  const lis = [...radios].map((r) => r.closest('li'));
  radios.forEach((radio, i) => {
    radio.addEventListener('change', () => {
      const { value } = radio;
      updateTypeParam(value);
      // update radio display
      lis.forEach((li) => li.setAttribute('aria-selected', false));
      lis[i].setAttribute('aria-selected', true);
      // update form
      CREDENTIALS_FORM.className = value;
      CREDENTIALS_FORM.querySelectorAll('.form-field.cdn').forEach((field) => {
        const match = field.classList.contains(value);
        field.setAttribute('aria-hidden', !match);
        const input = field.querySelector('input');
        input.disabled = !match;
        input.required = match;
        if (!match) input.value = '';
      });
    });
  });

  // retrieve type query param
  const params = new URLSearchParams(window.location.search);
  const initialType = params.get('type').toLowerCase();
  const validTypes = [...radios].map((r) => r.value);
  if (validTypes.includes(initialType)) {
    const radio = CREDENTIALS_FORM.querySelector(`input[value="${initialType}"]`);
    const li = radio.closest('li');
    li.parentElement.prepend(li);
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
  }

  CREDENTIALS_FORM.addEventListener('submit', async (e) => {
    e.preventDefault();
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const body = getFormData(e.target);
    const formData = new URLSearchParams(body);
    const url = 'https://helix-pages.anywhere.run/helix-services/byocdn-push-invalidation/v1';
    const resp = await fetch(url, { method: 'POST', headers, body: formData.toString() });
    const text = await resp.text();
    displayResults(text, CREDENTIALS_FORM);
  });

  CREDENTIALS_FORM.addEventListener('reset', (e) => {
    const pre = document.getElementById('credentials-results');
    if (pre) pre.closest('div').remove();
    const { type } = getFormData(e.target);
    if (type) {
      e.preventDefault();
      e.target.querySelectorAll('.form-field.cdn input[required]').forEach((req) => {
        req.value = '';
      });
    }
  });
}

registerListeners(document);
