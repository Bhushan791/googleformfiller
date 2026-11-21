import { useState, useCallback } from 'react';

const DEFAULT_SETTINGS = {
  mix: { positive: 70, neutral: 20, negative: 10 },
  count: 50,
  perQuestion: {},
  pools: {},
  optionalSkipRate: 0.1,
  checkboxMax: 3,
};

export default function useSettings(initial = {}) {
  const [settings, setSettings] = useState({
    ...DEFAULT_SETTINGS,
    ...initial,
  });

  const setMix = useCallback((newMix) => {
    setSettings((prev) => ({ ...prev, mix: newMix }));
  }, []);

  const setCount = useCallback((newCount) => {
    const val = Math.max(1, Math.min(500, Number(newCount) || 1));
    setSettings((prev) => ({ ...prev, count: val }));
  }, []);

  const setQuestionOverride = useCallback((questionId, override) => {
    setSettings((prev) => {
      const next = { ...prev.perQuestion };
      if (!override || override.mode === 'default') {
        delete next[questionId];
      } else {
        next[questionId] = override;
      }
      return { ...prev, perQuestion: next };
    });
  }, []);

  const removeQuestionOverride = useCallback((questionId) => {
    setSettings((prev) => {
      const next = { ...prev.perQuestion };
      delete next[questionId];
      return { ...prev, perQuestion: next };
    });
  }, []);

  const addPool = useCallback((name, items) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const cleanItems = (Array.isArray(items) ? items : items.split('\n'))
      .map((i) => i.trim())
      .filter((i) => i.length > 0);

    setSettings((prev) => ({
      ...prev,
      pools: {
        ...prev.pools,
        [cleanName]: cleanItems,
      },
    }));
  }, []);

  const removePool = useCallback((name) => {
    setSettings((prev) => {
      const next = { ...prev.pools };
      delete next[name];
      return { ...prev, pools: next };
    });
  }, []);

  const setOptionalSkipRate = useCallback((rate) => {
    setSettings((prev) => ({ ...prev, optionalSkipRate: rate }));
  }, []);

  const loadSettings = useCallback((newSettings) => {
    setSettings((prev) => ({
      ...prev,
      ...newSettings,
    }));
  }, []);

  return {
    settings,
    setMix,
    setCount,
    setQuestionOverride,
    removeQuestionOverride,
    addPool,
    removePool,
    setOptionalSkipRate,
    loadSettings,
  };
}

