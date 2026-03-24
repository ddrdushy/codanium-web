// ---------------------------------------------------------------------------
// .pen → HTML / React conversion engine
// ---------------------------------------------------------------------------

import type { PenNode, PenDocument } from '@/components/pen-renderer/PenRenderer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function indent(depth: number): string {
  return '  '.repeat(depth);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resolveVariable(content: string, variables?: Record<string, string>): string {
  if (!variables || !content.includes('$')) return content;
  return content.replace(/\$([a-zA-Z_][\w.]*)/g, (_, key) => variables[key] ?? `$${key}`);
}

// ---------------------------------------------------------------------------
// Tailwind class generation
// ---------------------------------------------------------------------------

function twJustify(v?: string): string {
  if (!v) return '';
  const map: Record<string, string> = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    space_between: 'justify-between',
    space_around: 'justify-around',
  };
  return map[v] ?? '';
}

function twAlign(v?: string): string {
  if (!v) return '';
  const map: Record<string, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  };
  return map[v] ?? '';
}

function twGap(gap?: number): string {
  if (gap === undefined) return '';
  // Tailwind gap uses 4px steps: gap-1 = 4px, gap-2 = 8px, etc.
  const tw = gap / 4;
  if (Number.isInteger(tw) && tw >= 0 && tw <= 96) return `gap-${tw}`;
  return `gap-[${gap}px]`;
}

function twWidth(w?: number | 'fill_container' | 'fit_content'): string {
  if (w === undefined) return '';
  if (w === 'fill_container') return 'w-full flex-1';
  if (w === 'fit_content') return 'w-fit';
  return `w-[${w}px]`;
}

function twHeight(h?: number | 'fill_container' | 'fit_content'): string {
  if (h === undefined) return '';
  if (h === 'fill_container') return 'h-full flex-1';
  if (h === 'fit_content') return 'h-fit';
  return `h-[${h}px]`;
}

function twPadding(p?: number | [number, number] | [number, number, number, number]): string {
  if (p === undefined) return '';
  if (typeof p === 'number') {
    const tw = p / 4;
    if (Number.isInteger(tw) && tw >= 0 && tw <= 96) return `p-${tw}`;
    return `p-[${p}px]`;
  }
  if (p.length === 2) {
    const [y, x] = p;
    return `px-[${x}px] py-[${y}px]`;
  }
  const [top, right, bottom, left] = p;
  return `pt-[${top}px] pr-[${right}px] pb-[${bottom}px] pl-[${left}px]`;
}

function twCornerRadius(r?: number | [number, number, number, number]): string {
  if (r === undefined) return '';
  if (typeof r === 'number') {
    if (r === 0) return '';
    return `rounded-[${r}px]`;
  }
  return `rounded-[${r[0]}px_${r[1]}px_${r[2]}px_${r[3]}px]`;
}

function twFill(fill?: string | { type: string; angle?: number; stops: { color: string; position: number }[] }, isText?: boolean): string {
  if (!fill) return '';
  if (typeof fill === 'string') {
    if (fill.startsWith('#')) {
      return isText ? `text-[${fill}]` : `bg-[${fill}]`;
    }
    return '';
  }
  // Gradient — use arbitrary value
  return '';
}

function twFillStyle(fill?: string | { type: string; angle?: number; stops: { color: string; position: number }[] }, isText?: boolean): string {
  if (!fill || typeof fill === 'string') return '';
  // Gradient needs inline style
  const g = fill as { type: string; angle?: number; stops: { color: string; position: number }[] };
  const stops = g.stops.map(s => `${s.color} ${s.position * 100}%`).join(', ');
  if (g.type === 'radial') return `background: radial-gradient(circle, ${stops})`;
  return `background: linear-gradient(${g.angle ?? 180}deg, ${stops})`;
}

function twOpacity(o?: number): string {
  if (o === undefined || o === 1) return '';
  const pct = Math.round(o * 100);
  return `opacity-[${pct / 100}]`;
}

function twFontSize(size?: number): string {
  if (!size) return '';
  const map: Record<number, string> = {
    12: 'text-xs', 14: 'text-sm', 16: 'text-base', 18: 'text-lg',
    20: 'text-xl', 24: 'text-2xl', 30: 'text-3xl', 36: 'text-4xl',
    48: 'text-5xl', 60: 'text-6xl',
  };
  return map[size] ?? `text-[${size}px]`;
}

function twFontWeight(w?: number | string): string {
  if (!w) return '';
  const n = typeof w === 'string' ? parseInt(w, 10) : w;
  const map: Record<number, string> = {
    100: 'font-thin', 200: 'font-extralight', 300: 'font-light',
    400: 'font-normal', 500: 'font-medium', 600: 'font-semibold',
    700: 'font-bold', 800: 'font-extrabold', 900: 'font-black',
  };
  return map[n] ?? `font-[${n}]`;
}

