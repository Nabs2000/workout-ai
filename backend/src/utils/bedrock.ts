import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandInput,
  Message,
  ContentBlock,
  ToolConfiguration,
  ToolResultBlock,
} from '@aws-sdk/client-bedrock-runtime';

const MODEL_ID = process.env.NOVA_MODEL_ID ?? 'amazon.nova-lite-v1:0';
const REGION = process.env.REGION ?? 'us-east-1';

const bedrock = new BedrockRuntimeClient({ region: REGION });

export interface NovaMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

/**
 * Simple text generation with Nova (no tools).
 */
export async function invokeNova(
  systemPrompt: string,
  messages: NovaMessage[],
  maxTokens = 2048,
): Promise<string> {
  const input: ConverseCommandInput = {
    modelId: MODEL_ID,
    system: [{ text: systemPrompt }],
    messages: messages as Message[],
    inferenceConfig: { maxTokens, temperature: 0.7, topP: 0.9 },
  };

  const response = await bedrock.send(new ConverseCommand(input));
  const block = response.output?.message?.content?.[0];
  if (block && 'text' in block) return block.text ?? '';
  throw new Error('Nova returned no text content');
}

/**
 * Agentic loop: Nova with tool use (function calling).
 * Runs until the model stops calling tools or maxIterations is reached.
 */
export async function invokeNovaWithTools<ToolResult>(
  systemPrompt: string,
  initialMessages: NovaMessage[],
  tools: ToolConfiguration,
  toolHandlers: Record<string, (input: unknown) => Promise<ToolResult>>,
  maxIterations = 10,
): Promise<{ finalText: string; toolCallCount: number }> {
  const messages: Message[] = initialMessages as Message[];
  let toolCallCount = 0;

  for (let i = 0; i < maxIterations; i++) {
    const input: ConverseCommandInput = {
      modelId: MODEL_ID,
      system: [{ text: systemPrompt }],
      messages,
      toolConfig: tools,
      inferenceConfig: { maxTokens: 4096, temperature: 0.7 },
    };

    const response = await bedrock.send(new ConverseCommand(input));
    const assistantMsg = response.output?.message;
    if (!assistantMsg) throw new Error('Nova returned no message');

    messages.push(assistantMsg);

    // Check stop reason
    if (response.stopReason === 'end_turn') {
      // Extract the final text response
      const textBlock = assistantMsg.content?.find((b): b is { text: string } => 'text' in b);
      return { finalText: textBlock?.text ?? '', toolCallCount };
    }

    if (response.stopReason === 'tool_use') {
      // Process all tool calls in this turn
      const toolResults: ContentBlock[] = [];

      for (const block of assistantMsg.content ?? []) {
        if (!('toolUse' in block) || !block.toolUse) continue;

        const { toolUseId, name, input: toolInput } = block.toolUse;
        const handler = toolHandlers[name ?? ''];
        toolCallCount++;

        let resultContent: string;
        if (handler) {
          try {
            const result = await handler(toolInput);
            resultContent = JSON.stringify(result);
          } catch (err: any) {
            resultContent = JSON.stringify({ error: err.message });
          }
        } else {
          resultContent = JSON.stringify({ error: `Unknown tool: ${name}` });
        }

        toolResults.push({
          toolResult: {
            toolUseId,
            content: [{ text: resultContent }],
          } as ToolResultBlock,
        });
      }

      // Add tool results as a user message (required by Converse API)
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // max_tokens or other stop reason — extract what we have
    const textBlock = assistantMsg.content?.find((b): b is { text: string } => 'text' in b);
    return { finalText: textBlock?.text ?? '', toolCallCount };
  }

  throw new Error('Agentic loop exceeded max iterations');
}
