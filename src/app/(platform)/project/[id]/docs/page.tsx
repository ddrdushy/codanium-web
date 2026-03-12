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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  content: string;
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

// No mock documents — all content comes from the database

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

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/documents`)
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((d: any) => ({
            id: d.id,
            title: d.title,
            type: dbTypeMap[d.type] ?? 'brd',
            status: dbStatusMap[d.status] ?? 'draft',
            owner: d.owner ?? 'Unknown',
            ownerAvatar: d.ownerAvatar ?? '📋',
            lastUpdated: formatRelative(d.updatedAt ?? d.createdAt),
            wordCount: d.wordCount ?? 0,
            sections: d.sections ?? 0,
            locked: d.locked ?? false,
            content: d.content ?? '',
          }));
          setDocuments(mapped);
          setSelectedDoc(mapped[0]);
        }
      })
      .catch(() => {/* no data — keep empty */})
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
          {!loading && filteredDocs.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground/40">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No documents yet</p>
              <p className="text-[10px] mt-1">Documents will appear here as your AI team creates them during the project.</p>
            </div>
          )}
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
                  <h1 className="text-3xl font-bold tracking-tight">{selectedDoc.title}</h1>
                  <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground/50">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Last updated {selectedDoc.lastUpdated}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {selectedDoc.owner}
                    </span>
                    <span>{selectedDoc.wordCount.toLocaleString()} words</span>
                  </div>
                </div>

                {/* Document body — rendered from real content */}
                {editMode ? (
                  <textarea
                    defaultValue={selectedDoc.content}
                    rows={30}
                    className="w-full text-sm text-muted-foreground leading-relaxed bg-[var(--sidebar-accent)] border border-border rounded-lg px-4 py-3 outline-none focus:border-amber/30 resize-y transition-colors font-mono"
                  />
                ) : selectedDoc.content ? (
                  <div className="prose prose-sm prose-invert max-w-none
                    prose-headings:text-foreground prose-headings:tracking-tight
                    prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4
                    prose-h2:text-lg prose-h2:font-bold prose-h2:mb-3 prose-h2:mt-8
                    prose-h3:text-base prose-h3:font-semibold prose-h3:mb-2 prose-h3:mt-6
                    prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-4
                    prose-li:text-muted-foreground prose-li:leading-relaxed
                    prose-ul:space-y-1 prose-ol:space-y-1
                    prose-strong:text-foreground
                    prose-code:text-amber prose-code:bg-amber/10 prose-code:px-1 prose-code:rounded
                    prose-table:border prose-table:border-border
                    prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-[var(--sidebar-accent)]
                    prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5
                  ">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedDoc.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground/40">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">This document is empty.</p>
                    <p className="text-xs mt-1">Content will appear here once the AI team generates it.</p>
                  </div>
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
