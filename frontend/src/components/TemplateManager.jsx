import { useState, useEffect, useCallback } from 'react';

export default function TemplateManager({
  formId,
  currentSettings,
  currentCount,
  currentDelay,
  onLoadTemplate,
}) {
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [message, setMessage] = useState(null);

  const storageKey = `formbot_templates_${formId || 'default'}`;

  // Load saved templates for this form from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setTemplates(JSON.parse(raw));
      } else {
        setTemplates([]);
      }
    } catch {
      setTemplates([]);
    }
  }, [storageKey]);

  const saveToStorage = (updated) => {
    setTemplates(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save templates to localStorage', err);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    const name = templateName.trim();
    if (!name) return;

    const newTemplate = {
      id: Date.now().toString(),
      name,
      settings: currentSettings,
      count: currentCount,
      delay: currentDelay,
      savedAt: new Date().toISOString(),
    };

    const updated = [newTemplate, ...templates.filter((t) => t.name !== name)];
    saveToStorage(updated);
    setTemplateName('');
    setSelectedTemplateId(newTemplate.id);
    setMessage(`Saved "${name}"!`);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleApply = () => {
    const found = templates.find((t) => t.id === selectedTemplateId);
    if (!found) return;

    onLoadTemplate({
      settings: found.settings,
      count: found.count,
      delay: found.delay,
    });

    setMessage(`Loaded "${found.name}"!`);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = () => {
    if (!selectedTemplateId) return;
    const found = templates.find((t) => t.id === selectedTemplateId);
    const updated = templates.filter((t) => t.id !== selectedTemplateId);
    saveToStorage(updated);
    setSelectedTemplateId('');
    if (found) {
      setMessage(`Deleted "${found.name}".`);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Configuration Templates
        </h3>
        {message && (
          <span className="text-xs font-medium text-emerald-600 animate-fade-in">
            {message}
          </span>
        )}
      </div>

      {/* Save Template input */}
      <form onSubmit={handleSave} className="mb-3 flex gap-2">
        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="New template name (e.g. 'Survey Test Q3')"
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!templateName.trim()}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          Save
        </button>
      </form>

      {/* Saved list & actions */}
      {templates.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- Select a saved template --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({new Date(t.savedAt).toLocaleDateString()})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleApply}
            disabled={!selectedTemplateId}
            className="rounded-md border border-blue-600 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Load
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={!selectedTemplateId}
            className="rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            title="Delete template"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

