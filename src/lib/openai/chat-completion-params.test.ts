import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPENAI_CHAT_MODEL,
  applyChatCompletionModelParams,
  chatCompletionFinishReason,
  emptyChatCompletionMessage,
  extractChatCompletionText,
  isReasoningChatModel,
  resolveReasoningEffortForShortTask,
} from '@/lib/openai/chat-completion-params'

describe('isReasoningChatModel', () => {
  it('detecta gpt-5, gpt-6 e o-series', () => {
    expect(isReasoningChatModel('gpt-6-luna')).toBe(true)
    expect(isReasoningChatModel('gpt-5-mini')).toBe(true)
    expect(isReasoningChatModel('o3-mini')).toBe(true)
    expect(isReasoningChatModel('gpt-4o-mini')).toBe(false)
  })
})

describe('resolveReasoningEffortForShortTask', () => {
  it('usa none em gpt-6-luna e terra', () => {
    expect(resolveReasoningEffortForShortTask('gpt-6-luna')).toBe('none')
    expect(resolveReasoningEffortForShortTask('gpt-6.1-terra')).toBe('none')
  })

  it('usa low em modelos que nao aceitam none', () => {
    expect(resolveReasoningEffortForShortTask('gpt-6-astra')).toBe('low')
    expect(resolveReasoningEffortForShortTask('gpt-6.1-sol')).toBe('low')
  })

  it('usa minimal em gpt-5 e o-series', () => {
    expect(resolveReasoningEffortForShortTask('gpt-5-mini')).toBe('minimal')
    expect(resolveReasoningEffortForShortTask('o4-mini')).toBe('minimal')
  })
})

describe('applyChatCompletionModelParams', () => {
  it('configura reasoning com budget elevado e effort none no default', () => {
    const body: Record<string, unknown> = { model: DEFAULT_OPENAI_CHAT_MODEL }
    applyChatCompletionModelParams(body, {
      model: DEFAULT_OPENAI_CHAT_MODEL,
      tokenBudget: 500,
    })
    expect(body.max_completion_tokens).toBe(2500)
    expect(body.reasoning_effort).toBe('none')
    expect(body.max_tokens).toBeUndefined()
    expect(body.temperature).toBeUndefined()
  })

  it('eleva o budget do gpt-5-mini e usa minimal', () => {
    const body: Record<string, unknown> = { model: 'gpt-5-mini' }
    applyChatCompletionModelParams(body, {
      model: 'gpt-5-mini',
      tokenBudget: 500,
    })
    expect(body.max_completion_tokens).toBe(2500)
    expect(body.reasoning_effort).toBe('minimal')
  })

  it('usa max_tokens e temperature em modelos legados', () => {
    const body: Record<string, unknown> = { model: 'gpt-4o-mini' }
    applyChatCompletionModelParams(body, {
      model: 'gpt-4o-mini',
      tokenBudget: 500,
      temperature: 0.2,
    })
    expect(body.max_tokens).toBe(500)
    expect(body.temperature).toBe(0.2)
    expect(body.max_completion_tokens).toBeUndefined()
    expect(body.reasoning_effort).toBeUndefined()
  })
})

describe('extractChatCompletionText', () => {
  it('le content string e array', () => {
    expect(
      extractChatCompletionText({
        choices: [{ message: { content: '  olá  ' } }],
      }),
    ).toBe('olá')
    expect(
      extractChatCompletionText({
        choices: [{
          message: {
            content: [
              { type: 'text', text: 'linha 1' },
              { type: 'text', text: 'linha 2' },
            ],
          },
        }],
      }),
    ).toBe('linha 1\nlinha 2')
  })
})

describe('emptyChatCompletionMessage', () => {
  it('explica finish_reason length', () => {
    expect(chatCompletionFinishReason({
      choices: [{ finish_reason: 'length' }],
    })).toBe('length')
    expect(emptyChatCompletionMessage('length')).toMatch(/raciocínio interno/)
  })
})
