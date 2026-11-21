import { useState, useRef } from 'react';

export default function PoolUploader({ pools = {}, onAddPool, onRemovePool }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const poolNames = Object.keys(pools);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setText(content);
        if (!name) {
          // Default pool name from file name
          const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
          setName(baseName);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please provide a pool name.');
      return;
    }

    const items = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (items.length === 0) {
      setError('Please enter or upload at least one item.');
      return;
    }

    onAddPool(cleanName, items);
    setName('');
    setText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Custom Answer Pools</h4>
          <p className="text-xs text-gray-500">
            Supply specific values (e.g. employee IDs, product names) for questions to pull from.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
        >
          {isOpen ? 'Close' : '+ Add Pool'}
        </button>
      </div>

      {/* Pool list */}
      {poolNames.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {poolNames.map((pName) => {
            const count = pools[pName]?.length || 0;
            return (
              <span
                key={pName}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
              >
                <span className="font-medium text-blue-700">{pName}</span>
                <span className="text-gray-400">({count} items)</span>
                <button
                  type="button"
                  onClick={() => onRemovePool(pName)}
                  className="ml-1 text-gray-400 hover:text-red-600 transition-colors cursor-pointer font-bold"
                  title="Remove pool"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">No custom pools uploaded yet.</p>
      )}

      {/* Upload panel */}
      {isOpen && (
        <form onSubmit={handleAdd} className="pt-3 border-t border-gray-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Pool Name
              </label>
              <input
                type="text"
                placeholder="e.g. employee_names"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Upload File (.txt or .csv)
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Items (one per line)
            </label>
            <textarea
              rows={3}
              placeholder="Value 1&#10;Value 2&#10;Value 3"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 border border-gray-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Save Pool
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

