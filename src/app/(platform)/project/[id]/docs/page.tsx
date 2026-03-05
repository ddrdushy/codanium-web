'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText, Plus, Search, ChevronRight, Clock, CheckCircle2,
  Edit3, Eye, Download, MoreHorizontal, BookOpen, Code2,
  FileCode2, ScrollText, Layers, Bot, Lock, Users
} from 'lucide-react';

interface Document {
  id: string;
  title: string;
  type: 'brd' | 'sdd' | 'api-spec' | 'runbook' | 'adr';
  status: 'draft' | 'review' | 'approved' | 'published';
  owner: string;
  ownerAvatar: string;
  lastUpdated: string;
  wordCount: number;
  sections: number;
  locked: boolean;
}

const docTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  brd: { label: 'Requirements', icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  sdd: { label: 'Design Spec', icon: Code2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  'api-spec': { label: 'API Spec', icon: FileCode2, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  runbook: { label: 'Operations Guide', icon: ScrollText, color: 'text-amber', bg: 'bg-amber/10 border-amber/20' },
  adr: { label: 'Decision Record', icon: Layers, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
};

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20', icon: Edit3 },
  review: { label: 'In Review', color: 'text-amber', bg: 'bg-amber/10 border-amber/20', icon: Eye },
  approved: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  published: { label: 'Published', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: CheckCircle2 },
};

const mockDocuments: Document[] = [
  {
    id: 'doc-001', title: 'Business Requirements Document', type: 'brd', status: 'approved',
    owner: 'Business Analyst', ownerAvatar: '📋', lastUpdated: '2d ago', wordCount: 4200, sections: 12, locked: false,
  },
  {
    id: 'doc-002', title: 'Solution Design Document', type: 'sdd', status: 'review',
    owner: 'Solution Architect', ownerAvatar: '🏗️', lastUpdated: '4h ago', wordCount: 8900, sections: 24, locked: true,
  },
  {
    id: 'doc-003', title: 'REST API Specification v2', type: 'api-spec', status: 'draft',
    owner: 'Junior Developer', ownerAvatar: '💻', lastUpdated: '1h ago', wordCount: 3100, sections: 18, locked: false,
  },
  {
    id: 'doc-004', title: 'Deployment Runbook', type: 'runbook', status: 'draft',
    owner: 'DevOps Engineer', ownerAvatar: '🚀', lastUpdated: '6h ago', wordCount: 1800, sections: 8, locked: false,
  },
  {
    id: 'doc-005', title: 'ADR-001: File-based Persistence', type: 'adr', status: 'published',
    owner: 'Solution Architect', ownerAvatar: '🏗️', lastUpdated: '5d ago', wordCount: 950, sections: 5, locked: false,
  },
  {
    id: 'doc-006', title: 'ADR-002: Multi-Provider LLM Gateway', type: 'adr', status: 'draft',
    owner: 'Solution Architect', ownerAvatar: '🏗️', lastUpdated: '30m ago', wordCount: 620, sections: 5, locked: false,
  },
];

// Mock BRD content for the editor preview
const mockBRDContent = {
  title: 'Business Requirements Document',
  subtitle: 'AI Team Studio — Product Delivery Operating System',
  sections: [
    {
      heading: '1. Executive Summary',
      content: 'AI Team Studio is a deterministic, AI-native Product Delivery Operating System that orchestrates 23 specialized AI agents through a structured SDLC pipeline. The system replaces ad-hoc AI tool usage with a governed, auditable, and reproducible delivery framework.',
    },
    {
      heading: '2. Business Objectives',
      items: [
        'Reduce software delivery cycle time by 60% through AI agent automation',
        'Ensure 100% audit compliance through deterministic state tracking',
        'Enable non-technical stakeholders to approve decisions via natural language',
        'Achieve zero-drift between requirements and implementation through continuous validation',
      ],
    },
    {
      heading: '3. Stakeholders',
      content: 'Primary stakeholders include the Product Owner (approval authority), Engineering Lead (technical oversight), and Project Sponsor (budget authority). All 23 AI agents operate under RACI-based authority contracts.',
    },
    {
      heading: '4. Functional Requirements',
      items: [
        'FR-001: System shall maintain a board of cards with 7 defined states (Planned → Released)',
        'FR-002: All state transitions shall be validated against the transition matrix',
        'FR-003: Non-trivial changes require a formal decision with options analysis and risk scoring',
        'FR-004: Each agent shall operate within defined authority boundaries (can_do, must_do, must_never)',
        'FR-005: System shall support BYOM (Bring Your Own Model) with multi-provider routing',
        'FR-006: All system state shall be persisted to files (board.json, decisions.jsonl, events.jsonl)',
      ],
    },
    {
      heading: '5. Acceptance Criteria',
      items: [
        'AC-001: A card can be moved from any valid source state to a valid target state',
        'AC-002: Invalid state transitions are rejected with a descriptive error',
        'AC-003: Decisions require at least 2 options with pros, cons, and risk ratings',
        'AC-004: The system can be fully restored from state files after a crash',
      ],
    },
  ],
};

const dbTypeMap: Record<string, Document['type']> = {
  BRD: 'brd', SDD: 'sdd', API_SPEC: 'api-spec', RUNBOOK: 'runbook', ADR: 'adr',
};
const dbStatusMap: Record<string, Document['status']> = {
  DRAFT: 'draft', REVIEW: 'review', APPROVED: 'approved', PUBLISHED: 'published',
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / 86400000);
  return `${days}d ago`;
}

export default function DocsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(mockDocuments[0]);
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/documents`)
      .then(r => r.json())
      .then((data: any[]) => {
        if (data.length > 0) {
          const mapped = data.map((d: any) => ({
            id: d.id,
            title: d.title,
            type: dbTypeMap[d.type] ?? 'brd',
            status: dbStatusMap[d.status] ?? 'draft',
            owner: d.owner ?? 'Unknown',
            ownerAvatar: d.ownerAvatar ?? '📋',
            lastUpdated: formatRelative(d.updatedAt),
            wordCount: d.wordCount ?? 0,
            sections: d.sections ?? 0,
            locked: d.locked ?? false,
          }));
          setDocuments(mapped);
          setSelectedDoc(mapped[0]);
        }
      })
      .catch(() => {/* keep mock data */})
      .finally(() => setLoading(false));
  }, [projectId]);

  const filteredDocs = searchQuery
    ? documents.filter(d =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.type.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : documents;

  return (
    <div className="flex h-full">
      {/* Document List Sidebar */}
      <div className="w-[320px] border-r border-border flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber" />
              Documents
            </h1>
            <Button size="sm" className="h-7 text-[11px] bg-amber/20 text-amber hover:bg-amber/30 border border-amber/20">
              <Plus className="w-3 h-3 mr-1" /> New Doc
            </Button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--sidebar-accent)] border border-border rounded-lg outline-none focus:border-amber/30 transition-colors text-foreground placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* Doc List */}
        <div className="flex-1 overflow-y-auto">
          {filteredDocs.map((doc, i) => {
            const typeConf = docTypeConfig[doc.type];
            const statConf = statusConfig[doc.status];
            const TypeIcon = typeConf.icon;
            const isSelected = selectedDoc?.id === doc.id;

            return (
              <motion.button
                key={doc.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedDoc(doc)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-border transition-all',
                  isSelected
                    ? 'bg-amber/[0.06] border-l-2 border-l-amber'
                    : 'hover:bg-[var(--sidebar-accent)] border-l-2 border-l-transparent'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5', typeConf.bg, typeConf.color)}>
                    <TypeIcon className="w-2.5 h-2.5 mr-0.5" />
                    {typeConf.label}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5', statConf.bg, statConf.color)}>
                    {statConf.label}
                  </Badge>
                  {doc.locked && <Lock className="w-2.5 h-2.5 text-amber/60" />}
                </div>
                <p className="text-sm font-medium text-foreground line-clamp-1">{doc.title}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/50">
                  <span>{doc.ownerAvatar} {doc.owner}</span>
                  <span>·</span>
                  <span>{doc.lastUpdated}</span>
                  <span>·</span>
                  <span>{doc.wordCount.toLocaleString()} words</span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Stats Footer */}
        <div className="px-4 py-3 border-t border-border text-[10px] text-muted-foreground/40">
          {documents.length} documents · {documents.filter(d => d.status === 'draft').length} drafts
        </div>
      </div>

      {/* Document Editor / Viewer */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedDoc ? (
            <motion.div
              key={selectedDoc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Toolbar */}
              <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-[10px]', docTypeConfig[selectedDoc.type].bg, docTypeConfig[selectedDoc.type].color)}>
                    {docTypeConfig[selectedDoc.type].label}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[10px]', statusConfig[selectedDoc.status].bg, statusConfig[selectedDoc.status].color)}>
                    {statusConfig[selectedDoc.status].label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground/40">
                    {selectedDoc.sections} sections · {selectedDoc.wordCount.toLocaleString()} words
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40 mr-2">
                    <Bot className="w-3 h-3" />
                    <span>Owner: {selectedDoc.ownerAvatar} {selectedDoc.owner}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={editMode ? 'default' : 'outline'}
                    className={cn('h-7 text-[11px]', editMode && 'bg-amber text-background hover:bg-amber/90')}
                    onClick={() => setEditMode(!editMode)}
                  >
                    {editMode ? <Eye className="w-3 h-3 mr-1" /> : <Edit3 className="w-3 h-3 mr-1" />}
                    {editMode ? 'Preview' : 'Edit'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]">
                    <Download className="w-3 h-3 mr-1" /> Export
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Document Content */}
              <div className="px-6 py-8 max-w-3xl mx-auto">
                {/* Title */}
                <div className="mb-8 pb-6 border-b border-border">
                  {editMode ? (
                    <input
                      defaultValue={mockBRDContent.title}
                      className="text-3xl font-bold tracking-tight bg-transparent outline-none w-full text-foreground"
                    />
                  ) : (
                    <h1 className="text-3xl font-bold tracking-tight">{mockBRDContent.title}</h1>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">{mockBRDContent.subtitle}</p>
                  <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground/50">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Last updated {selectedDoc.lastUpdated}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> 3 contributors
                    </span>
                  </div>
                </div>

                {/* Sections */}
                <div className="space-y-8">
                  {mockBRDContent.sections.map((section, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                    >
                      {editMode ? (
                        <input
                          defaultValue={section.heading}
                          className="text-lg font-bold tracking-tight bg-transparent outline-none w-full mb-3 text-foreground"
                        />
                      ) : (
                        <h2 className="text-lg font-bold tracking-tight mb-3">{section.heading}</h2>
                      )}

                      {section.content && (
                        editMode ? (
                          <textarea
                            defaultValue={section.content}
                            rows={4}
                            className="w-full text-sm text-muted-foreground leading-relaxed bg-[var(--sidebar-accent)] border border-border rounded-lg px-3 py-2 outline-none focus:border-amber/30 resize-none transition-colors"
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
                        )
                      )}

                      {section.items && (
                        <ul className="space-y-2 mt-2">
                          {section.items.map((item, j) => (
                            <li key={j} className="flex items-start gap-2">
                              <span className="text-amber text-sm mt-0.5">•</span>
                              {editMode ? (
                                <input
                                  defaultValue={item}
                                  className="flex-1 text-sm text-muted-foreground bg-transparent outline-none border-b border-transparent focus:border-amber/20 transition-colors"
                                />
                              ) : (
                                <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                              )}
                            </li>
                          ))}
                          {editMode && (
                            <li>
                              <button className="text-[11px] text-amber/60 hover:text-amber flex items-center gap-1 ml-4 transition-colors">
                                <Plus className="w-3 h-3" /> Add item
                              </button>
                            </li>
                          )}
                        </ul>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Add Section */}
                {editMode && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-8 pt-6 border-t border-dashed border-border"
                  >
                    <button className="flex items-center gap-2 text-sm text-muted-foreground/40 hover:text-amber transition-colors">
                      <Plus className="w-4 h-4" />
                      Add new section
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground/40">
              Select a document to view
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
