import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums (mirror Prisma enums for Zod validation)
// ---------------------------------------------------------------------------

export const CardTypeEnum = z.enum([
  'EPIC',
  'FEATURE',
  'TASK',
  'QA',
  'DECISION_BLOCKER',
]);

export const CardStateEnum = z.enum([
  'PLANNED',
  'IN_PROGRESS',
  'UNDER_REVIEW',
  'TESTING',
  'BLOCKED',
  'DONE',
  'RELEASED',
]);

export const PriorityEnum = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);

export const RiskRatingEnum = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);

export const EffortEnum = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
]);

export const ChatRoleEnum = z.enum([
  'USER',
  'AGENT',
  'SYSTEM',
]);

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export const createProjectSchema = z.object({
  name: z
    .string({ error: 'Project name is required' })
    .trim()
    .min(2, 'Project name must be at least 2 characters')
    .max(100, 'Project name must be 100 characters or less'),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or less')
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid hex color')
    .optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export const createCardSchema = z.object({
  title: z
    .string({ error: 'Card title is required' })
    .trim()
    .min(1, 'Card title is required')
    .max(200, 'Card title must be 200 characters or less'),
  type: CardTypeEnum.optional().default('TASK'),
  state: CardStateEnum.optional().default('PLANNED'),
  priority: PriorityEnum.optional().default('MEDIUM'),
  description: z.string().max(5000).optional(),
  assigneeId: z.string().optional(),
  ownerAgentId: z.string().optional(),
  parentId: z.string().optional(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;

// ---------------------------------------------------------------------------
// Chat Message
// ---------------------------------------------------------------------------

export const chatMessageSchema = z.object({
  content: z
    .string({ error: 'Content is required' })
    .trim()
    .min(1, 'Content is required')
    .max(50000, 'Message must be 50,000 characters or less'),
  role: ChatRoleEnum.optional().default('USER'),
  agentId: z.string().optional(),
  thinking: z.string().max(50000).optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

// ---------------------------------------------------------------------------
// Git Push
// ---------------------------------------------------------------------------

export const gitPushSchema = z.object({
  branchName: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z0-9._\-/]+$/,
      'Branch name may only contain letters, numbers, dots, dashes, underscores, and slashes',
    )
    .max(100)
    .optional(),
  commitMessage: z
    .string()
    .trim()
    .max(500, 'Commit message must be 500 characters or less')
    .optional(),
  createPR: z.boolean().optional().default(false),
});

export type GitPushInput = z.infer<typeof gitPushSchema>;

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export const createWebhookSchema = z.object({
  url: z
    .string({ error: 'URL is required' })
    .url('Invalid URL format')
    .refine(
      (u) => {
        try {
          const parsed = new URL(u);
          return ['https:', 'http:'].includes(parsed.protocol);
        } catch {
          return false;
        }
      },
      { message: 'URL must use HTTPS or HTTP' },
    ),
  events: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

// ---------------------------------------------------------------------------
// Agent Update
// ---------------------------------------------------------------------------

export const updateAgentSchema = z.object({
  agentId: z.string({ error: 'Agent ID is required' }),
  status: z.string().optional(),
  currentTask: z.string().max(500).optional(),
});

export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export const createDecisionSchema = z.object({
  trigger: z
    .string({ error: 'Decision trigger is required' })
    .trim()
    .min(1, 'Decision trigger is required')
    .max(2000),
  ownerId: z
    .string({ error: 'Owner ID is required' }),
  riskRating: RiskRatingEnum.optional(),
  effort: EffortEnum.optional(),
  options: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        pros: z.array(z.string()).optional(),
        cons: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  context: z.string().max(5000).optional(),
  deadline: z.string().optional(),
});

export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;

// ---------------------------------------------------------------------------
// Auth — Register
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be 100 characters or less'),
  email: z
    .string({ error: 'Email is required' })
    .email('A valid email address is required'),
  password: z
    .string({ error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be 128 characters or less'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Preview Tier
// ---------------------------------------------------------------------------

export const previewTierSchema = z.object({
  tier: z.enum(['sandpack', 'webcontainer', 'cloud'], {
    error: 'Invalid preview tier',
  }),
});

export type PreviewTierInput = z.infer<typeof previewTierSchema>;

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

export const NotificationTypeEnum = z.enum([
  'DECISION',
  'COMPLETION',
  'PR',
  'FAILURE',
  'AGENT',
  'DEPLOY',
  'SECURITY',
  'BUILD',
]);

export const createNotificationSchema = z.object({
  type: NotificationTypeEnum,
  title: z
    .string({ error: 'Notification title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less'),
  description: z.string().max(2000).optional(),
  actionLabel: z.string().max(100).optional(),
  actionHref: z.string().max(500).optional(),
  userId: z.string({ error: 'User ID is required' }),
  projectId: z.string().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

// ---------------------------------------------------------------------------
// Wireframe
// ---------------------------------------------------------------------------

export const WireframeStatusEnum = z.enum(['DRAFT', 'REVIEW', 'APPROVED']);
export const DeviceTypeEnum = z.enum(['DESKTOP', 'MOBILE', 'TABLET']);

export const createWireframeSchema = z.object({
  title: z
    .string({ error: 'Wireframe title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less'),
  screen: z.string().max(100).optional().default(''),
  device: DeviceTypeEnum.optional().default('DESKTOP'),
  status: WireframeStatusEnum.optional().default('DRAFT'),
});

export type CreateWireframeInput = z.infer<typeof createWireframeSchema>;

export const updateWireframeSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  screen: z.string().max(100).optional(),
  device: DeviceTypeEnum.optional(),
  status: WireframeStatusEnum.optional(),
});

export type UpdateWireframeInput = z.infer<typeof updateWireframeSchema>;
