// Header control for theming: a dropdown to switch themes, plus Import (load a
// theme JSON file) and Export (download the active theme). Custom themes can be
// deleted. Import errors are shown inline and loudly, never swallowed.

import { For, Show, createSignal, type Component } from 'solid-js';
import {
  activeThemeId,
  addCustomTheme,
  exportThemeJson,
  removeCustomTheme,
  setActiveTheme,
  themes,
} from './themeStore';
import { parseThemeJson } from './parseTheme';

const ThemePicker: Component = () => {
  const [importError, setImportError] = createSignal<string | null>(null);
  let fileInput: HTMLInputElement | undefined;

  const activeTheme = () => themes().find((t) => t.id === activeThemeId());
  const activeIsCustom = () => activeTheme()?.builtin === false;

  const onPick = (e: Event): void => {
    setActiveTheme((e.currentTarget as HTMLSelectElement).value);
  };

  const onImportClick = (): void => {
    setImportError(null);
    fileInput?.click();
  };

  const onFile = async (e: Event): Promise<void> => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-importing the same filename later
    if (!file) return;
    try {
      const theme = parseThemeJson(await file.text());
      addCustomTheme(theme);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  const onExport = (): void => {
    const theme = activeTheme();
    if (!theme) return;
    const blob = new Blob([exportThemeJson(theme.id)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDelete = (): void => {
    const theme = activeTheme();
    if (theme && !theme.builtin) removeCustomTheme(theme.id);
  };

  return (
    <div style={{ display: 'flex', 'align-items': 'center', gap: 'var(--sp-3)' }}>
      <select
        value={activeThemeId()}
        onChange={onPick}
        aria-label="Theme"
        style={{
          background: 'var(--bg-card)',
          color: 'var(--text)',
          border: '1px solid var(--border-input)',
          'border-radius': 'var(--radius-sm)',
          padding: 'var(--sp-1) var(--sp-3)',
          'font-family': 'var(--font-sans)',
          'font-size': 'var(--fs-sm)',
        }}
      >
        <For each={themes()}>
          {(t) => <option value={t.id}>{t.name}</option>}
        </For>
      </select>

      <button type="button" onClick={onImportClick} title="Import a theme (.json)">
        Import
      </button>
      <button type="button" onClick={() => void onExport()} title="Export the active theme">
        Export
      </button>
      <Show when={activeIsCustom()}>
        <button type="button" onClick={onDelete} title="Delete this custom theme">
          Delete
        </button>
      </Show>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        onChange={(e) => void onFile(e)}
        style={{ display: 'none' }}
      />

      <Show when={importError()}>
        {(msg) => (
          <span role="alert" style={{ color: 'var(--error-border)', 'font-size': 'var(--fs-sm)' }}>
            {msg()}
          </span>
        )}
      </Show>
    </div>
  );
};

export default ThemePicker;
