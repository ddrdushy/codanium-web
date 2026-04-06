// =============================================================================
// SDD Parser — Extracts architecture components from SDD markdown
// =============================================================================
// Parses System Design Document content to produce nodes, edges, and metrics
// for the interactive Architecture Dashboard (React Flow canvas).
// =============================================================================

export type ArchNodeType =
  | 'web-server'
  | 'api-gateway'
  | 'database'
  | 'cache'
  | 'queue'
  | 'service'
  | 'cdn'
  | 'storage'
  | 'external'
  | 'client';

export interface ArchNode {
  id: string;
  label: string;
  type: ArchNodeType;
  description?: string;
  technology?: string;
  tier: number; // 0=client, 1=edge, 2=services, 3=data
}

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface ArchMetrics {
  totalNodes: number;
  totalEdges: number;
  tiers: number;
  hasDatabase: boolean;
  hasCache: boolean;
  hasQueue: boolean;
  hasCDN: boolean;
}

export interface SDDArchitectureData {
  nodes: ArchNode[];
  edges: ArchEdge[];
  metrics: ArchMetrics;
}

// ─── Type Detection ─────────────────────────────────────────────────────────

const TYPE_PATTERNS: Record<ArchNodeType, RegExp[]> = {
  'client': [/client|browser|mobile|app|frontend|react|vue|angular|next\.?js|nuxt/i],
  'cdn': [/cdn|cloudfront|cloudflare|akamai|content.?delivery/i],
  'api-gateway': [/api.?gateway|gateway|load.?balancer|nginx|kong|traefik|ingress|reverse.?proxy/i],
  'web-server': [/web.?server|http.?server|express|fastify|koa|nest\.?js|django|flask|rails/i],
  'service': [/service|microservice|worker|handler|processor|engine|module|lambda|function/i],
  'queue': [/queue|message.?broker|kafka|rabbitmq|redis.?stream|sqs|pub.?sub|bullmq|event.?bus/i],
  'cache': [/cache|redis|memcache|varnish|session.?store|in.?memory/i],
  'database': [/database|db|postgres|mysql|mongo|sqlite|supabase|dynamo|firestore|cockroach|prisma/i],
  'storage': [/storage|s3|blob|bucket|file.?system|minio|r2|object.?storage|upload/i],
  'external': [/external|third.?party|api|openai|stripe|twilio|sendgrid|auth0|clerk/i],
};

function detectNodeType(name: string, context: string = ''): ArchNodeType {
  const combined = `${name} ${context}`.toLowerCase();
  for (const [type, patterns] of Object.entries(TYPE_PATTERNS)) {
    if (patterns.some(p => p.test(combined))) {
      return type as ArchNodeType;
    }
  }
  return 'service';
}

// ─── Tier Assignment ────────────────────────────────────────────────────────

const TIER_MAP: Record<ArchNodeType, number> = {
  'client': 0,
  'cdn': 1,
  'api-gateway': 1,
  'web-server': 2,
  'service': 2,
  'queue': 2,
  'cache': 3,
  'database': 3,
  'storage': 3,
  'external': 1,
};

// ─── Parser ─────────────────────────────────────────────────────────────────

/**
 * Extract architecture components from SDD markdown.
 * Attempts multiple strategies: markdown tables, bullet lists, headings.
 */
export function parseSDDToArchitecture(markdown: string): SDDArchitectureData {
  if (!markdown || markdown.trim().length === 0) {
    return createFallback();
  }

  const nodes: ArchNode[] = [];
  const edges: ArchEdge[] = [];
  const nodeIds = new Set<string>();

  // Strategy 1: Extract from markdown tables
  // Look for table rows like | Component | Technology | Description |
  const tableRowRegex = /^\|(.+)\|(.+)\|/gm;
  let match: RegExpExecArray | null;

  while ((match = tableRowRegex.exec(markdown)) !== null) {
    const cells = match[0]
      .split('|')
      .map(c => c.trim())
      .filter(c => c && !c.match(/^[-:]+$/));

    if (cells.length >= 2) {
      const name = cells[0];
      const tech = cells[1];
      // Skip header rows
      if (name.toLowerCase() === 'component' || name.toLowerCase() === 'name' || name.toLowerCase() === 'layer') continue;
      if (name.includes('---')) continue;

      const id = toNodeId(name);
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        const type = detectNodeType(name, tech);
        nodes.push({
          id,
          label: cleanLabel(name),
          type,
          technology: tech || undefined,
          description: cells[2] || undefined,
          tier: TIER_MAP[type],
        });
      }
    }
  }

  // Strategy 2: Extract from bullet lists under architecture headings
  const archSections = extractSections(markdown, [
    'architecture', 'components', 'infrastructure', 'system design',
    'tech stack', 'technology stack', 'services', 'deployment',
  ]);

  for (const section of archSections) {
    // Match bullets: - **Component Name**: Description
    const bulletRegex = /[-*]\s+\*{0,2}([^*:\n]+)\*{0,2}\s*[:—–-]\s*(.+)/g;
    let bulletMatch: RegExpExecArray | null;

    while ((bulletMatch = bulletRegex.exec(section)) !== null) {
      const name = bulletMatch[1].trim();
      const desc = bulletMatch[2].trim();

      // Skip generic bullets
      if (name.length < 2 || name.length > 50) continue;
      if (/^(note|see|ref|todo|example)/i.test(name)) continue;

      const id = toNodeId(name);
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        const type = detectNodeType(name, desc);
        nodes.push({
          id,
          label: cleanLabel(name),
          type,
          description: desc.substring(0, 120),
          tier: TIER_MAP[type],
        });
      }
    }
  }

  // Strategy 3: Extract from subheadings (### Component Name)
  const headingRegex = /^#{2,4}\s+(.+)/gm;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const name = match[1].trim();
    const lower = name.toLowerCase();

    // Only include if it looks like a component name
    if (
      lower.includes('layer') || lower.includes('tier') ||
      lower.includes('service') || lower.includes('module') ||
      lower.includes('server') || lower.includes('database') ||
      lower.includes('api') || lower.includes('gateway') ||
      lower.includes('cache') || lower.includes('queue')
    ) {
      const id = toNodeId(name);
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        const type = detectNodeType(name);
        nodes.push({
          id,
          label: cleanLabel(name),
          type,
          tier: TIER_MAP[type],
        });
      }
    }
  }

  // If we found no nodes, return fallback
  if (nodes.length === 0) {
    return createFallback();
  }

  // Generate edges: connect nodes in adjacent tiers
  const sortedNodes = [...nodes].sort((a, b) => a.tier - b.tier);
  for (let i = 0; i < sortedNodes.length; i++) {
    for (let j = i + 1; j < sortedNodes.length; j++) {
      const a = sortedNodes[i];
      const b = sortedNodes[j];
      // Connect adjacent tiers or same tier (limited)
      if (Math.abs(a.tier - b.tier) <= 1) {
        const edgeId = `${a.id}-${b.id}`;
        if (!edges.some(e => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: a.id,
            target: b.id,
            animated: a.tier !== b.tier,
          });
        }
        // Limit edges per node to 3
        if (edges.filter(e => e.source === a.id || e.target === a.id).length >= 3) break;
      }
    }
  }

  const metrics = computeMetrics(nodes, edges);
  return { nodes, edges, metrics };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toNodeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);
}

