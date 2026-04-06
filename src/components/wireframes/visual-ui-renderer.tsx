'use client';

import { useState, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DesignTokens {
  colors: { name: string; hex: string; usage: string }[];
  typography: { name: string; size: string; weight: string; lineHeight: string; usage: string }[];
  spacing: { name: string; size: string; usage: string }[];
  buttons: { name: string; bg: string; text: string; radius: string; hover?: string; active?: string }[];
}

// ---------------------------------------------------------------------------
// Parser — extract design tokens from UI Kit markdown
// ---------------------------------------------------------------------------

function parseDesignTokens(content: string): DesignTokens {
  const colors: DesignTokens['colors'] = [];
  const typography: DesignTokens['typography'] = [];
  const spacing: DesignTokens['spacing'] = [];
  const buttons: DesignTokens['buttons'] = [];

  // Extract colors: pattern like `#RRGGBB` or `#RGB`
  const colorRegex = /\*\*(.+?):\*\*\s*`(#[0-9A-Fa-f]{3,8})`(?:\s*\((\w+)\))?\s*[—\-]?\s*(.*)/g;
  let match: RegExpExecArray | null;
  while ((match = colorRegex.exec(content)) !== null) {
    colors.push({
      name: match[1].trim(),
      hex: match[2],
      usage: match[4]?.trim() || match[3] || '',
    });
  }

  // Also extract inline hex codes with names
  const inlineColorRegex = /[`"]?(#[0-9A-Fa-f]{6})[`"]?\s*\((\w+)\)/g;
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = inlineColorRegex.exec(content)) !== null) {
    if (!colors.find(c => c.hex === inlineMatch![1])) {
      colors.push({ name: inlineMatch[2], hex: inlineMatch[1], usage: '' });
    }
  }

  // Extract typography from table rows
  const typoTableRegex = /\|\s*(\w[\w\s]+?)\s*\|\s*(\d+)\s*\|\s*(\w+)\s*\|\s*(\d+)\s*\|\s*(.*?)\s*\|/g;
  let typoMatch: RegExpExecArray | null;
  while ((typoMatch = typoTableRegex.exec(content)) !== null) {
    if (typoMatch[1].trim() !== 'Size' && typoMatch[1].trim() !== '---') {
      typography.push({
        name: typoMatch[1].trim(),
        size: typoMatch[2] + 'px',
        weight: typoMatch[3].trim(),
        lineHeight: typoMatch[4] + 'px',
        usage: typoMatch[5]?.trim() || '',
      });
    }
  }

  // Extract spacing from table rows
  const spacingTableRegex = /\|\s*(\w+)\s*\|\s*(\d+)\s*\|\s*(.*?)\s*\|/g;
  const spacingSection = content.indexOf('Spacing Scale');
  const spacingEnd = content.indexOf('---', spacingSection + 20);
  const spacingBlock = spacingSection > -1 ? content.slice(spacingSection, spacingEnd > spacingSection ? spacingEnd : undefined) : '';
  let spacingMatch: RegExpExecArray | null;
  while ((spacingMatch = spacingTableRegex.exec(spacingBlock)) !== null) {
    if (spacingMatch[1].trim() !== 'Name' && spacingMatch[1].trim() !== '---') {
      spacing.push({ name: spacingMatch[1].trim(), size: spacingMatch[2] + 'px', usage: spacingMatch[3]?.trim() || '' });
    }
  }

  // Extract button definitions
  const buttonSections = content.matchAll(/####\s*(.*?Button.*?)\n([\s\S]*?)(?=####|---|\n##)/g);
  for (const bs of buttonSections) {
    const name = bs[1].replace(/\*\*/g, '').trim();
    const block = bs[2];
    const bgMatch = block.match(/Background:\s*.*?`(#[0-9A-Fa-f]+)`/);
    const textMatch = block.match(/Text:\s*(?:.*?`(#[0-9A-Fa-f]+)`|White)/);
    const radiusMatch = block.match(/Border Radius:\s*`(\d+px)`/);
    const hoverMatch = block.match(/Hover.*?Background:\s*.*?`(#[0-9A-Fa-f]+)`/);
    const activeMatch = block.match(/Active.*?Background:\s*.*?`(#[0-9A-Fa-f]+)`/);

    buttons.push({
      name,
      bg: bgMatch?.[1] || '#2563EB',
      text: textMatch?.[1] || '#FFFFFF',
      radius: radiusMatch?.[1] || '8px',
      hover: hoverMatch?.[1],
      active: activeMatch?.[1],
    });
  }

  return { colors, typography, spacing, buttons };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ColorPalette({ colors }: { colors: DesignTokens['colors'] }) {
  // Group colors by category
  const groups = useMemo(() => {
    const map: Record<string, typeof colors> = {};
    for (const c of colors) {
      const cat = c.name.match(/(Primary|Secondary|Neutral|Success|Error|Warning|Info)/i)?.[1] || 'Other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(c);
    }
    return map;
  }, [colors]);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-neutral-800">Color Palette</h3>
      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
          <p className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wider">{group}</p>
          <div className="flex flex-wrap gap-3">
            {items.map((c, i) => (
              <div key={i} className="group">
                <div
                  className="w-16 h-16 rounded-xl shadow-sm border border-black/5 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: c.hex }}
                />
                <p className="text-[10px] font-mono text-neutral-500 mt-1.5 text-center">{c.hex}</p>
                <p className="text-[9px] text-neutral-400 text-center max-w-[64px] truncate">{c.name}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TypographyPreview({ typography }: { typography: DesignTokens['typography'] }) {
  const weightMap: Record<string, number> = { Bold: 700, Semibold: 600, Regular: 400, Medium: 500 };
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-neutral-800">Typography Scale</h3>
      <div className="space-y-3 bg-white rounded-xl border border-neutral-200 p-5">
        {typography.map((t, i) => (
          <div key={i} className="flex items-baseline gap-4 py-2 border-b border-neutral-100 last:border-0">
            <span
              className="text-neutral-900 shrink-0"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: t.size,
                fontWeight: weightMap[t.weight] || 400,
                lineHeight: t.lineHeight,
              }}
            >
              Aa
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-neutral-700">{t.name}</p>
              <p className="text-[10px] text-neutral-400 font-mono">{t.size} / {t.weight} / {t.lineHeight}</p>
              {t.usage && <p className="text-[10px] text-neutral-400">{t.usage}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ButtonPreview({ buttons }: { buttons: DesignTokens['buttons'] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-neutral-800">Button Components</h3>
      <div className="flex flex-wrap gap-4 bg-white rounded-xl border border-neutral-200 p-5">
        {buttons.map((b, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <button
              className="px-6 py-3 font-semibold text-sm shadow-sm transition-all hover:opacity-90 active:scale-95 cursor-default"
              style={{
                backgroundColor: b.bg,
                color: b.text,
                borderRadius: b.radius,
              }}
            >
              {b.name.replace(/Button|Special|\(.*?\)/g, '').trim() || 'Button'}
            </button>
            <p className="text-[9px] text-neutral-400 text-center">{b.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpacingPreview({ spacing }: { spacing: DesignTokens['spacing'] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-neutral-800">Spacing System (8px grid)</h3>
      <div className="space-y-2 bg-white rounded-xl border border-neutral-200 p-5">
        {spacing.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-neutral-500 w-10 text-right">{s.name}</span>
            <div
              className="h-4 bg-blue-500/20 rounded border border-blue-500/30"
              style={{ width: s.size }}
            />
            <span className="text-[10px] text-neutral-400 font-mono">{s.size}</span>
            <span className="text-[10px] text-neutral-400 truncate">{s.usage}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calculator Visual Wireframe
// ---------------------------------------------------------------------------

function CalculatorWireframe() {
  const [display, setDisplay] = useState('579');
  const [expression, setExpression] = useState('123 + 456 =');

  const buttonRows = [
    [
      { label: 'C', style: 'danger' },
      { label: '\u00B1', style: 'secondary' },
      { label: '%', style: 'secondary' },
      { label: '\u00F7', style: 'primary' },
    ],
    [
      { label: '7', style: 'secondary' },
      { label: '8', style: 'secondary' },
      { label: '9', style: 'secondary' },
      { label: '\u00D7', style: 'primary' },
    ],
    [
      { label: '4', style: 'secondary' },
      { label: '5', style: 'secondary' },
      { label: '6', style: 'secondary' },
      { label: '\u2212', style: 'primary' },
    ],
    [
      { label: '1', style: 'secondary' },
      { label: '2', style: 'secondary' },
      { label: '3', style: 'secondary' },
      { label: '+', style: 'primary' },
    ],
    [
      { label: 'sin', style: 'accent' },
      { label: '0', style: 'secondary' },
      { label: '.', style: 'secondary' },
      { label: '=', style: 'success' },
    ],
  ];

  const styleMap: Record<string, { bg: string; text: string; hover: string }> = {
    primary: { bg: '#2563EB', text: '#FFFFFF', hover: '#3B82F6' },
    secondary: { bg: '#F9FAFB', text: '#1F2937', hover: '#E5E7EB' },
    success: { bg: '#10B981', text: '#FFFFFF', hover: '#34D399' },
    danger: { bg: '#EF4444', text: '#FFFFFF', hover: '#F87171' },
    accent: { bg: '#8B5CF6', text: '#FFFFFF', hover: '#A78BFA' },
  };

  const handleClick = (label: string) => {
    if (label === 'C') {
      setDisplay('0');
      setExpression('');
    } else if (label === '=') {
      try {
        const expr = expression.replace(/=\s*$/, '').replace(/\u00D7/g, '*').replace(/\u00F7/g, '/').replace(/\u2212/g, '-');
        const result = Function('"use strict"; return (' + expr + ')')();
        setDisplay(String(result));
        setExpression(expression + ' =');
      } catch { /* ignore */ }
    } else if (['+', '\u2212', '\u00D7', '\u00F7'].includes(label)) {
      const op = label;
      setExpression(display + ' ' + op + ' ');
      setDisplay('0');
    } else if (label === '%') {
      setDisplay(String(parseFloat(display) / 100));
    } else if (label === '\u00B1') {
      setDisplay(String(parseFloat(display) * -1));
    } else if (['sin', 'cos', 'tan', '\u221A', '^'].includes(label)) {
      // Scientific
      const val = parseFloat(display);
      const ops: Record<string, () => number> = {
        sin: () => Math.sin(val * Math.PI / 180),
        cos: () => Math.cos(val * Math.PI / 180),
        tan: () => Math.tan(val * Math.PI / 180),
        '\u221A': () => Math.sqrt(val),
      };
      if (ops[label]) setDisplay(String(Number(ops[label]().toFixed(8))));
    } else {
      // Digit or dot
      setDisplay(prev => prev === '0' && label !== '.' ? label : prev + label);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-full p-8" style={{ backgroundColor: '#F3F4F6', fontFamily: "'Inter', sans-serif" }}>
      <div
        className="w-[400px] overflow-hidden"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
          padding: '24px',
        }}
      >
        {/* Display */}
        <div
          style={{
            backgroundColor: '#1F2937',
            borderRadius: '8px',
            padding: '16px 24px',
            marginBottom: '16px',
            textAlign: 'right',
          }}
        >
          <div style={{ fontSize: '14px', color: '#9CA3AF', fontFamily: 'monospace', minHeight: '20px' }}>
            {expression}
          </div>
          <div style={{ fontSize: '36px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'monospace' }}>
            {display}
          </div>
        </div>

        {/* Button Grid */}
        <div className="grid grid-cols-4 gap-2">
          {buttonRows.flat().map((btn, i) => {
            const s = styleMap[btn.style];
            return (
              <button
                key={i}
                onClick={() => handleClick(btn.label)}
                className="aspect-square flex items-center justify-center transition-all active:scale-95 hover:opacity-90 cursor-pointer"
                style={{
                  backgroundColor: s.bg,
                  color: s.text,
                  borderRadius: '9999px',
                  fontSize: '18px',
                  fontWeight: 700,
                  border: btn.style === 'secondary' ? '1px solid #E5E7EB' : 'none',
                }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main: Design System Visual Renderer
// ---------------------------------------------------------------------------

export function DesignSystemRenderer({ content }: { content: string }) {
  const tokens = useMemo(() => parseDesignTokens(content), [content]);

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ backgroundColor: '#F3F4F6' }}>
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#2563EB' }}>
              <span className="text-white text-lg font-bold">=</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">Simple Calculator App</h1>
              <p className="text-xs text-neutral-500">UI Kit v1.0 &middot; Clean, minimal, and functional</p>
            </div>
          </div>
        </div>

        {/* Color Palette */}
        {tokens.colors.length > 0 && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <ColorPalette colors={tokens.colors} />
          </div>
        )}

        {/* Typography */}
        {tokens.typography.length > 0 && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <TypographyPreview typography={tokens.typography} />
          </div>
        )}

        {/* Buttons */}
        {tokens.buttons.length > 0 && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <ButtonPreview buttons={tokens.buttons} />
          </div>
        )}

        {/* Spacing */}
        {tokens.spacing.length > 0 && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <SpacingPreview spacing={tokens.spacing} />
          </div>
        )}

        {/* Live Calculator Preview */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-neutral-800 mb-4">Live Calculator Preview</h3>
          <div className="rounded-xl overflow-hidden border border-neutral-200" style={{ backgroundColor: '#F3F4F6' }}>
            <CalculatorWireframe />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wireframe Visual Renderer (Calculator Main Interface)
// ---------------------------------------------------------------------------

export function WireframeVisualRenderer({ content: _content }: { content: string }) {
  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ backgroundColor: '#F3F4F6' }}>
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <h1 className="text-xl font-bold text-neutral-900">Calculator Main Interface</h1>
          <p className="text-xs text-neutral-500 mt-1">Wireframe preview &middot; Desktop &middot; 400px fixed width</p>
        </div>

        {/* Interactive Calculator */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <CalculatorWireframe />
        </div>

        {/* Device Previews */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
            <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-3">Desktop</p>
            <div className="aspect-[16/10] bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-center overflow-hidden">
              <div className="scale-[0.35] origin-center">
                <CalculatorWireframe />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
            <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-3">Tablet</p>
            <div className="aspect-[3/4] bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-center overflow-hidden">
              <div className="scale-[0.35] origin-center">
                <CalculatorWireframe />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
            <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-3">Mobile</p>
            <div className="aspect-[9/16] bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-center overflow-hidden">
              <div className="scale-[0.3] origin-center">
                <CalculatorWireframe />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
