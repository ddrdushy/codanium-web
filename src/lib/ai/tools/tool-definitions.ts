// =============================================================================
// Codanium — Tool Definitions (JSON Schema)
// =============================================================================
// Structured tool schemas for all agent capabilities. Compatible with
// OpenAI function calling, Anthropic tool_use, and Ollama tools API.
// Agents receive a filtered subset based on their authority (canWrite).
// =============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  category: 'project' | 'filesystem' | 'shell' | 'git' | 'web' | 'deploy' | 'communication';
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  success: boolean;
  result: any;
  error?: string;
}

// ─── A. Project Management Tools ──────────────────────────────────────────────

export const createCard: ToolDefinition = {
  name: 'create_card',
  description: 'Create a new task card on the project work board. Use this to break down features into actionable tasks.',
  category: 'project',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Card title (e.g., "POST /api/users/login")' },
      description: { type: 'string', description: 'Detailed description of what this task involves' },
      type: { type: 'string', enum: ['EPIC', 'FEATURE', 'TASK', 'BUG'], description: 'Card type' },
      priority: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], description: 'Priority level' },
      module: { type: 'string', description: 'Module or feature area (e.g., "Auth API")' },
      parentId: { type: 'string', description: 'Parent card ID (for tasks under features/epics)' },
      requirementIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'BRD requirement IDs this card implements (e.g., ["FR-001", "FR-002"]). These trace back to functional requirements in the BRD.',
      },
    },
    required: ['title', 'type'],
  },
};

export const updateCard: ToolDefinition = {
  name: 'update_card',
  description: 'Update an existing card on the work board. Use to change state (PLANNED→IN_PROGRESS→DONE), assign developers, or update priority.',
  category: 'project',
  inputSchema: {
    type: 'object',
    properties: {
      cardId: { type: 'string', description: 'ID of the card to update' },
      state: { type: 'string', enum: ['PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'REVIEW', 'TESTING', 'DONE', 'BLOCKED'], description: 'New card state. Use REVIEW or UNDER_REVIEW for code review.' },
      assigneeId: { type: 'string', description: 'Agent short name: "JD" (Junior Developer), "SD" (Senior Developer), "UX" (UI/UX Designer), "DO" (DevOps). Do NOT use system IDs.' },
      description: { type: 'string', description: 'Updated description' },
      priority: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
      title: { type: 'string', description: 'Updated title' },
    },
    required: ['cardId'],
  },
};

export const createDocument: ToolDefinition = {
  name: 'create_document',
  description: 'Create a project document (BRD, SDD, or other deliverable). The document is saved to the project\'s document store.',
  category: 'project',
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['BRD', 'SDD', 'API_SPEC', 'DESIGN_SYSTEM', 'TEST_PLAN', 'DEPLOYMENT_GUIDE', 'OTHER'], description: 'Document type' },
      title: { type: 'string', description: 'Document title' },
      content: { type: 'string', description: 'Full markdown content of the document' },
    },
    required: ['type', 'title', 'content'],
  },
};

export const updateDocument: ToolDefinition = {
  name: 'update_document',
  description: 'Update an existing document. Can append to or replace the content.',
  category: 'project',
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', description: 'Document type to update (e.g., "BRD")' },
      content: { type: 'string', description: 'Content to add or replace' },
      mode: { type: 'string', enum: ['append', 'replace'], description: 'Whether to append to or replace existing content' },
    },
    required: ['type', 'content', 'mode'],
  },
};

export const approveDocument: ToolDefinition = {
  name: 'approve_document',
  description: 'Mark a document as approved. This signals that the document is finalized and ready for the next phase.',
  category: 'project',
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', description: 'Document type to approve (e.g., "BRD", "SDD")' },
    },
    required: ['type'],
  },
};

export const createDecision: ToolDefinition = {
  name: 'create_decision',
  description: 'Record a technical or product decision with options and recommendation.',
  category: 'project',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Decision title' },
      description: { type: 'string', description: 'What needs to be decided' },
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            pros: { type: 'string' },
            cons: { type: 'string' },
          },
        },
        description: 'Available options',
      },
      recommendation: { type: 'string', description: 'Which option you recommend and why' },
    },
    required: ['title', 'description'],
  },
};

export const remember: ToolDefinition = {
  name: 'remember',
  description: 'Store important information in project memory for future reference by any agent.',
  category: 'project',
  inputSchema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Memory key (e.g., "tech_stack", "user_preference")' },
      value: { type: 'string', description: 'The information to remember' },
    },
    required: ['key', 'value'],
  },
};

export const taskProgress: ToolDefinition = {
  name: 'task_progress',
  description: 'Update the progress of the current task. Shows progress to the user in real-time.',
  category: 'project',
  inputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'Current status message (e.g., "Writing login endpoint...")' },
      percent: { type: 'number', description: 'Completion percentage (0-100)' },
    },
    required: ['status'],
  },
};

