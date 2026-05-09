# Agent Collaboration & Delegation

Unlike standard chat interfaces where you converse with a single AI, Codanium features an interconnected web of agents that converse with *each other*.

## The Delegation Tag

When an agent needs help outside of its specific domain, it outputs a specialized tag that is intercepted by the **Action Parser** in the `ats-worker`.

```text
[DELEGATE: <TARGET_AGENT_ID>] Message payload
```

### Example Workflow

1. **User Request**: "Please build the login screen."
2. **Intent Router**: Routes to the **PM (Project Manager)**.
3. **PM Agent**: The PM realizes it needs to create a Kanban card for this, but it doesn't know what database fields exist for a User.
4. **PM Output**: `[DELEGATE: SA] What are the fields on the User model? I need to write a ticket for the login screen.`
5. **Orchestrator Intercept**: The system intercepts this tag. The user never sees it in the UI.
6. **SA Agent**: The system invisibly prompts the Software Architect agent with the PM's question.
7. **SA Output**: `The User model has: id, email, passwordHash, and createdAt.`
8. **Resolution**: The system feeds the SA's answer back into the PM's context window. The PM then successfully generates the Kanban card.

## System Actions

Agents can also collaborate with the *platform* itself using Action tags.

* `[ACTION: CREATE_CARD title="Login Screen" status="TODO"]`
* `[ACTION: UPDATE_FILE path="src/app/login/page.tsx" content="..."]`
* `[ACTION: TRIGGER_PIPELINE env="staging"]`

These tags execute physical changes in the PostgreSQL database or the local filesystem via secure sandbox environments.
