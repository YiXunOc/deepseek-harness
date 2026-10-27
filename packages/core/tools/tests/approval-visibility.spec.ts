import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjections from '@deepseek-ai/dsh-session-projection'
import ApprovalService, { setApprovalPolicy } from '@deepseek-ai/dsh-user-approval'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import type { Agent } from '@deepseek-ai/dsh-agent'

describe('never approval policy tool contract', () => {
  it('copies the model projection without escalation fields and restores ask without changing the registered schema', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjections)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(NativeToolExecutor)
    await ctx.plugin(ApprovalService, { policy: 'ask' })
    let runs = 0
    const original = defineTool({
      name: 'pwsh', description: 'Run a command.',
      parameters: {
        description: { type: 'string', required: true }, command: { type: 'string', required: true },
        sandbox_permissions: { type: 'string' }, justification: { type: 'string' },
      },
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
      async execute() { runs++; return 'ok' },
    })
    ctx.tools.register(original)
    const session = ctx.sessions.create(SessionId('visibility'))
    session.append('turn/start', { turn: 1 })
    const agent = { session } as Agent
    const view = async () => {
      const assembly = await ctx.systemPrompt.assemble({ agent, scope: agent })
      return assembly.tools.find(tool => tool.name === 'pwsh')!.parameters as {
        properties: Record<string, unknown>
        required: string[]
      }
    }
    try {
      expect((await view()).properties).toHaveProperty('sandbox_permissions')
      setApprovalPolicy(session, 'never')
      const hidden = await view()
      expect(hidden.properties).not.toHaveProperty('sandbox_permissions')
      expect(hidden.properties).not.toHaveProperty('justification')
      expect(hidden.required).toEqual(['description', 'command'])
      expect(original.parameters).toHaveProperty('properties.sandbox_permissions')
      expect(ctx.tools.schemas(agent)[0]?.parameters).toHaveProperty('properties.sandbox_permissions')
      const originalParameters = original.parameters as { properties: Record<string, unknown>; required: string[] }
      const strictParameters = Object.freeze({
        ...originalParameters,
        properties: Object.freeze({ ...originalParameters.properties }),
        required: Object.freeze([...originalParameters.required, 'sandbox_permissions', 'justification']),
      })
      ctx.tools.register({ ...original, name: 'strict', parameters: strictParameters })
      const projected = (await ctx.systemPrompt.assemble({ agent, scope: agent })).tools.find(tool => tool.name === 'strict')!
      expect((projected.parameters as typeof originalParameters).required).toEqual(['description', 'command'])
      expect((projected.parameters as typeof originalParameters).properties).not.toHaveProperty('sandbox_permissions')
      expect(strictParameters.required).toContain('sandbox_permissions')
      expect(strictParameters.properties).toHaveProperty('sandbox_permissions')
      const call = (args: Record<string, unknown>) => executeToolFixture(ctx, {
        callId: ToolCallId('approval-visibility'), name: 'pwsh',
        arguments: { description: 'Run a command', command: 'echo ok', ...args },
        agent, signal: new AbortController().signal,
      })
      for (const args of [{ sandbox_permissions: 'workspace-write', justification: '' }, { justification: '' }, { sandbox_permissions: 'workspace-write', justification: 'why' }]) {
        const result = await call(args)
        expect(result.isError).toBe(true)
        expect(JSON.stringify(result.content)).toContain('approval policy')
      }
      expect(runs).toBe(0)
      expect(session.snapshotEvents().filter(event => event.type === 'approval/asked')).toHaveLength(0)
      expect((await call({})).isError).toBe(false)
      expect(runs).toBe(1)
      setApprovalPolicy(session, 'ask')
      expect((await view()).properties).toHaveProperty('sandbox_permissions')
    } finally { await ctx.fiber.dispose() }
  })
})
