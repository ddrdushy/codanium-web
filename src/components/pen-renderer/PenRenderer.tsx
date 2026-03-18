'use client';

import { useState, useMemo, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PenNode {
  id?: string;
  type: 'frame' | 'text' | 'rectangle' | 'ellipse' | 'ref';
  name?: string;
  // Layout
  layout?: 'vertical' | 'horizontal' | 'none';
  justifyContent?: 'start' | 'center' | 'end' | 'space_between' | 'space_around';
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  gap?: number;
  // Sizing
  width?: number | 'fill_container' | 'fit_content';
  height?: number | 'fill_container' | 'fit_content';
  // Visual
  fill?: string | PenGradient;
  cornerRadius?: number | [number, number, number, number];
  opacity?: number;
  stroke?: { color: string; width: number };
  shadow?: { color: string; x: number; y: number; blur: number; spread?: number };
  padding?: number | [number, number] | [number, number, number, number];
  // Text
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  lineHeight?: number | string;
  letterSpacing?: number;
  textAlign?: 'left' | 'center' | 'right';
  // Component reference
  refId?: string;
  overrides?: Record<string, unknown>;
  // Reusable component definition
  reusable?: boolean;
  // Children
  children?: PenNode[];
  // Visibility
  visible?: boolean;
  // Absolute positioning (for layout: "none")
  x?: number;
  y?: number;
}

interface PenGradient {
  type: 'linear' | 'radial';
  angle?: number;
  stops: { color: string; position: number }[];
}

export interface PenDocument {
  name?: string;
  width?: number;
  height?: number;
  variables?: Record<string, string>;
  components?: Record<string, PenNode>;
  pages?: PenPage[];
  children?: PenNode[];
}

export interface PenPage {
  name: string;
  children: PenNode[];
  width?: number;
  height?: number;
}

export interface PenRendererProps {
  document: PenDocument;
  className?: string;
}

// ---------------------------------------------------------------------------
// Style mapper
// ---------------------------------------------------------------------------

function mapJustify(v?: string): string | undefined {
  if (!v) return undefined;
  const map: Record<string, string> = {
    start: 'flex-start', center: 'center', end: 'flex-end',
    space_between: 'space-between', space_around: 'space-around',
  };
  return map[v];
}

function mapAlign(v?: string): string | undefined {
  if (!v) return undefined;
  const map: Record<string, string> = {
    start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch',
  };
  return map[v];
}

function resolvePadding(p?: number | [number, number] | [number, number, number, number]): string | undefined {
  if (p === undefined) return undefined;
  if (typeof p === 'number') return `${p}px`;
  if (p.length === 2) return `${p[1]}px ${p[0]}px`;
  return `${p[0]}px ${p[1]}px ${p[2]}px ${p[3]}px`;
}

function resolveRadius(r?: number | [number, number, number, number]): string | undefined {
  if (r === undefined) return undefined;
  if (typeof r === 'number') return `${r}px`;
  return `${r[0]}px ${r[1]}px ${r[2]}px ${r[3]}px`;
}

function resolveGradient(g: PenGradient): string {
  const stops = g.stops.map(s => `${s.color} ${s.position * 100}%`).join(', ');
  if (g.type === 'radial') return `radial-gradient(circle, ${stops})`;
  return `linear-gradient(${g.angle ?? 180}deg, ${stops})`;
}

function resolveFill(fill: string | PenGradient | undefined, isText: boolean): Partial<CSSProperties> {
  if (!fill) return {};
  if (typeof fill === 'string') {
    return isText ? { color: fill } : { backgroundColor: fill };
  }
  return isText
    ? { backgroundImage: resolveGradient(fill), WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
    : { background: resolveGradient(fill) };
}

function resolveDimension(v: number | 'fill_container' | 'fit_content' | undefined, axis: 'width' | 'height'): Partial<CSSProperties> {
  if (v === undefined) return {};
  if (v === 'fill_container') return { flex: 1, [axis]: '100%' };
  if (v === 'fit_content') return { [axis]: 'fit-content' };
  return { [axis]: `${v}px` };
}

function resolveVariable(content: string, variables?: Record<string, string>): string {
  if (!variables || !content.includes('$')) return content;
  return content.replace(/\$([a-zA-Z_][\w.]*)/g, (_, key) => variables[key] ?? `$${key}`);
}

function buildStyle(node: PenNode, variables?: Record<string, string>): CSSProperties {
  const isText = node.type === 'text';
  const style: CSSProperties = {};

  // Layout
  if (node.type === 'frame' || node.type === 'rectangle') {
    if (node.layout === 'none') {
      style.position = 'relative';
    } else {
      style.display = 'flex';
      style.flexDirection = node.layout === 'horizontal' ? 'row' : 'column';
    }
    if (node.justifyContent) style.justifyContent = mapJustify(node.justifyContent);
    if (node.alignItems) style.alignItems = mapAlign(node.alignItems);
    if (node.gap !== undefined) style.gap = `${node.gap}px`;
  }

  // Ellipse
  if (node.type === 'ellipse') {
    style.borderRadius = '50%';
  }

  // Sizing
  Object.assign(style, resolveDimension(node.width, 'width'));
  Object.assign(style, resolveDimension(node.height, 'height'));

  // Absolute positioning for children of layout: "none"
  if (node.x !== undefined || node.y !== undefined) {
    style.position = 'absolute';
    if (node.x !== undefined) style.left = `${node.x}px`;
    if (node.y !== undefined) style.top = `${node.y}px`;
  }

  // Visual
  Object.assign(style, resolveFill(node.fill, isText));
  if (node.cornerRadius !== undefined && node.type !== 'ellipse') {
    style.borderRadius = resolveRadius(node.cornerRadius);
  }
  if (node.opacity !== undefined) style.opacity = node.opacity;
  if (node.stroke) {
    style.border = `${node.stroke.width}px solid ${node.stroke.color}`;
  }
  if (node.shadow) {
    const s = node.shadow;
    style.boxShadow = `${s.x}px ${s.y}px ${s.blur}px ${s.spread ?? 0}px ${s.color}`;
  }
  if (node.padding !== undefined) style.padding = resolvePadding(node.padding);

  // Text
  if (isText) {
    if (node.fontFamily) style.fontFamily = node.fontFamily;
    if (node.fontSize) style.fontSize = `${node.fontSize}px`;
    if (node.fontWeight) style.fontWeight = node.fontWeight;
    if (node.lineHeight) {
      style.lineHeight = typeof node.lineHeight === 'number' ? `${node.lineHeight}px` : node.lineHeight;
    }
    if (node.letterSpacing !== undefined) style.letterSpacing = `${node.letterSpacing}px`;
    if (node.textAlign) style.textAlign = node.textAlign;
  }

  // Visibility
  if (node.visible === false) style.display = 'none';

  return style;
}

// ---------------------------------------------------------------------------
// Recursive node renderer
// ---------------------------------------------------------------------------

function RenderNode({
  node,
  components,
  variables,
}: {
  node: PenNode;
  components?: Record<string, PenNode>;
  variables?: Record<string, string>;
}): ReactNode {
  if (node.visible === false) return null;

  // Skip reusable component definitions (they are rendered via ref)
  if (node.reusable) return null;

  // Handle ref nodes
  if (node.type === 'ref' && node.refId && components?.[node.refId]) {
    const base = components[node.refId];
    // Apply overrides (shallow merge)
    const merged: PenNode = { ...base, ...node.overrides, type: base.type, children: base.children };
    return <RenderNode node={merged} components={components} variables={variables} />;
  }

  const style = buildStyle(node, variables);

  // Text node
  if (node.type === 'text') {
    const text = node.content ? resolveVariable(node.content, variables) : '';
    return <span style={style}>{text}</span>;
  }

  // Container nodes: frame, rectangle, ellipse
  const children = node.children?.map((child, i) => (
    <RenderNode key={child.id ?? i} node={child} components={components} variables={variables} />
  ));

  return <div style={style}>{children}</div>;
}

// ---------------------------------------------------------------------------
// PenRenderer
// ---------------------------------------------------------------------------

export function PenRenderer({ document, className }: PenRendererProps) {
  const [zoom, setZoom] = useState(1);

  // Build components lookup from top-level reusable frames
  const components = useMemo(() => {
    const map: Record<string, PenNode> = { ...(document.components ?? {}) };
    const collectReusable = (nodes?: PenNode[]) => {
      nodes?.forEach(n => {
        if (n.reusable && n.id) map[n.id] = n;
        if (n.children) collectReusable(n.children);
      });
    };
    collectReusable(document.children);
    document.pages?.forEach(p => collectReusable(p.children));
    return map;
  }, [document]);

  const pages = document.pages ?? (document.children ? [{ name: document.name ?? 'Page', children: document.children, width: document.width, height: document.height }] : []);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Zoom controls */}
      <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-b border-border shrink-0">
        <button
          onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
          className="p-1 rounded hover:bg-[var(--sidebar-accent)] text-muted-foreground/60 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] text-muted-foreground/50 w-10 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(z => Math.min(3, z + 0.25))}
          className="p-1 rounded hover:bg-[var(--sidebar-accent)] text-muted-foreground/60 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="p-1 rounded hover:bg-[var(--sidebar-accent)] text-muted-foreground/60 transition-colors"
          aria-label="Reset zoom"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto bg-[var(--sidebar-accent)] p-6">
        <div
          className="flex flex-wrap gap-8 justify-center"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        >
          {pages.map((page, pi) => (
            <div key={page.name ?? pi} className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground/50">{page.name}</span>
              <div
                className="bg-background border border-border rounded-lg shadow-lg overflow-hidden"
                style={{
                  width: page.width ? `${page.width}px` : '375px',
                  minHeight: page.height ? `${page.height}px` : '667px',
                }}
              >
                {page.children.map((node, i) => (
                  <RenderNode
                    key={node.id ?? i}
                    node={node}
                    components={components}
                    variables={document.variables}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
