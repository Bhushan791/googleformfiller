import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import useStep from './hooks/useStep.js';

function renderHook(hookFn, initialProps) {
  let state = [];
  let stateIdx = 0;
  let props = initialProps;
  let currentResult;

  const dispatcher = {
    useState(initial) {
      const currentIdx = stateIdx++;
      if (state[currentIdx] === undefined) {
        state[currentIdx] = typeof initial === 'function' ? initial() : initial;
      }
      const setState = (newVal) => {
        state[currentIdx] = typeof newVal === 'function' ? newVal(state[currentIdx]) : newVal;
        rerender();
      };
      return [state[currentIdx], setState];
    },
    useEffect() {},
    useCallback(fn) {
      return fn;
    },
    useMemo(fn) {
      return fn;
    },
    useRef(initial) {
      return { current: initial };
    },
  };

  if (React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE) {
    React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = dispatcher;
  }
  if (React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
    React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = dispatcher;
  }

  function rerender(newProps) {
    if (newProps !== undefined) props = newProps;
    stateIdx = 0;
    if (React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE) {
      React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = dispatcher;
    }
    if (React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = dispatcher;
    }
    currentResult = hookFn(props);
  }

  rerender();
  return {
    get result() {
      return currentResult;
    },
    rerender,
  };
}

test('1. Fresh state (localStorage cleared): only step 1 active, steps 2-4 disabled with no checks', () => {
  const hook = renderHook(useStep, {
    data: null,
    previewResult: null,
    job: null,
    configured: false,
    dryRunSkipped: false,
  });

  assert.equal(hook.result.activeStep, 1);
  const steps = hook.result.steps;

  // Step 1: current, isDone: false, clickable: true
  assert.equal(steps[0].status, 'current');
  assert.equal(steps[0].isDone, false);
  assert.equal(steps[0].clickable, true);

  // Steps 2-4: disabled, isDone: false, clickable: false
  for (let i = 1; i < 4; i++) {
    assert.equal(steps[i].status, 'disabled');
    assert.equal(steps[i].isDone, false);
    assert.equal(steps[i].clickable, false);
  }
});

test('2. Form loaded: step 1 done with check, step 2 current, steps 3-4 disabled with no checks', () => {
  const hook = renderHook(useStep, {
    data: { formId: 'test_123', questions: [] },
    previewResult: null,
    job: null,
    configured: false,
    dryRunSkipped: false,
  });

  hook.result.goToStep(2);

  assert.equal(hook.result.activeStep, 2);
  const steps = hook.result.steps;

  // Step 1: done, isDone true, clickable
  assert.equal(steps[0].status, 'done');
  assert.equal(steps[0].isDone, true);
  assert.equal(steps[0].clickable, true);

  // Step 2: current, isDone false, clickable
  assert.equal(steps[1].status, 'current');
  assert.equal(steps[1].isDone, false);
  assert.equal(steps[1].clickable, true);

  // Steps 3-4: disabled with no check
  assert.equal(steps[2].status, 'disabled');
  assert.equal(steps[2].isDone, false);
  assert.equal(steps[2].clickable, false);

  assert.equal(steps[3].status, 'disabled');
  assert.equal(steps[3].isDone, false);
  assert.equal(steps[3].clickable, false);
});

test('3. Configured step 2 completed: step 1 and 2 done, step 3 current, step 4 disabled with no checks', () => {
  const hook = renderHook(useStep, {
    data: { formId: 'test_123', questions: [] },
    previewResult: null,
    job: null,
    configured: true,
    dryRunSkipped: false,
  });

  hook.result.goToStep(3);

  assert.equal(hook.result.activeStep, 3);
  const steps = hook.result.steps;

  assert.equal(steps[0].status, 'done');
  assert.equal(steps[0].isDone, true);

  assert.equal(steps[1].status, 'done');
  assert.equal(steps[1].isDone, true);

  assert.equal(steps[2].status, 'current');
  assert.equal(steps[2].isDone, false);

  assert.equal(steps[3].status, 'disabled');
  assert.equal(steps[3].isDone, false);
});

test('4. Review step 3 completed: step 1-3 done with checks, step 4 current', () => {
  const hook = renderHook(useStep, {
    data: { formId: 'test_123', questions: [] },
    previewResult: { responses: [] },
    job: null,
    configured: true,
    dryRunSkipped: false,
  });

  hook.result.goToStep(4);

  assert.equal(hook.result.activeStep, 4);
  const steps = hook.result.steps;

  assert.equal(steps[0].status, 'done');
  assert.equal(steps[0].isDone, true);

  assert.equal(steps[1].status, 'done');
  assert.equal(steps[1].isDone, true);

  assert.equal(steps[2].status, 'done');
  assert.equal(steps[2].isDone, true);

  assert.equal(steps[3].status, 'current');
  assert.equal(steps[3].isDone, false);
});

test('5. Job completes on step 4: step 4 isDone becomes true', () => {
  const hook = renderHook(useStep, {
    data: { formId: 'test_123', questions: [] },
    previewResult: { responses: [] },
    job: { status: 'completed' },
    configured: true,
    dryRunSkipped: false,
  });

  assert.equal(hook.result.isRunDone, true);
  const steps = hook.result.steps;
  assert.equal(steps[3].isDone, true);
});
