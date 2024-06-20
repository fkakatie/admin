/**
 * Transitions the progress bar value based until it reaches the desired value.
 *
 * @param {HTMLProgressElement} bar - Progress bar element
 * @param {number} startValue - Original value of the progress bar
 * @param {number} endValue - New value for the progress bar
 * @param {number} direction - Direction of the change (positive or negative step)
 */
function smoothProgress(bar, startValue, endValue, direction) {
  let currentValue = startValue;
  bar.value = currentValue;
  // set up the interval to update the progress bar value
  const interval = setInterval(() => {
    // update the current value by adding the step amount
    currentValue += direction ? 1 : -1;
    // update the progress bar value
    bar.value = currentValue;
    // check if the target value has been reached or exceeded
    if ((direction && currentValue >= endValue) || (!direction && currentValue <= endValue)) {
      // set the final value and clear the interval
      bar.value = endValue;
      clearInterval(interval);
    }
  }, 10);
}

/**
 * Update progress bar and navigation steps.
 *
 * @param {HTMLProgressElement} bar - Progress bar element.
 * @param {HTMLElement} nav - Container holding the step elements.
 * @param {NodeListOf<HTMLElement>} lis - List of elements that indicate progress steps.
 */
function respondToProgressEvent(bar, nav, lis) {
  document.addEventListener('updateProgress', (e) => {
    const { progress, steps, value } = e.detail;
    if (e.detail.reset) {
      // find current step and reset it
      const current = nav.querySelector('[aria-current]');
      if (current) current.removeAttribute('aria-current');
      // set the first step as the new current step
      lis[0].setAttribute('aria-current', 'step');
      const { step } = bar.dataset;
      // update the progress bar value to align with first step label
      bar.value = (step / 2);
    } else if (progress !== null && steps) {
      const barValue = parseFloat(bar.value, 10);
      const stepValue = parseFloat(bar.dataset.step, 10);
      // find the currently active step and its index
      let current = nav.querySelector('[aria-current]');
      if (!current) current = progress ? lis[0] : lis[lis.length - 1];
      const currentIndex = [...lis].indexOf(current);
      if (current) current.removeAttribute('aria-current');
      if (progress) {
        // increase the progress bar value
        const newValue = barValue + (stepValue * steps);
        const safeValue = newValue > 100 ? 100 : newValue;
        smoothProgress(bar, bar.value, safeValue, true);
        // move nav to the next step
        const newCurrent = lis[currentIndex + steps];
        if (newCurrent) newCurrent.setAttribute('aria-current', 'step');
      } else {
        // decrease the progress bar value
        const newValue = barValue - (stepValue * steps);
        const safeValue = newValue < 0 ? 0 : newValue;
        smoothProgress(bar, bar.value, safeValue, false);
        // move nav to the previous step
        const newCurrent = lis[currentIndex - steps];
        if (newCurrent) newCurrent.setAttribute('aria-current', 'step');
      }
    } else if (value !== null) {
      bar.value = value;
    }
  });
}

export default async function decorate(block) {
  // create bar
  const bar = document.createElement('progress');
  bar.id = 'progressBar';
  bar.setAttribute('max', 100);
  bar.value = 0;

  // calculate steps
  const list = block.querySelector('ol, ul');
  if (list) {
    const nav = document.createElement('nav');
    nav.append(list);
    const lis = list.querySelectorAll('li');
    lis[0].setAttribute('aria-current', 'step');
    const numOfSteps = lis.length;
    const eachStep = bar.max / numOfSteps;
    bar.dataset.steps = numOfSteps;
    bar.dataset.step = eachStep;
    bar.value = (eachStep / 2);

    // respond to progress events
    respondToProgressEvent(bar, list, lis);

    // build block
    block.innerHTML = '';
    block.append(nav, bar);
  } else {
    // respond to progress events
    respondToProgressEvent(bar);

    // build block
    block.append(bar);
  }
}
