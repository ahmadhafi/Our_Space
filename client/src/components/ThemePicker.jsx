import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

export default function ThemePicker() {
  const { theme, setTheme, PRESETS } = useTheme();
  const [customAccent, setCustomAccent] = useState(theme.accent);
  const [customBg, setCustomBg] = useState(theme.bg);
  const [saving, setSaving] = useState(false);

  const handlePresetSelect = async (key) => {
    const preset = PRESETS[key];
    setSaving(true);
    await setTheme(key, preset.accent, preset.bg);
    setCustomAccent(preset.accent);
    setCustomBg(preset.bg);
    setSaving(false);
  };

  const handleCustomSave = async () => {
    setSaving(true);
    await setTheme('custom', customAccent, customBg);
    setSaving(false);
  };

  return (
    <div className="glass-card-solid p-5 animate-fade-in">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" style={{ color: 'var(--color-accent)' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
        </svg>
        Theme
      </h3>

      {/* Presets */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {Object.entries(PRESETS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => handlePresetSelect(key)}
            className={`p-3 rounded-xl border-2 transition-all duration-200 text-left hover:scale-[1.02] ${
              theme.preset === key ? 'shadow-md' : 'border-transparent hover:border-gray-200'
            }`}
            style={{
              background: preset.bg,
              borderColor: theme.preset === key ? preset.accent : undefined
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-5 h-5 rounded-full shadow-sm" style={{ background: preset.accent }} />
              <span className={`text-sm font-medium ${preset.dark ? 'text-white' : 'text-gray-800'}`}>
                {preset.label}
              </span>
            </div>
            <div className={`flex gap-1 ${preset.dark ? 'text-gray-300' : 'text-gray-500'}`}>
              <span className="text-[10px]">{preset.accent}</span>
            </div>
            {theme.preset === key && (
              <div className="mt-1.5 text-[10px] font-semibold" style={{ color: preset.accent }}>
                ✓ Active
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Custom colors */}
      <div className="border-t border-gray-200/50 pt-4">
        <h4 className="text-sm font-medium mb-3">Custom Colors</h4>
        <div className="flex gap-4 mb-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Accent Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customAccent}
                onChange={(e) => setCustomAccent(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
              />
              <input
                type="text"
                value={customAccent}
                onChange={(e) => setCustomAccent(e.target.value)}
                className="input-field text-sm py-1.5 font-mono"
                pattern="^#[0-9a-fA-F]{6}$"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Background Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customBg}
                onChange={(e) => setCustomBg(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
              />
              <input
                type="text"
                value={customBg}
                onChange={(e) => setCustomBg(e.target.value)}
                className="input-field text-sm py-1.5 font-mono"
                pattern="^#[0-9a-fA-F]{6}$"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div
          className="rounded-xl p-4 mb-3 flex items-center gap-3 transition-all duration-300"
          style={{ background: customBg }}
        >
          <div className="w-8 h-8 rounded-full" style={{ background: customAccent }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: customAccent }}>Preview</div>
            <div className="text-xs" style={{ color: customAccent, opacity: 0.7 }}>Your theme will look like this</div>
          </div>
        </div>

        <button
          onClick={handleCustomSave}
          disabled={saving}
          className="btn-primary w-full text-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Apply Custom Theme'}
        </button>
      </div>
    </div>
  );
}