function twTextAlign(a?: string): string {
  if (!a) return '';
  return `text-${a}`;
}

// ---------------------------------------------------------------------------
// Determine heading tag from fontSize
// ---------------------------------------------------------------------------

function textTag(fontSize?: number): string {
  if (!fontSize) return 'p';
  if (fontSize >= 32) return 'h1';
  if (fontSize >= 24) return 'h2';
  if (fontSize >= 18) return 'h3';
  return 'p';
}

// ---------------------------------------------------------------------------
// Build Tailwind className for a node
// ---------------------------------------------------------------------------

function buildTwClasses(node: PenNode, isText: boolean): string[] {
  const cls: string[] = [];

  // Layout
  if (node.type === 'frame' || node.type === 'rectangle') {
    if (node.layout === 'none') {
      cls.push('relative');
    } else {
      cls.push('flex');
      cls.push(node.layout === 'horizontal' ? 'flex-row' : 'flex-col');
    }
    const jc = twJustify(node.justifyContent);
    if (jc) cls.push(jc);
    const ai = twAlign(node.alignItems);
    if (ai) cls.push(ai);
    const g = twGap(node.gap);
    if (g) cls.push(g);
  }

  // Ellipse
  if (node.type === 'ellipse') {
    cls.push('rounded-full');
  }

  // Sizing
  const w = twWidth(node.width);
  if (w) cls.push(w);
  const h = twHeight(node.height);
  if (h) cls.push(h);

  // Absolute positioning
  if (node.x !== undefined || node.y !== undefined) {
    cls.push('absolute');
    if (node.x !== undefined) cls.push(`left-[${node.x}px]`);
    if (node.y !== undefined) cls.push(`top-[${node.y}px]`);
  }

  // Fill
  const fc = twFill(node.fill, isText);
  if (fc) cls.push(fc);

  // Corner radius
  if (node.type !== 'ellipse') {
    const cr = twCornerRadius(node.cornerRadius);
    if (cr) cls.push(cr);
  }

  // Opacity
  const op = twOpacity(node.opacity);
  if (op) cls.push(op);

  // Padding
  const pd = twPadding(node.padding);
  if (pd) cls.push(pd);

  // Stroke — use arbitrary border
  if (node.stroke) {
    cls.push(`border-[${node.stroke.width}px]`);
    cls.push(`border-[${node.stroke.color}]`);
  }

  // Shadow
  if (node.shadow) {
    const s = node.shadow;
    cls.push(`shadow-[${s.x}px_${s.y}px_${s.blur}px_${s.spread ?? 0}px_${s.color}]`);
  }

  // Text styles
  if (isText) {
    const fs = twFontSize(node.fontSize);
    if (fs) cls.push(fs);
    const fw = twFontWeight(node.fontWeight);
    if (fw) cls.push(fw);
    const ta = twTextAlign(node.textAlign);
    if (ta) cls.push(ta);
    if (node.fontFamily) cls.push(`font-['${node.fontFamily.replace(/ /g, '_')}']`);
  }

  // Visibility
  if (node.visible === false) cls.push('hidden');

  return cls;
}

// ---------------------------------------------------------------------------
// penToReactComponent
// ---------------------------------------------------------------------------

export function penToReactComponent(doc: PenDocument): string {
  const componentName = sanitizeComponentName(doc.name ?? 'PenComponent');
  const lines: string[] = [];

  lines.push(`export default function ${componentName}() {`);

  // CSS custom properties from variables
  if (doc.variables && Object.keys(doc.variables).length > 0) {
    lines.push(`${indent(1)}const cssVars = {`);
    for (const [key, value] of Object.entries(doc.variables)) {
      const prop = `--${key.replace(/\./g, '-')}`;
      lines.push(`${indent(2)}'${prop}': '${value}',`);
    }
    lines.push(`${indent(1)}} as React.CSSProperties;`);
    lines.push('');
  }

  // Resolve components lookup
  const components = doc.components ?? {};

  const hasVars = doc.variables && Object.keys(doc.variables).length > 0;
  const rootStyle = hasVars ? ' style={cssVars}' : '';

  lines.push(`${indent(1)}return (`);
  lines.push(`${indent(2)}<div className="min-h-screen"${rootStyle}>`);

  const nodes = doc.children ?? doc.pages?.[0]?.children ?? [];
  for (const node of nodes) {
    renderNodeReact(node, components, doc.variables, lines, 3);
  }

  lines.push(`${indent(2)}</div>`);
  lines.push(`${indent(1)});`);
  lines.push('}');

  return lines.join('\n');
}

