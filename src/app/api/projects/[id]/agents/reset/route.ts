import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/agents/reset
 * Reset an agent's chat history to fix "poisoned context" issues.
 *
 * Body: { agentShortName: string }
 *
 * This deletes all chat messages from the specified agent, allowing it
 * to start fresh without the user needing to create a new project.
 * User messages and other agents' messages are preserved.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const body = await request.json();
    const { agentShortName } = body;

    if (!agentShortName || typeof agentShortName !== 'string') {
      return NextResponse.json({ error: 'agentShortName is required' }, { status: 400 });
    }

    // Find the agent record
    const agent = await prisma.agent.findFirst({
      where: { projectId, shortName: agentShortName.toUpperCase() },
      select: { id: true, name: true, shortName: true },
    });

    if (!agent) {
      return NextResponse.json({ error: `Agent "${agentShortName}" not found` }, { status: 404 });
    }

    // Delete all messages from this agent
    const deleted = await prisma.chatMessage.deleteMany({
      where: {
        projectId,
        agentId: agent.id,
        role: 'AGENT',
      },
    });

    // Reset agent status to IDLE
    await prisma.agent.update({
      where: { id: agent.id },
      data: { status: 'IDLE', currentTask: null },
    });

    return NextResponse.json({
      success: true,
      agent: agent.shortName,
      agentName: agent.name,
      messagesDeleted: deleted.count,
      message: `Reset ${agent.name} (${agent.shortName}). Cleared ${deleted.count} messages. The agent will start fresh on next interaction.`,
    });
  } catch (err) {
    console.error('POST /api/projects/[id]/agents/reset error:', err);
    return NextResponse.json({ error: 'Failed to reset agent' }, { status: 500 });
  }
}