function cleanLabel(name: string): string {
  return name
    .replace(/\*+/g, '')
    .replace(/`/g, '')
    .trim()
    .substring(0, 30);
}

function extractSections(markdown: string, keywords: string[]): string[] {
  const sections: string[] = [];
  const lines = markdown.split('\n');
  let capturing = false;
  let current: string[] = [];
  let headingLevel = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].toLowerCase();

      if (capturing && level <= headingLevel) {
        sections.push(current.join('\n'));
        current = [];
        capturing = false;
      }

      if (keywords.some(k => title.includes(k))) {
        capturing = true;
        headingLevel = level;
      }
    }

    if (capturing) {
      current.push(line);
    }
  }

  if (current.length > 0) {
    sections.push(current.join('\n'));
  }

  return sections;
}

function computeMetrics(nodes: ArchNode[], edges: ArchEdge[]): ArchMetrics {
  const tiers = new Set(nodes.map(n => n.tier));
  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    tiers: tiers.size,
    hasDatabase: nodes.some(n => n.type === 'database'),
    hasCache: nodes.some(n => n.type === 'cache'),
    hasQueue: nodes.some(n => n.type === 'queue'),
    hasCDN: nodes.some(n => n.type === 'cdn'),
  };
}

function createFallback(): SDDArchitectureData {
  return {
    nodes: [
      { id: 'client', label: 'Client', type: 'client', tier: 0 },
      { id: 'api', label: 'API Server', type: 'web-server', tier: 2 },
      { id: 'db', label: 'Database', type: 'database', tier: 3 },
    ],
    edges: [
      { id: 'client-api', source: 'client', target: 'api', animated: true },
      { id: 'api-db', source: 'api', target: 'db', animated: true },
    ],
    metrics: {
      totalNodes: 3,
      totalEdges: 2,
      tiers: 3,
      hasDatabase: true,
      hasCache: false,
      hasQueue: false,
      hasCDN: false,
    },
  };
}

/**
 * Convert parsed architecture data to React Flow format with auto-layout.
 */
export function toReactFlowLayout(data: SDDArchitectureData) {
  const TIER_Y: Record<number, number> = { 0: 50, 1: 200, 2: 400, 3: 600 };
  const TIER_X_START = 100;
  const NODE_SPACING = 280;

  // Group nodes by tier
  const tierGroups: Record<number, ArchNode[]> = {};
  for (const node of data.nodes) {
    if (!tierGroups[node.tier]) tierGroups[node.tier] = [];
    tierGroups[node.tier].push(node);
  }

  const flowNodes = data.nodes.map((node) => {
    const group = tierGroups[node.tier] || [];
    const index = group.indexOf(node);
    const groupWidth = group.length * NODE_SPACING;
    const startX = TIER_X_START + (800 - groupWidth) / 2;

    return {
      id: node.id,
      type: 'archNode',
      position: { x: startX + index * NODE_SPACING, y: TIER_Y[node.tier] ?? 400 },
      data: {
        label: node.label,
        nodeType: node.type,
        technology: node.technology,
        description: node.description,
        tier: node.tier,
      },
    };
  });

  const flowEdges = data.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: edge.animated ?? false,
    style: {
      stroke: '#f59e0b',
      strokeWidth: 1.5,
    },
    labelStyle: { fill: '#9ca3af', fontSize: 10 },
  }));

  return { flowNodes, flowEdges };
}
