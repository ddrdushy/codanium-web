import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// taskQueue removed — FSM auto-trigger in pipeline-fsm.ts handles agent enqueuing
import * as pipelineFSM from '@/lib/ai/orchestration/pipeline-fsm';

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

    // ── Pipeline FSM Transition ────────────────────────────────────────
    if (body.status === 'APPROVED') {
      const newPhase = await pipelineFSM.transition(projectId, 'user_approved');
      console.log(`[Decision] FSM transition: user_approved → ${newPhase}`);
    } else if (body.status === 'REJECTED') {
      const newPhase = await pipelineFSM.transition(projectId, 'user_rejected');
      console.log(`[Decision] FSM transition: user_rejected → ${newPhase}`);
    }

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

        // 1. Mark BRD document as APPROVED + LOCKED (artifact governance)
        try {
          await prisma.document.updateMany({
            where: { projectId, type: 'BRD' },
            data: { status: 'APPROVED', locked: true },
          });
          console.log(`[Decision] BRD document status → APPROVED + LOCKED`);
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

        // 3. Create Solution Design card for SA (deterministic, not LLM-dependent)
        // Note: Agent enqueuing is handled by FSM auto-trigger in pipeline-fsm.ts
        try {
          const brd = await prisma.document.findFirst({
            where: { projectId, type: 'BRD' },
            select: { content: true },
          });
          const brdSummary = brd?.content
            ? brd.content.substring(0, 500)
            : 'BRD approved.';

          const saAgent = await prisma.agent.findFirst({
            where: { projectId, shortName: 'SA' },
            select: { id: true },
          });

          const existingSACard = await prisma.card.findFirst({
            where: { projectId, title: { contains: 'Solution Design' } },
          });

          if (!existingSACard) {
            await prisma.card.create({
              data: {
                title: `Solution Design: ${projectName}`,
                description: `Phase 2: Solution Architect creates the System Design Document (SDD) based on the approved BRD.\n\nBRD Summary:\n${brdSummary}`,
                type: 'TASK',
                state: 'IN_PROGRESS',
                priority: 'HIGH',
                ownerAgentId: saAgent?.id,
                projectId,
              },
            });
            console.log(`[Decision] Created Solution Design card for SA`);
          }
          // FSM auto-trigger handles enqueuing SA agent — no manual enqueue needed
          console.log(`[Decision] BRD approval complete — FSM will trigger SA`);
        } catch (e) {
          console.error('[Decision] Failed to create SA card:', e);
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

        // 1. Mark SDD document as APPROVED + LOCKED (artifact governance)
        try {
          await prisma.document.updateMany({
            where: { projectId, type: 'SDD' },
            data: { status: 'APPROVED', locked: true },
          });
          console.log(`[Decision] SDD document status → APPROVED + LOCKED`);
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

        // FSM auto-trigger handles enqueuing DO agent — no manual enqueue needed
        console.log(`[Decision] SDD approval complete — FSM will trigger DO`);

      }

      // UI approval → lock wireframes, create dev cards, prepare for DEV_WORKING
      if (trigger.includes('ui') && (trigger.includes('approval') || trigger.includes('design'))) {
        console.log(`[Decision] UI approved for project ${projectId} — running side effects`);

        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true },
        });
        const uiProjectName = project?.name || 'this project';

        // 1. Lock DESIGN_SYSTEM document
        try {
          await prisma.document.updateMany({
            where: { projectId, type: 'DESIGN_SYSTEM' },
            data: { status: 'APPROVED', locked: true },
          });
          console.log(`[Decision] DESIGN_SYSTEM document → APPROVED + LOCKED`);
        } catch (e) {
          console.error('[Decision] Failed to lock design system:', e);
        }

        // 2. Approve wireframes
        try {
          await prisma.wireframe.updateMany({
            where: { projectId },
            data: { status: 'APPROVED' },
          });
          console.log(`[Decision] Wireframes → APPROVED`);
        } catch (e) {
          console.error('[Decision] Failed to approve wireframes:', e);
        }

        // 3. Move UX Design card to DONE
        try {
          const uxCard = await prisma.card.findFirst({
            where: { projectId, title: { contains: 'UX Design' } },
          });
          if (uxCard) {
            await prisma.card.update({
              where: { id: uxCard.id },
              data: { state: 'DONE' },
            });
            console.log(`[Decision] UX Design card → DONE`);
          }
        } catch (e) {
          console.error('[Decision] Failed to update UX card:', e);
        }

        // 4. Create Development card for TL
        try {
          const tlAgent = await prisma.agent.findFirst({
            where: { projectId, shortName: 'TL' },
            select: { id: true },
          });

          const existingDevCard = await prisma.card.findFirst({
            where: { projectId, title: { contains: 'Development' }, type: 'TASK' },
          });

          if (!existingDevCard) {
            await prisma.card.create({
              data: {
                title: `Development: ${uiProjectName}`,
                description: `Tech Lead breaks down the SDD into development cards based on approved wireframes and UI Kit. Assigns to JD/SD and coordinates the build cycle.`,
                type: 'TASK',
                state: 'PLANNED',
                priority: 'HIGH',
                ownerAgentId: tlAgent?.id,
                projectId,
              },
            });
            console.log(`[Decision] Created Development card for TL`);
          }
        } catch (e) {
          console.error('[Decision] Failed to create dev card:', e);
        }

        console.log(`[Decision] UI approval complete — FSM will trigger DEV_WORKING`);
      }

      // Scaffolding approval → move card to DONE, prepare for UX_WORKING
      if (trigger.includes('scaffold') || trigger.includes('project setup') || trigger.includes('devops')) {
        console.log(`[Decision] Scaffolding approved for project ${projectId} — running side effects`);

        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true },
        });
        const scaffoldProjectName = project?.name || 'this project';

        // 1. Move Scaffolding card to DONE
        try {
          const scaffoldCard = await prisma.card.findFirst({
            where: { projectId, title: { contains: 'Scaffolding' } },
          });
          if (scaffoldCard) {
            await prisma.card.update({
              where: { id: scaffoldCard.id },
              data: { state: 'DONE' },
            });
            console.log(`[Decision] Scaffolding card → DONE`);
          }
        } catch (e) {
          console.error('[Decision] Failed to update scaffolding card:', e);
        }

        // 2. Create UX Design card (next phase after scaffold)
        try {
          const uxAgent = await prisma.agent.findFirst({
            where: { projectId, shortName: 'UX' },
            select: { id: true },
          });

          const existingUXCard = await prisma.card.findFirst({
            where: { projectId, title: { contains: 'UX Design' } },
          });

          if (!existingUXCard) {
            await prisma.card.create({
              data: {
                title: `UX Design: ${scaffoldProjectName}`,
                description: `Create the Design System / UI Kit: branding, color palette, typography, component system, and design tokens. After UI Kit is complete, UID will create wireframes.`,
                type: 'TASK',
                state: 'PLANNED',
                priority: 'HIGH',
                ownerAgentId: uxAgent?.id,
                projectId,
              },
            });
            console.log(`[Decision] Created UX Design card for UX agent`);
          }
        } catch (e) {
          console.error('[Decision] Failed to create UX card:', e);
        }

        // FSM auto-trigger handles enqueuing UX agent — no manual enqueue needed
        console.log(`[Decision] Scaffolding approval complete — FSM will trigger UX phase`);
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
