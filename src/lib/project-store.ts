import { create } from 'zustand';
import type { Project, Agent, SDLCProgress } from '@/types';

interface ProjectStore {
  projects: Project[];
  agents: Agent[];
  sdlcStages: SDLCProgress[];
  loading: boolean;
  fetchProjects: () => Promise<void>;
  fetchProjectContext: (projectId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  agents: [],
  sdlcStages: [],
  loading: false,

  fetchProjects: async () => {
    if (get().projects.length > 0) return; // already loaded
    set({ loading: true });
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const projects: Project[] = data.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? '',
        current_stage: p.currentStage ?? 'Planning',
        status: p.status.toLowerCase() as Project['status'],
        created_at: p.createdAt,
        card_count: p.cardCount ?? p._count?.cards ?? 0,
        active_agents: p.activeAgentCount ?? 0,
        total_agents: p.totalAgents ?? p._count?.agents ?? 0,
        completion: p.completion ?? 0,
        team_size: p.memberCount ?? p._count?.members ?? 1,
        last_activity: '',
        color: p.color ?? '#6366f1',
      }));
      set({ projects, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchProjectContext: async (projectId: string) => {
    try {
      const [agentsRes, stagesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/agents`),
        fetch(`/api/projects/${projectId}/sdlc`),
      ]);
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        const agents: Agent[] = agentsData.map((a: any) => ({
          id: a.id,
          name: a.name,
          shortName: a.shortName,
          group: a.group.toLowerCase() as Agent['group'],
          status: a.status.toLowerCase() as Agent['status'],
          currentTask: a.currentTask ?? null,
          avatar: a.avatar ?? '🤖',
        }));
        set({ agents });
      }
      if (stagesRes.ok) {
        const stagesData = await stagesRes.json();
        const sdlcStages: SDLCProgress[] = stagesData.map((s: any) => ({
          stage: s.name,
          status: s.status.toLowerCase() as SDLCProgress['status'],
          gate_passed: s.gatePassed,
        }));
        set({ sdlcStages });
      }
    } catch {
      // keep existing data
    }
  },
}));
