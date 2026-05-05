'use client';

import React, { useState, useMemo } from 'react';

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
// Calculator Visual Wireframe — matches actual generated Calculator.tsx output
// ---------------------------------------------------------------------------

function CalculatorWireframe() {
  const [display, setDisplay] = useState('0');
  const [mode, setMode] = useState<'basic' | 'scientific'>('basic');
  const [pendingOp, setPendingOp] = useState<string | null>(null);
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [freshResult, setFreshResult] = useState(false);

  const inputDigit = (digit: string) => {
    setDisplay(prev => (prev === '0' || freshResult) ? digit : prev + digit);
    setFreshResult(false);
  };

  const inputDecimal = () => {
    if (!display.includes('.')) setDisplay(prev => prev + '.');
    setFreshResult(false);
  };

  const setOperation = (op: string) => {
    setPrevValue(parseFloat(display));
    setPendingOp(op);
    setFreshResult(true);
  };

  const calculate = () => {
    if (pendingOp === null || prevValue === null) return;
    const curr = parseFloat(display);
    let result = 0;
    switch (pendingOp) {
      case 'add': result = prevValue + curr; break;
      case 'subtract': result = prevValue - curr; break;
      case 'multiply': result = prevValue * curr; break;
      case 'divide': result = curr !== 0 ? prevValue / curr : 0; break;
    }
    setDisplay(String(Number(result.toFixed(10))));
    setPendingOp(null);
    setPrevValue(null);
    setFreshResult(true);
  };

  const clear = () => {
    setDisplay('0');
    setPendingOp(null);
    setPrevValue(null);
    setFreshResult(false);
  };

  const toggleSign = () => setDisplay(String(parseFloat(display) * -1));
  const percentage = () => setDisplay(String(parseFloat(display) / 100));

  const scientific = (op: string) => {
    const val = parseFloat(display);
    const rad = val * Math.PI / 180;
    const ops: Record<string, () => number> = {
      sqrt: () => Math.sqrt(val), square: () => val * val, cube: () => val ** 3,
      sin: () => Math.sin(rad), cos: () => Math.cos(rad), tan: () => Math.tan(rad),
      log: () => Math.log10(val), ln: () => Math.log(val),
      factorial: () => { let f = 1; for (let i = 2; i <= val; i++) f *= i; return f; },
      reciprocal: () => 1 / val, exp: () => Math.exp(val), pi: () => Math.PI,
    };
    if (ops[op]) { setDisplay(String(Number(ops[op]().toFixed(10)))); setFreshResult(true); }
  };

  // Exact button style from generated Calculator.tsx
  const digitBtn = "p-4 bg-gray-200 rounded-lg hover:bg-gray-300 text-base font-medium cursor-pointer transition-colors active:scale-95";
  const opBtn = "p-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-base font-medium cursor-pointer transition-colors active:scale-95";
  const sciBtn = "p-4 bg-gray-300 rounded-lg hover:bg-gray-400 text-base font-medium cursor-pointer transition-colors active:scale-95";

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-8" style={{ backgroundColor: '#F9FAFB', fontFamily: "'Inter', sans-serif" }}>
      {/* Title — matches generated output */}
      <h1 className="text-3xl font-bold text-blue-600 mb-6">Calculator App</h1>

      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        {/* Display */}
        <div className="mb-4 p-4 bg-gray-100 rounded-lg text-right text-2xl font-medium h-16 flex items-center justify-end">
          <span className="overflow-hidden text-ellipsis max-w-full">{display}</span>
        </div>

        {/* Row 1: AC (col-span-2), SCI, MC */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          <button className={`col-span-2 ${digitBtn}`} onClick={clear}>AC</button>
          <button className={digitBtn} onClick={() => setMode(mode === 'basic' ? 'scientific' : 'basic')}>
            {mode === 'basic' ? 'SCI' : 'BASIC'}
          </button>
          <button className={digitBtn}>MC</button>
        </div>

        {/* Row 2: MR, M+, +/-, % */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          <button className={digitBtn}>MR</button>
          <button className={digitBtn}>M+</button>
          <button className={digitBtn} onClick={toggleSign}>+/-</button>
          <button className={digitBtn} onClick={percentage}>%</button>
        </div>

        {mode === 'basic' ? (
          /* Basic Mode Grid — exact match to generated code */
          <div className="grid grid-cols-4 gap-2">
            <button className={digitBtn} onClick={() => inputDigit('7')}>7</button>
            <button className={digitBtn} onClick={() => inputDigit('8')}>8</button>
            <button className={digitBtn} onClick={() => inputDigit('9')}>9</button>
            <button className={opBtn} onClick={() => setOperation('divide')}>/</button>

            <button className={digitBtn} onClick={() => inputDigit('4')}>4</button>
            <button className={digitBtn} onClick={() => inputDigit('5')}>5</button>
            <button className={digitBtn} onClick={() => inputDigit('6')}>6</button>
            <button className={opBtn} onClick={() => setOperation('multiply')}>*</button>

            <button className={digitBtn} onClick={() => inputDigit('1')}>1</button>
            <button className={digitBtn} onClick={() => inputDigit('2')}>2</button>
            <button className={digitBtn} onClick={() => inputDigit('3')}>3</button>
            <button className={opBtn} onClick={() => setOperation('subtract')}>-</button>

            <button className={digitBtn} onClick={() => inputDigit('0')}>0</button>
            <button className={digitBtn} onClick={inputDecimal}>.</button>
            <button className={digitBtn} onClick={calculate}>=</button>
            <button className={opBtn} onClick={() => setOperation('add')}>+</button>
          </div>
        ) : (
          /* Scientific Mode Grid — exact match to generated code */
          <div className="grid grid-cols-4 gap-2">
            <button className={sciBtn} onClick={() => scientific('sqrt')}>{'\u221A'}</button>
            <button className={sciBtn} onClick={() => scientific('square')}>x{'\u00B2'}</button>
            <button className={sciBtn} onClick={() => scientific('cube')}>x{'\u00B3'}</button>
            <button className={opBtn} onClick={() => setOperation('divide')}>/</button>

            <button className={sciBtn} onClick={() => scientific('sin')}>sin</button>
            <button className={sciBtn} onClick={() => scientific('cos')}>cos</button>
            <button className={sciBtn} onClick={() => scientific('tan')}>tan</button>
            <button className={opBtn} onClick={() => setOperation('multiply')}>*</button>

            <button className={sciBtn} onClick={() => scientific('log')}>log</button>
            <button className={sciBtn} onClick={() => scientific('ln')}>ln</button>
            <button className={sciBtn} onClick={() => scientific('exp')}>exp</button>
            <button className={opBtn} onClick={() => setOperation('subtract')}>-</button>

            <button className={sciBtn} onClick={() => scientific('pi')}>{'\u03C0'}</button>
            <button className={sciBtn} onClick={() => scientific('factorial')}>n!</button>
            <button className={digitBtn} onClick={calculate}>=</button>
            <button className={opBtn} onClick={() => setOperation('add')}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Markdown Renderer for wireframe / design system content
// ---------------------------------------------------------------------------
// Renders the actual stored markdown content with wireframe-friendly styling.
// Replaces the previous hardcoded calculator demo.

function MarkdownContentRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none
      prose-headings:text-neutral-900 prose-headings:font-bold
      prose-h1:text-2xl prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b prose-h1:border-neutral-200
      prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:text-neutral-800
      prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-neutral-700
      prose-h4:text-sm prose-h4:mt-3 prose-h4:mb-1 prose-h4:text-neutral-700
      prose-p:text-sm prose-p:text-neutral-600 prose-p:leading-relaxed prose-p:my-2
      prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5
      prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-5
      prose-li:text-sm prose-li:text-neutral-600 prose-li:my-0.5
      prose-strong:text-neutral-800 prose-strong:font-semibold
      prose-em:text-neutral-600
      prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-[''] prose-code:after:content-['']
      prose-pre:bg-neutral-50 prose-pre:border prose-pre:border-neutral-200 prose-pre:rounded-lg
      prose-table:text-xs prose-table:border-collapse
      prose-th:bg-neutral-50 prose-th:text-neutral-800 prose-th:font-semibold prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-neutral-200
      prose-td:text-neutral-600 prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-neutral-200
      prose-hr:border-neutral-200 prose-hr:my-4
      prose-blockquote:border-l-2 prose-blockquote:border-blue-300 prose-blockquote:pl-3 prose-blockquote:text-neutral-600 prose-blockquote:italic">
      <SimpleMarkdown content={content} />
    </div>
  );
}

// Lightweight markdown renderer (no external lib needed for simple wireframe content)
function SimpleMarkdown({ content }: { content: string }) {
  // Split into blocks by double newlines, then render each block
  const blocks = content.split(/\n\n+/);

  return (
    <>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Heading
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const text = headingMatch[2];
          const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
          return <Tag key={i}>{renderInline(text)}</Tag>;
        }

        // Horizontal rule
        if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
          return <hr key={i} />;
        }

        // Unordered list
        if (/^[-*+]\s+/m.test(trimmed)) {
          const items = trimmed.split('\n').filter(l => /^[-*+]\s+/.test(l));
          return (
            <ul key={i}>
              {items.map((item, j) => (
                <li key={j}>{renderInline(item.replace(/^[-*+]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }

        // Ordered list
        if (/^\d+\.\s+/m.test(trimmed)) {
          const items = trimmed.split('\n').filter(l => /^\d+\.\s+/.test(l));
          return (
            <ol key={i}>
              {items.map((item, j) => (
                <li key={j}>{renderInline(item.replace(/^\d+\.\s+/, ''))}</li>
              ))}
            </ol>
          );
        }

        // Code block
        if (trimmed.startsWith('```')) {
          const code = trimmed.replace(/^```\w*\n?/, '').replace(/```$/, '');
          return (
            <pre key={i}>
              <code>{code}</code>
            </pre>
          );
        }

        // Blockquote
        if (trimmed.startsWith('>')) {
          return (
            <blockquote key={i}>
              {renderInline(trimmed.replace(/^>\s*/gm, ''))}
            </blockquote>
          );
        }

        // Table (simple GFM)
        if (trimmed.includes('|') && trimmed.includes('---')) {
          const lines = trimmed.split('\n').filter(l => l.includes('|'));
          if (lines.length >= 2) {
            const headerCells = lines[0].split('|').map(c => c.trim()).filter(Boolean);
            const bodyRows = lines.slice(2).map(l =>
              l.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 || arr[0] !== '')
            );
            return (
              <table key={i}>
                <thead>
                  <tr>{headerCells.map((cell, j) => <th key={j}>{renderInline(cell)}</th>)}</tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, j) => (
                    <tr key={j}>{row.map((cell, k) => <td key={k}>{renderInline(cell)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            );
          }
        }

        // Default: paragraph
        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </>
  );
}

// Render inline markdown: **bold**, *italic*, `code`
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    // Italic *text*
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }
    // Inline code `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(<code key={key++}>{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    // Link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(<a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{linkMatch[1]}</a>);
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }
    // Plain character
    const nextSpecial = remaining.search(/[\*`\[]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    }
    if (nextSpecial > 0) {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    } else {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Main: Design System Visual Renderer
// ---------------------------------------------------------------------------
// Renders the design system / UI Kit document. Parses design tokens for
// the visual color/typography/spacing/button previews and falls back to
// a markdown rendering for any sections that don't match the parsers.

export function DesignSystemRenderer({ content }: { content: string }) {
  const tokens = useMemo(() => parseDesignTokens(content), [content]);

  // Extract title from first H1 in the content
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() || 'Design System';

  // Check if any tokens were extracted — if not, just render markdown
  const hasTokens = tokens.colors.length > 0 || tokens.typography.length > 0 ||
                    tokens.buttons.length > 0 || tokens.spacing.length > 0;

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ backgroundColor: '#F3F4F6' }}>
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
          <p className="text-xs text-neutral-500 mt-1">UI Kit / Design System</p>
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

        {/* Full Markdown Content */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          {hasTokens && <h2 className="text-sm font-semibold text-neutral-800 mb-3 uppercase tracking-wider">Full Specification</h2>}
          <MarkdownContentRenderer content={content} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wireframe Visual Renderer
// ---------------------------------------------------------------------------
// Renders the wireframe markdown content as a styled spec document.

export function WireframeVisualRenderer({ content }: { content: string }) {
  // Extract title from first H1 in the content
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.replace(/^Wireframe:\s*/i, '').trim() || 'Wireframe';

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ backgroundColor: '#F3F4F6' }}>
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
          </div>
          <p className="text-xs text-neutral-500 mt-1">Wireframe specification &middot; Page layout & components</p>
        </div>

        {/* Wireframe Markdown Content */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <MarkdownContentRenderer content={content} />
        </div>
      </div>
    </div>
  );
}
