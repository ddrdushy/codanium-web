'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { SDDArchitectureData, toReactFlowLayout, ArchNodeType } from '@/lib/sdd-parser';
import { cn } from '@/lib/utils';
import {
  Globe, Shield, Server, Database, HardDrive,
  Cpu, Radio, Layers, Cloud, Box,
} from 'lucide-react';

// ─── Node Type Config ───────────────────────────────────────────────────────

const NODE_ICONS: Record<ArchNodeType, React.ElementType> = {
  'client': Globe,
  'cdn': Cloud,
  'api-gateway': Shield,
  'web-server': Server,
  'service': Cpu,
  'queue': Radio,
  'cache': Layers,
  'database': Database,
  'storage': HardDrive,
  'external': Box,
};

const NODE_COLORS: Record<ArchNodeType, { bg: string; border: string; text: string; glow: string }> = {
  'client':      { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    glow: 'shadow-blue-500/10' },
  'cdn':         { bg: 'bg-cyan-500/10',     border: 'border-cyan-500/30',    text: 'text-cyan-400',    glow: 'shadow-cyan-500/10' },
  'api-gateway': { bg: 'bg-violet-500/10',   border: 'border-violet-500/30',  text: 'text-violet-400',  glow: 'shadow-violet-500/10' },
  'web-server':  { bg: 'bg-amber-500/10',    border: 'border-amber-500/30',   text: 'text-amber-400',   glow: 'shadow-amber-500/10' },
  'service':     { bg: 'bg-emerald-500/10',  border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
  'queue':       { bg: 'bg-orange-500/10',   border: 'border-orange-500/30',  text: 'text-orange-400',  glow: 'shadow-orange-500/10' },
  'cache':       { bg: 'bg-red-500/10',      border: 'border-red-500/30',     text: 'text-red-400',     glow: 'shadow-red-500/10' },
  'database':    { bg: 'bg-indigo-500/10',   border: 'border-indigo-500/30',  text: 'text-indigo-400',  glow: 'shadow-indigo-500/10' },
  'storage':     { bg: 'bg-slate-500/10',    border: 'border-slate-500/30',   text: 'text-slate-400',   glow: 'shadow-slate-500/10' },
  'external':    { bg: 'bg-pink-500/10',     border: 'border-pink-500/30',    text: 'text-pink-400',    glow: 'shadow-pink-500/10' },
};

const TIER_LABELS: Record<number, string> = { 0: 'Client', 1: 'Edge', 2: 'Services', 3: 'Data' };

// ─── Custom Node Component ──────────────────────────────────────────────────

function ArchitectureNode({ data }: NodeProps) {
  const nodeType = (data.nodeType as ArchNodeType) || 'service';
  const Icon = NODE_ICONS[nodeType] || Cpu;
  const color = NODE_COLORS[nodeType] || NODE_COLORS.service;
  const tier = (data.tier as number) ?? 2;

  return (
    <div
      className={cn(
        'relative rounded-xl border px-4 py-3 min-w-[180px] max-w-[220px]',
        'bg-[hsl(var(--background))] shadow-lg transition-all',
        color.border, color.glow,
        'hover:shadow-xl hover:scale-[1.02]',
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber/50 !border-amber/30 !w-2 !h-2" />

      <div className="flex items-start gap-2.5">
        <div className={cn('p-1.5 rounded-lg mt-0.5 shrink-0', color.bg)}>
          <Icon className={cn('w-3.5 h-3.5', color.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">{data.label as string}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={cn(
              'text-[9px] font-medium px-1.5 py-0.5 rounded-full',
              color.bg, color.text,
            )}>
              {nodeType.replace('-', ' ')}
            </span>
          </div>
          {data.technology ? (
            <p className="text-[10px] text-muted-foreground mt-1.5 truncate">{String(data.technology)}</p>
          ) : null}
        </div>
      </div>

      {/* Status indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-amber/50 !border-amber/30 !w-2 !h-2" />
    </div>
  );
}

// ─── Main Canvas ────────────────────────────────────────────────────────────

interface ArchitectureCanvasProps {
  data: SDDArchitectureData;
  onNodeClick?: (nodeId: string) => void;
}

const nodeTypes = { archNode: ArchitectureNode };

export function ArchitectureCanvas({ data, onNodeClick }: ArchitectureCanvasProps) {
  const { flowNodes, flowEdges } = useMemo(() => toReactFlowLayout(data), [data]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onNodeClick?.(node.id);
  }, [onNodeClick]);

  return (
    <div className="w-full h-full relative architecture-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#f59e0b', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b', width: 15, height: 15 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#ffffff08" gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-[var(--surface)] !border-border !rounded-lg !shadow-lg [&>button]:!bg-[var(--surface)] [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-foreground/[0.06] [&>button:hover]:!text-foreground [&>button>svg]:!fill-current"
        />
        <MiniMap
          nodeColor={() => '#f59e0b'}
          maskColor="rgba(0,0,0,0.7)"
          className="!bg-[var(--surface)] !border-border !rounded-lg"
        />
      </ReactFlow>

      {/* Tier labels */}
      <div className="absolute left-3 top-0 bottom-0 flex flex-col justify-around pointer-events-none">
        {Object.entries(TIER_LABELS).map(([tier, label]) => (
          <div key={tier} className="flex items-center gap-1.5">
            <div className="w-1 h-8 rounded-full bg-amber/20" />
            <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Dark theme overrides */}
      <style jsx global>{`
        .architecture-canvas .react-flow__edge-path {
          filter: drop-shadow(0 0 3px rgba(245, 158, 11, 0.3));
        }
        .architecture-canvas .react-flow__edge.animated path {
          animation-duration: 1.5s;
        }
        .architecture-canvas .react-flow__background {
          background-color: transparent !important;
        }
      `}</style>
    </div>
  );
}