// ─── B. Filesystem Tools ──────────────────────────────────────────────────────

export const readFile: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file in the project workspace. Use before editing to understand existing code.',
  category: 'filesystem',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to project root (e.g., "src/api/login.ts")' },
    },
    required: ['path'],
  },
};

export const writeFile: ToolDefinition = {
  name: 'write_file',
  description: 'Create or overwrite a file in the project workspace. Use for creating new source files.',
  category: 'filesystem',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to project root' },
      content: { type: 'string', description: 'Full file content to write' },
    },
    required: ['path', 'content'],
  },
};

export const editFile: ToolDefinition = {
  name: 'edit_file',
  description: 'Make targeted edits to an existing file. Replaces old_string with new_string. More efficient than rewriting the entire file.',
  category: 'filesystem',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to project root' },
      old_string: { type: 'string', description: 'The exact text to find and replace' },
      new_string: { type: 'string', description: 'The replacement text' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
};

export const listDirectory: ToolDefinition = {
  name: 'list_directory',
  description: 'List files and directories in the project workspace. Returns names, types, and sizes.',
  category: 'filesystem',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path relative to project root (default: ".")' },
      recursive: { type: 'boolean', description: 'Whether to list recursively (default: false)' },
    },
  },
};

export const globFiles: ToolDefinition = {
  name: 'glob',
  description: 'Find files matching a glob pattern in the project workspace.',
  category: 'filesystem',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.tsx", "src/api/**/*.ts")' },
    },
    required: ['pattern'],
  },
};

export const grepFiles: ToolDefinition = {
  name: 'grep',
  description: 'Search file contents for a pattern in the project workspace. Returns matching lines with file paths.',
  category: 'filesystem',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Search pattern (regex supported)' },
      path: { type: 'string', description: 'Directory or file to search in (default: ".")' },
      filePattern: { type: 'string', description: 'Glob to filter files (e.g., "*.ts")' },
    },
    required: ['pattern'],
  },
};

// ─── C. Shell & Build Tools ───────────────────────────────────────────────────

export const runCommand: ToolDefinition = {
  name: 'run_command',
  description: 'Execute a shell command in the project workspace. Commands run in a sandboxed Docker container. Use for npm install, build, test, etc.',
  category: 'shell',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute (e.g., "npm install", "npm run build")' },
      timeout: { type: 'number', description: 'Timeout in seconds (default: 60, max: 300)' },
    },
    required: ['command'],
  },
};

export const runTests: ToolDefinition = {
  name: 'run_tests',
  description: 'Run the project test suite and return results. Equivalent to npm test.',
  category: 'shell',
  inputSchema: {
    type: 'object',
    properties: {
      testFile: { type: 'string', description: 'Specific test file to run (optional, runs all tests if omitted)' },
      coverage: { type: 'boolean', description: 'Include coverage report (default: false)' },
    },
  },
};

export const runBuild: ToolDefinition = {
  name: 'run_build',
  description: 'Build the project and return build output. Equivalent to npm run build.',
  category: 'shell',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

// ─── D. Git Tools ─────────────────────────────────────────────────────────────

export const gitCommit: ToolDefinition = {
  name: 'git_commit',
  description: 'Stage all changes and create a git commit in the project workspace.',
  category: 'git',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Commit message' },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific files to stage (stages all if omitted)',
      },
    },
    required: ['message'],
  },
};

export const gitBranch: ToolDefinition = {
  name: 'git_branch',
  description: 'Create or switch git branches in the project workspace.',
  category: 'git',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Branch name' },
      action: { type: 'string', enum: ['create', 'switch', 'delete'], description: 'Branch action' },
    },
    required: ['name', 'action'],
  },
};

export const gitDiff: ToolDefinition = {
  name: 'git_diff',
  description: 'Show uncommitted changes in the project workspace.',
  category: 'git',
  inputSchema: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Specific file to diff (shows all if omitted)' },
      staged: { type: 'boolean', description: 'Show staged changes only' },
    },
  },
};

export const createPr: ToolDefinition = {
  name: 'create_pr',
  description: 'Create a pull request on the project repository.',
  category: 'git',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'PR title' },
      body: { type: 'string', description: 'PR description (markdown)' },
      baseBranch: { type: 'string', description: 'Target branch (default: main)' },
    },
    required: ['title'],
  },
};

// ─── E. Web Tools ─────────────────────────────────────────────────────────────

export const webSearch: ToolDefinition = {
  name: 'web_search',
  description: 'Search the web for documentation, solutions, or information relevant to the current task.',
  category: 'web',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
};

export const webFetch: ToolDefinition = {
  name: 'web_fetch',
  description: 'Fetch content from a URL. Useful for reading API documentation or reference material.',
  category: 'web',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
    },
    required: ['url'],
  },
};

// ─── F. Deploy Tools ──────────────────────────────────────────────────────────

