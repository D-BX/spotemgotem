import { describe, it, expect } from 'vitest';
import { parseViscolor, parsePledit, DEFAULT_PLEDIT } from './parseText';

describe('parseViscolor', () => {
  it('parses r,g,b rows and ignores comments/blank lines', () => {
    const text = [
      '// Visualization colors',
      '0,0,0     // background',
      '24, 24, 24',
      '255,255,255 // peak',
      '',
    ].join('\n');
    const colors = parseViscolor(text);
    expect(colors).toHaveLength(24);
    expect(colors[0]).toEqual([0, 0, 0]);
    expect(colors[1]).toEqual([24, 24, 24]);
    expect(colors[2]).toEqual([255, 255, 255]);
    // Padded with black.
    expect(colors[23]).toEqual([0, 0, 0]);
  });

  it('always returns exactly 24 entries, truncating overflow', () => {
    const rows = Array.from({ length: 40 }, (_, i) => `${i},${i},${i}`).join('\n');
    expect(parseViscolor(rows)).toHaveLength(24);
  });

  it('clamps out-of-range channels', () => {
    const colors = parseViscolor('999,10,20');
    expect(colors[0]).toEqual([255, 10, 20]);
  });
});

describe('parsePledit', () => {
  it('parses colors and font, case-insensitively, tolerating comments', () => {
    const text = [
      '[Text]',
      '; a comment',
      'Normal=#00FF00',
      'Current=#FFF',
      'NormalBG=000000',
      'SelectedBG=#0000c6',
      'Font=Comic Sans MS',
    ].join('\n');
    const p = parsePledit(text);
    expect(p.normal).toBe('#00ff00');
    expect(p.current).toBe('#ffffff'); // #FFF expanded
    expect(p.normalBg).toBe('#000000');
    expect(p.selectedBg).toBe('#0000c6');
    expect(p.font).toBe('Comic Sans MS');
  });

  it('falls back to defaults for missing/invalid keys', () => {
    const p = parsePledit('[Text]\nNormal=notacolor');
    expect(p.normal).toBe(DEFAULT_PLEDIT.normal);
    expect(p.current).toBe(DEFAULT_PLEDIT.current);
  });
});