function renderNodeReact(
  node: PenNode,
  components: Record<string, PenNode>,
  variables: Record<string, string> | undefined,
  lines: string[],
  depth: number,
): void {
  if (node.visible === false) return;
  if (node.reusable) return;

  // Resolve ref
  if (node.type === 'ref' && node.refId && components[node.refId]) {
    const base = components[node.refId];
    const merged: PenNode = { ...base, ...(node.overrides ?? {}), type: base.type, children: (node.overrides?.children as PenNode[] | undefined) ?? base.children };
    renderNodeReact(merged, components, variables, lines, depth);
    return;
  }

  const isText = node.type === 'text';
  const classes = buildTwClasses(node, isText);
  const classStr = classes.length > 0 ? ` className="${classes.join(' ')}"` : '';

  // Inline style for gradients
  const gradStyle = twFillStyle(node.fill, isText);
  let styleStr = '';
  if (gradStyle) {
    // Convert "background: value" into JSX style object
    const colonIdx = gradStyle.indexOf(':');
    const prop = gradStyle.slice(0, colonIdx).trim();
    const val = gradStyle.slice(colonIdx + 1).trim();
    styleStr = ` style={{ ${prop}: '${val}' }}`;
  }

  if (isText) {
    const tag = textTag(node.fontSize);
    const content = node.content ? resolveVariable(node.content, variables) : '';
    lines.push(`${indent(depth)}<${tag}${classStr}${styleStr}>${escapeHtml(content)}</${tag}>`);
    return;
  }

  // Container nodes
  const children = node.children ?? [];
  if (children.length === 0) {
    lines.push(`${indent(depth)}<div${classStr}${styleStr} />`);
    return;
  }

  lines.push(`${indent(depth)}<div${classStr}${styleStr}>`);
  for (const child of children) {
    renderNodeReact(child, components, variables, lines, depth + 1);
  }
  lines.push(`${indent(depth)}</div>`);
}