export const triggerDeploy: ToolDefinition = {
  name: 'trigger_deploy',
  description: 'Deploy the project to staging or production environment.',
  category: 'deploy',
  inputSchema: {
    type: 'object',
    properties: {
      environment: { type: 'string', enum: ['staging', 'production'], description: 'Target environment' },
    },
    required: ['environment'],
  },
};

// ─── G. Guardrail Tools ───────────────────────────────────────────────────────

export const validateCode: ToolDefinition = {
  name: 'validate_code',
  description: 'Run code quality checks on a file or the entire project. Checks for syntax errors, type errors, linting issues, and security vulnerabilities.',
  category: 'shell',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to validate (validates entire project if omitted)' },
      checks: {
        type: 'array',
        items: { type: 'string', enum: ['syntax', 'types', 'lint', 'security', 'all'] },
        description: 'Which checks to run (default: all)',
      },
    },
  },
};

export const reviewChanges: ToolDefinition = {
  name: 'review_changes',
  description: 'Review uncommitted code changes for quality, security, and best practices. Returns issues found with severity levels.',
  category: 'shell',
  inputSchema: {
    type: 'object',
    properties: {
      scope: { type: 'string', enum: ['staged', 'unstaged', 'all'], description: 'Which changes to review (default: all)' },
    },
  },
};

export const checkDependencies: ToolDefinition = {
  name: 'check_dependencies',
  description: 'Audit project dependencies for known vulnerabilities, outdated packages, and license compliance.',
  category: 'shell',
  inputSchema: {
    type: 'object',
    properties: {
      fix: { type: 'boolean', description: 'Automatically fix vulnerabilities if possible (default: false)' },
    },
  },
};

export const validateArchitecture: ToolDefinition = {
  name: 'validate_architecture',
  description: 'Check that the codebase follows the defined architecture patterns. Validates module boundaries, import rules, and naming conventions.',
  category: 'shell',
  inputSchema: {
    type: 'object',
    properties: {
      rules: { type: 'string', description: 'Path to architecture rules file (default: auto-detect)' },
    },
  },
};

// ─── H. Analysis Tools ────────────────────────────────────────────────────────

export const runAnalysis: ToolDefinition = {
  name: 'run_analysis',
  description: 'Run cross-artifact consistency analysis on the project. Returns findings about coverage gaps, missing documents, and inconsistencies between BRD, SDD, task cards, and SDLC stages.',
  category: 'project',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

// ─── I. Communication Tools ───────────────────────────────────────────────

export const consultAgent: ToolDefinition = {
  name: 'consult_agent',
  description: 'Ask another AI team member for their expert input on a question. Use this when you need technical advice, design feedback, or domain expertise from a specialist.',
  category: 'communication',
  inputSchema: {
    type: 'object',
    properties: {
      agent: {
        type: 'string',
        enum: ['BA', 'SA', 'UX', 'PM', 'TL', 'JD', 'SD', 'QA', 'SEC', 'DO', 'PE', 'IE', 'SM', 'SR', 'DEC', 'AUD', 'CA'],
        description: 'The agent to consult (e.g., SA for architecture, QA for testing, SEC for security)',
      },
      question: {
        type: 'string',
        description: 'The specific question to ask the other agent',
      },
    },
    required: ['agent', 'question'],
  },
};

// ─── G. Communication Tools ───────────────────────────────────────────────────

export const askUser: ToolDefinition = {
  name: 'ask_user',
  description: 'Ask the user a question when you are missing critical information needed to complete your task. Use this ONLY when truly blocked — e.g., missing content text, API credentials, or brand assets that were not provided in the BRD. The pipeline will pause and wait for the user to respond.',
  category: 'communication',
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The question to ask the user' },
      context: { type: 'string', description: 'Why you need this information (helps the user understand urgency)' },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional clickable answer options (A, B, C style)',
      },
    },
    required: ['question'],
  },
};

// ─── Tool Registry ────────────────────────────────────────────────────────────

export const ALL_TOOLS: ToolDefinition[] = [
  // Project management
  createCard, updateCard, createDocument, updateDocument,
  approveDocument, createDecision, remember, taskProgress,
  // Filesystem
  readFile, writeFile, editFile, listDirectory, globFiles, grepFiles,
  // Shell
  runCommand, runTests, runBuild,
  // Git
  gitCommit, gitBranch, gitDiff, createPr,
  // Web
  webSearch, webFetch,
  // Deploy
  triggerDeploy,
  // Guardrails
  validateCode, reviewChanges, checkDependencies, validateArchitecture,
  // Analysis
  runAnalysis,
  // Communication
  consultAgent,
  askUser,
];

/**
 * Convert a ToolDefinition to OpenAI function calling format.
 */
export function toOpenAITool(tool: ToolDefinition) {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

/**
 * Convert a ToolDefinition to Anthropic tool_use format.
 */
export function toAnthropicTool(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}

/**
 * Convert a ToolDefinition to Ollama tools format.
 */
export function toOllamaTool(tool: ToolDefinition) {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}
