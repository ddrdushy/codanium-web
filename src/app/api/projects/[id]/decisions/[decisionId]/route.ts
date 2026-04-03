import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { taskQueue } from '@/lib/ai/orchestration/task-queue';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/projects/[id]/decisions/[decisionId]
 * Update a decision — approve, reject, or change status.
 * Body: { status?, approvedOption?, recommendation? }
 *
 * POST-APPROVAL SIDE EFFECTS (when status changes to APPROVED):
 * 1. If decision trigger contains "BRD" → mark BRD document as APPROVED
 * 2. Move the Requirements Gathering card to DONE
 * 3. Trigger PM agent to validate the BRD and create SA task
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; decisionId: string }> }
) {
  try {
    const { id: projectId, decisionId } = await params;
    const body = await request.json();

    const decision = await prisma.decision.findFirst({
      where: { id: decisionId, projectId },
    });

    if (!decision) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    if (body.status) updateData.status = body.status;
    if (body.approvedOption !== undefined) updateData.approvedOption = body.approvedOption;
    if (body.recommendation !== undefined) updateData.recommendation = body.recommendation;

    // Auto-set approvedAt when approving
    if (body.status === 'APPROVED' && !decision.approvedAt) {
      updateData.approvedAt = new Date();
    }

    const updated = await prisma.decision.update({
      where: { id: decisionId },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true, email: true, avatarColor: true } },
        options: { orderBy: { name: 'asc' } },
      },
    });

    // ── Post-Approval Side Effects ────────────────────────────────────
    if (body.status === 'APPROVED') {
      const trigger = (decision.trigger || '').toLowerCase();

      // BRD approval → update document + move card + trigger PM→SA
      if (trigger.includes('brd')) {
        console.log(`[Decision] BRD approved for project ${projectId} — running side effects`);

        // Get project name for card titles
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true },
        });
        const projectName = project?.name || 'this project';

        // 1. Mark BRD document as APPROVED
        try {
          await prisma.document.updateMany({
            where: { projectId, type: 'BRD' },
            data: { status: 'APPROVED' },
          });
          console.log(`[Decision] BRD document status → APPROVED`);
        } catch (e) {
          console.error('[Decision] Failed to update BRD document status:', e);
        }

        // 2. Move Requirements Gathering card to DONE
        try {
          const reqCard = await prisma.card.findFirst({
            where: {
              projectId,
              title: { contains: 'Requirements Gathering' },
            },
          });
          if (reqCard) {
            await prisma.card.update({
              where: { id: reqCard.id },
              data: { state: 'DONE' },
            });
            console.log(`[Decision] Requirements Gathering card → DONE`);
          }
        } catch (e) {
          console.error('[Decision] Failed to update card state:', e);
        }

        // 3. Trigger PM to validate the BRD and create SA task
        try {
          // Find the project owner
          const member = await prisma.projectMember.findFirst({
            where: { projectId },
            select: { userId: true },
          });
          const userId = member?.userId || 'usr-001';

          // Get BRD content summary for PM context
          const brd = await prisma.document.findFirst({
            where: { projectId, type: 'BRD' },
            select: { content: true },
          });
          const brdSummary = brd?.content
            ? brd.content.substring(0, 2000)
            : 'BRD has been approved by the user.';

          // Create a system message for PM
          await prisma.chatMessage.create({
            data: {
              role: 'SYSTEM',
              content: `The user has APPROVED the BRD via My Decisions.\n\nBRD Summary (first 2000 chars):\n${brdSummary}\n\nThe BRD has been user-approved. Your job:\n1. Briefly acknowledge the BRD approval to the user\n2. Confirm the Requirements Gathering phase is COMPLETE\n3. Create a "Solution Design" card assigned to SA (Solution Architect) with BRD context\n4. Tell the user that the SA will now begin system design\n\nIMPORTANT: The user already approved this BRD. Do NOT re-validate or find gaps. Do NOT send it back to BA. The BRD is FINAL. Just create the SA card and move forward.`,
              projectId,
            },
          });

          // 4. Create Solution Design card for SA (deterministic, not LLM-dependent)
          const saAgent = await prisma.agent.findFirst({
            where: { projectId, shortName: 'SA' },
            select: { id: true },
          });

          // Check if SA card already exists
          const existingSACard = await prisma.card.findFirst({
            where: { projectId, title: { contains: 'Solution Design' } },
          });

          if (!existingSACard) {
            await prisma.card.create({
              data: {
                title: `Solution Design: ${projectName}`,
                description: `Phase 2: Solution Architect creates the System Design Document (SDD) based on the approved BRD.\n\nBRD Summary:\n${brdSummary.substring(0, 500)}`,
                type: 'TASK',
                state: 'IN_PROGRESS',
                priority: 'HIGH',
                ownerAgentId: saAgent?.id,
                projectId,
              },
            });
            console.log(`[Decision] Created Solution Design card for SA`);
          }

          // 5. Enqueue PM to acknowledge, then SA to start design
          await taskQueue.enqueue({
            projectId,
            userId,
            userMessage: `The user approved the BRD. Acknowledge the approval briefly, confirm Requirements phase is COMPLETE, and tell the user the Solution Architect (SA) will now begin system design. Do NOT re-validate or find gaps — the BRD is FINAL and user-approved.`,
            targetAgent: 'PM',
            autoRouted: true,
            isBackground: true,
            priority: 10,
          });

          // 6. Enqueue SA to start architecture design (delayed by lower priority)
          await taskQueue.enqueue({
            projectId,
            userId,
            userMessage: `The BRD has been approved. Read the BRD from your DOCUMENTS context and create the System Design Document (SDD). Define the technology stack, system architecture, API design, database schema, and deployment strategy. Save the SDD using update_document(type='SDD').`,
            targetAgent: 'SA',
            autoRouted: true,
            isBackground: true,
            priority: 5,
          });
          console.log(`[Decision] Triggered PM acknowledgment + SA design`);
        } catch (e) {
          console.error('[Decision] Failed to trigger PM:', e);
        }
      }

      // SDD approval → mark document approved, move card, trigger PM→TL
      if (trigger.includes('sdd') || trigger.includes('architecture') || trigger.includes('system design')) {
        console.log(`[Decision] SDD approved for project ${projectId} — running side effects`);

        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true },
        });
        const sddProjectName = project?.name || 'this project';

        // 1. Mark SDD document as APPROVED
        try {
          await prisma.document.updateMany({
            where: { projectId, type: 'SDD' },
            data: { status: 'APPROVED' },
          });
          console.log(`[Decision] SDD document status → APPROVED`);
        } catch (e) {
          console.error('[Decision] Failed to update SDD status:', e);
        }

        // 2. Move Solution Design card to DONE
        try {
          const sdCard = await prisma.card.findFirst({
            where: { projectId, title: { contains: 'Solution Design' } },
          });
          if (sdCard) {
            await prisma.card.update({
              where: { id: sdCard.id },
              data: { state: 'DONE' },
            });
            console.log(`[Decision] Solution Design card → DONE`);
          }
        } catch (e) {
          console.error('[Decision] Failed to update SD card:', e);
        }

        // 3. Create Scaffolding card for DO (deterministic)
        try {
          const doAgent = await prisma.agent.findFirst({
            where: { projectId, shortName: 'DO' },
            select: { id: true },
          });

          const existingScaffoldCard = await prisma.card.findFirst({
            where: { projectId, title: { contains: 'Scaffolding' } },
          });

          if (!existingScaffoldCard) {
            await prisma.card.create({
              data: {
                title: `Project Scaffolding: ${sddProjectName}`,
                description: `Phase 3: DevOps Engineer scaffolds the project based on the approved SDD tech stack. Requires Codanium IDE.`,
                type: 'TASK',
                state: 'PLANNED',
                priority: 'HIGH',
                ownerAgentId: doAgent?.id,
                projectId,
              },
            });
            console.log(`[Decision] Created Scaffolding card for DO`);
          }
        } catch (e) {
          console.error('[Decision] Failed to create scaffolding card:', e);
        }

        // 4. Enqueue PM to acknowledge SDD approval + prompt user to open IDE
        try {
          const member = await prisma.projectMember.findFirst({
            where: { projectId },
            select: { userId: true },
          });
          const userId = member?.userId || 'usr-001';

          // Create system message about IDE requirement
          await prisma.chatMessage.create({
            data: {
              role: 'SYSTEM',
              content: `SDD has been approved. Requirements and architecture phases are COMPLETE. The next phase (Project Scaffolding) requires the Codanium IDE. Inform the user to open the Codanium IDE to continue.`,
              projectId,
            },
          });

          await taskQueue.enqueue({
            projectId,
            userId,
            userMessage: `The user approved the SDD. Architecture phase is COMPLETE. Tell the user: "Great news! Requirements and architecture are done. To continue with project scaffolding and development, please open the Codanium IDE. If you haven't installed it yet, download it from our releases page." Do NOT create any development task cards yet — scaffolding must happen first in the IDE.`,
            targetAgent: 'PM',
            autoRouted: true,
            isBackground: true,
            priority: 10,
          });
          console.log(`[Decision] Triggered PM for IDE handoff message`);
        } catch (e) {
          console.error('[Decision] Failed to trigger PM for IDE handoff:', e);
        }
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/projects/[id]/decisions/[decisionId] error:', error);
    return NextResponse.json({ error: 'Failed to update decision' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/decisions/[decisionId]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; decisionId: string }> }
) {
  try {
    const { id: projectId, decisionId } = await params;

    const decision = await prisma.decision.findFirst({
      where: { id: decisionId, projectId },
    });

    if (!decision) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }

    await prisma.decision.delete({ where: { id: decisionId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id]/decisions/[decisionId] error:', error);
    return NextResponse.json({ error: 'Failed to delete decision' }, { status: 500 });
  }
}