function sanitizeComponentName(name: string): string {
  // Remove non-alphanumeric, capitalize words
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  if (!cleaned) return 'PenComponent';
  return cleaned
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

// ---------------------------------------------------------------------------
// penToHTML — plain HTML + inline CSS output
// ---------------------------------------------------------------------------

export function penToHTML(doc: PenDocument): string {
  const title = doc.name ?? 'Pen Document';
  const components = doc.components ?? {};
  const variables = doc.variables;

  const bodyLines: string[] = [];
  const nodes = doc.children ?? doc.pages?.[0]?.children ?? [];
  for (const node of nodes) {
    renderNodeHTML(node, components, variables, bodyLines, 2);
  }

  // CSS custom properties
  let rootVars = '';
  if (variables && Object.keys(variables).length > 0) {
    const vars = Object.entries(variables)
      .map(([key, value]) => `      --${key.replace(/\./g, '-')}: ${value};`)
      .join('\n');
    rootVars = `\n    :root {\n${vars}\n    }`;
  }

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }${rootVars}
    </style>
  </head>
  <body>
${bodyLines.join('\n')}
  </body>
</html>`;
}

// ---------------------------------------------------------------------------
// CSS style string builder for HTML output
// ---------------------------------------------------------------------------

function buildInlineCSS(node: PenNode, isText: boolean): string {
  const styles: string[] = [];

  // Layout
  if (node.type === 'frame' || node.type === 'rectangle') {
    if (node.layout === 'none') {
      styles.push('position: relative');
    } else {
      styles.push('display: flex');
      styles.push(`flex-direction: ${node.layout === 'horizontal' ? 'row' : 'column'}`);
    }
    if (node.justifyContent) {
      const map: Record<string, string> = {
        start: 'flex-start', center: 'center', end: 'flex-end',
        space_between: 'space-between', space_around: 'space-around',
      };
      styles.push(`justify-content: ${map[node.justifyContent] ?? node.justifyContent}`);
    }
    if (node.alignItems) {
      const map: Record<string, string> = {
        start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch',
      };
      styles.push(`align-items: ${map[node.alignItems] ?? node.alignItems}`);
    }
    if (node.gap !== undefined) styles.push(`gap: ${node.gap}px`);
  }

  // Ellipse
  if (node.type === 'ellipse') {
    styles.push('border-radius: 50%');
  }

  // Sizing
  if (node.width !== undefined) {
    if (node.width === 'fill_container') {
      styles.push('flex: 1');
      styles.push('width: 100%');
    } else if (node.width === 'fit_content') {
      styles.push('width: fit-content');
    } else {
      styles.push(`width: ${node.width}px`);
    }
  }
  if (node.height !== undefined) {
    if (node.height === 'fill_container') {
      styles.push('flex: 1');
      styles.push('height: 100%');
    } else if (node.height === 'fit_content') {
      styles.push('height: fit-content');
    } else {
      styles.push(`height: ${node.height}px`);
    }
  }

  // Absolute positioning
  if (node.x !== undefined || node.y !== undefined) {
    styles.push('position: absolute');
    if (node.x !== undefined) styles.push(`left: ${node.x}px`);
    if (node.y !== undefined) styles.push(`top: ${node.y}px`);
  }

  // Fill
  if (node.fill) {
    if (typeof node.fill === 'string') {
      styles.push(isText ? `color: ${node.fill}` : `background-color: ${node.fill}`);
    } else {
      const g = node.fill as { type: string; angle?: number; stops: { color: string; position: number }[] };
      const stops = g.stops.map(s => `${s.color} ${s.position * 100}%`).join(', ');
      const grad = g.type === 'radial'
        ? `radial-gradient(circle, ${stops})`
        : `linear-gradient(${g.angle ?? 180}deg, ${stops})`;
      if (isText) {
        styles.push(`background-image: ${grad}`);
        styles.push('-webkit-background-clip: text');
        styles.push('-webkit-text-fill-color: transparent');
      } else {
        styles.push(`background: ${grad}`);
      }
    }
  }

  // Corner radius
  if (node.cornerRadius !== undefined && node.type !== 'ellipse') {
    if (typeof node.cornerRadius === 'number') {
      styles.push(`border-radius: ${node.cornerRadius}px`);
    } else {
      styles.push(`border-radius: ${node.cornerRadius.map(v => `${v}px`).join(' ')}`);
    }
  }

  // Opacity
  if (node.opacity !== undefined && node.opacity !== 1) {
    styles.push(`opacity: ${node.opacity}`);
  }

  // Stroke
  if (node.stroke) {
    styles.push(`border: ${node.stroke.width}px solid ${node.stroke.color}`);
  }

  // Shadow
  if (node.shadow) {
    const s = node.shadow;
    styles.push(`box-shadow: ${s.x}px ${s.y}px ${s.blur}px ${s.spread ?? 0}px ${s.color}`);
  }

  // Padding
  if (node.padding !== undefined) {
    if (typeof node.padding === 'number') {
      styles.push(`padding: ${node.padding}px`);
    } else if (node.padding.length === 2) {
      styles.push(`padding: ${node.padding[0]}px ${node.padding[1]}px`);
    } else {
      styles.push(`padding: ${node.padding[0]}px ${node.padding[1]}px ${node.padding[2]}px ${node.padding[3]}px`);
    }
  }

  // Text styles
  if (isText) {
    if (node.fontFamily) styles.push(`font-family: '${node.fontFamily}', sans-serif`);
    if (node.fontSize) styles.push(`font-size: ${node.fontSize}px`);
    if (node.fontWeight) styles.push(`font-weight: ${node.fontWeight}`);
    if (node.lineHeight) {
      styles.push(`line-height: ${typeof node.lineHeight === 'number' ? `${node.lineHeight}px` : node.lineHeight}`);
    }
    if (node.letterSpacing !== undefined) styles.push(`letter-spacing: ${node.letterSpacing}px`);
    if (node.textAlign) styles.push(`text-align: ${node.textAlign}`);
  }

  // Visibility
  if (node.visible === false) styles.push('display: none');

  return styles.join('; ');
}

function renderNodeHTML(
  node: PenNode,
  components: Record<string, PenNode>,
  variables: Record<string, string> | undefined,
  lines: string[],
  depth: number,
): void {
  if (node.visible === false) return;
  if (node.reusable) return;

  // Resolve ref
  if (node.type === 'ref' && node.refId && components[node.refId]) {
    const base = components[node.refId];
    const merged: PenNode = { ...base, ...(node.overrides ?? {}), type: base.type, children: (node.overrides?.children as PenNode[] | undefined) ?? base.children };
    renderNodeHTML(merged, components, variables, lines, depth);
    return;
  }

  const isText = node.type === 'text';
  const css = buildInlineCSS(node, isText);
  const styleAttr = css ? ` style="${css}"` : '';

  if (isText) {
    const tag = textTag(node.fontSize);
    const content = node.content ? resolveVariable(node.content, variables) : '';
    lines.push(`${indent(depth)}<${tag}${styleAttr}>${escapeHtml(content)}</${tag}>`);
    return;
  }

  const children = node.children ?? [];
  if (children.length === 0) {
    lines.push(`${indent(depth)}<div${styleAttr}></div>`);
    return;
  }

  lines.push(`${indent(depth)}<div${styleAttr}>`);
  for (const child of children) {
    renderNodeHTML(child, components, variables, lines, depth + 1);
  }
  lines.push(`${indent(depth)}</div>`);
}
