'use client';

import { ArchMetrics, SDDArchitectureData } from '@/lib/sdd-parser';
import { cn } from '@/lib/utils';
import { ShieldAlert, Zap, Scale, Server, Database, ArrowUpRight } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  icon: React.ElementType;
}

// ─── Recommendation Engine ──────────────────────────────────────────────────

function generateRecommendations(data: SDDArchitectureData): Recommendation[] {
  const recs: Recommendation[] = [];
  const { metrics, nodes, edges } = data;

  // 1. Single database → suggest replica
  const dbNodes = nodes.filter(n => n.type === 'database');
  if (dbNodes.length === 1) {
    recs.push({
      id: 'db-redundancy',
      title: 'Improve Database Redundancy',
      description: `Single database detected (${dbNodes[0].label}). Consider adding a read replica for failover and better read performance.`,
      priority: 'high',
      action: 'Add read replica',
      icon: Database,
    });
  }

  // 2. No cache layer → suggest caching
  if (!metrics.hasCache) {
    recs.push({
      id: 'add-cache',
      title: 'Add Caching Layer',
      description: 'No caching layer detected. Adding Redis or Memcached can reduce database load and improve response times by 40-60%.',
      priority: 'high',
      action: 'Implement caching',
      icon: Zap,
    });
  }

  // 3. No CDN → suggest CDN
  if (!metrics.hasCDN && nodes.some(n => n.type === 'client')) {
    recs.push({
      id: 'add-cdn',
      title: 'Add CDN for Static Assets',
      description: 'No CDN detected. Serving static assets through a CDN (CloudFront, Cloudflare) can reduce latency for global users.',
      priority: 'medium',
      action: 'Configure CDN',
      icon: ArrowUpRight,
    });
  }

  // 4. Many services without queue → suggest async processing
  const serviceNodes = nodes.filter(n => n.type === 'service');
  if (serviceNodes.length >= 3 && !metrics.hasQueue) {
    recs.push({
      id: 'add-queue',
      title: 'Implement Message Queue',
      description: `${serviceNodes.length} services detected without a message queue. Async processing with BullMQ or Kafka can improve resilience and decouple services.`,
      priority: 'medium',
      action: 'Add message broker',
      icon: Server,
    });
  }

  // 5. High edge count → potential coupling
  if (metrics.totalEdges > metrics.totalNodes * 2) {
    recs.push({
      id: 'reduce-coupling',
      title: 'Reduce Service Coupling',
      description: `High connection density (${metrics.totalEdges} edges for ${metrics.totalNodes} nodes). Consider an API gateway or event bus to reduce point-to-point connections.`,
      priority: 'medium',
      action: 'Review architecture',
      icon: Scale,
    });
  }

  // 6. No API gateway → suggest
  if (!nodes.some(n => n.type === 'api-gateway') && nodes.length >= 4) {
    recs.push({
      id: 'add-gateway',
      title: 'Add API Gateway',
      description: 'No API gateway detected. A gateway provides centralized auth, rate limiting, and request routing for better security.',
      priority: 'low',
      action: 'Add API gateway',
      icon: ShieldAlert,
    });
  }

  // 7. Auto-scale suggestion for services
  if (serviceNodes.length >= 2) {
    recs.push({
      id: 'auto-scale',
      title: 'Enable Auto-Scaling',
      description: `${serviceNodes.length} services could benefit from horizontal scaling. Configure auto-scaling policies based on CPU/memory thresholds.`,
      priority: 'low',
      action: 'Configure scaling',
      icon: Scale,
    });
  }

  return recs;
}

// ─── Priority Styling ───────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  high: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  low: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
};

// ─── Component ──────────────────────────────────────────────────────────────

interface AIRecommendationsProps {
  data: SDDArchitectureData;
}

export function AIRecommendations({ data }: AIRecommendationsProps) {
  const recommendations = generateRecommendations(data);

  if (recommendations.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-muted-foreground">Architecture looks well-structured.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
          AI Recommendations
        </h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {recommendations.length} suggestions based on architecture analysis
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {recommendations.map((rec) => {
          const style = PRIORITY_STYLES[rec.priority];
          const Icon = rec.icon;

          return (
            <div
              key={rec.id}
              className={cn(
                'rounded-lg border border-border p-3 transition-colors hover:border-amber/20',
                'bg-[var(--surface)]'
              )}
            >
              <div className="flex items-start gap-2.5">
                <div className={cn('p-1.5 rounded-md mt-0.5', style.bg)}>
                  <Icon className={cn('w-3 h-3', style.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-semibold text-foreground">{rec.title}</span>
                    <div className={cn('w-1.5 h-1.5 rounded-full', style.dot)} />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {rec.description}
                  </p>
                  <div className="mt-2">
                    <span className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full',
                      style.bg, style.text,
                    )}>
                      {rec.action}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
