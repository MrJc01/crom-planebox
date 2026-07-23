import { MCP_TOOLS } from './MCPRegistry';
import { MCPExecutors } from './MCPExecutors';
import { WorldRepository } from '../storage/WorldRepository';

export interface OpenRouterResponse {
  content: string;
  snapshotImageUrl?: string;
  error?: string;
}

export class OpenRouterClient {
  private executors: MCPExecutors;

  constructor(executors: MCPExecutors) {
    this.executors = executors;
  }

  public async sendMessage(
    worldId: string,
    userText: string,
    onPartialText?: (chunkText: string) => void
  ): Promise<OpenRouterResponse> {
    const settings = await WorldRepository.getSettings();

    const isGoogle = settings.provider === 'google_aistudio';
    const apiKey = isGoogle ? settings.googleApiKey : settings.openRouterApiKey;
    const providerName = isGoogle ? 'Google AI Studio' : 'OpenRouter';

    if (!apiKey) {
      return {
        content: `⚠️ Chave de API do ${providerName} não configurada. Por favor, pressione ESC e insira sua chave nas Configurações.`,
        error: 'API Key missing'
      };
    }

    // Save user message to IndexedDB
    await WorldRepository.addChatMessage({
      worldId,
      role: 'user',
      content: userText,
      timestamp: Date.now()
    });

    // Load full conversation history for this world
    const historyRecords = await WorldRepository.getChatMessages(worldId);
    const apiMessages: any[] = [
      { role: 'system', content: settings.systemPrompt }
    ];

    for (const record of historyRecords) {
      if (record.role === 'tool') {
        apiMessages.push({
          role: 'tool',
          tool_call_id: record.tool_call_id,
          name: record.name,
          content: record.content
        });
      } else if (record.role === 'assistant' && record.tool_calls) {
        apiMessages.push({
          role: 'assistant',
          content: record.content || '',
          tool_calls: record.tool_calls
        });
      } else {
        apiMessages.push({
          role: record.role,
          content: record.content
        });
      }
    }

    try {
      let finalContent = '';
      let capturedSnapshot: string | undefined = undefined;

      let loopCount = 0;
      const maxLoops = 50;

      const endpointUrl = isGoogle
        ? `https://generativelanguage.googleapis.com/v1beta/chat/completions`
        : `https://openrouter.ai/api/v1/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };

      if (!isGoogle) {
        headers['HTTP-Referer'] = window.location.href;
        headers['X-Title'] = 'Crom Planebox 3D';
      }

      while (loopCount < maxLoops) {
        loopCount++;

        const targetModel = settings.model || (isGoogle ? 'gemini-2.5-flash' : 'anthropic/claude-3.5-sonnet');
        console.log(`🚀 [OpenRouterClient] (${providerName} - Loop ${loopCount}/${maxLoops}) Enviando requisição para ${endpointUrl} (Modelo: ${targetModel}, ${apiMessages.length} mensagens no histórico)`);

        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: targetModel,
            messages: apiMessages,
            tools: MCP_TOOLS,
            tool_choice: 'auto',
            temperature: 0.7
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`❌ [OpenRouterClient] Erro HTTP ${response.status} de ${providerName}:`, errText);
          throw new Error(`${providerName} HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        console.log(`📥 [OpenRouterClient] Resposta recebida de ${providerName}:`, data);
        const choice = data.choices?.[0];

        if (!choice) {
          throw new Error(`Nenhuma resposta retornada do provedor ${providerName}.`);
        }

        const message = choice.message;

        if (message.content) {
          finalContent += message.content;
          if (onPartialText) onPartialText(finalContent);
        }

        // If LLM returned tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          apiMessages.push(message);

          // Save assistant message with tool calls to IndexedDB
          await WorldRepository.addChatMessage({
            worldId,
            role: 'assistant',
            content: message.content || '',
            tool_calls: message.tool_calls,
            timestamp: Date.now()
          });

          for (const toolCall of message.tool_calls) {
            const toolName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments || '{}');

            if (onPartialText) {
              onPartialText(finalContent + `\n*[Executando ferramenta MCP: ${toolName}...]*`);
            }

            const { result, snapshotImage } = await this.executors.executeTool(toolName, args);

            if (snapshotImage) {
              capturedSnapshot = snapshotImage;
              // Feedback visual multimodal para a IA enxergar a foto da construção
              apiMessages.push({
                role: 'user',
                content: [
                  { type: 'text', text: `[SNAPSHOT VISUAL DA SUA CONSTRUÇÃO 3D NO MUNDO - ANALISE A FOTO ABAIXO]` },
                  { type: 'image_url', image_url: { url: snapshotImage } }
                ]
              });
              console.log(`📸 [OpenRouterClient] Foto da construção injetada nas mensagens para validação da IA!`);
            }

            const resultContent = typeof result === 'string' ? result : JSON.stringify(result);

            const toolResultMsg = {
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: resultContent
            };

            apiMessages.push(toolResultMsg);

            await WorldRepository.addChatMessage({
              worldId,
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: resultContent,
              timestamp: Date.now(),
              imageUrl: snapshotImage
            });
          }
        } else {
          // Se a IA respondeu apenas com texto perguntando algo durante um comando de criação e ainda está nos primeiros loops, força a continuar
          const asksToContinue = /próxima ideia|o que você quer|vamos começar|me diga|qual estilo/i.test(message.content || '');
          if (asksToContinue && loopCount < 5) {
            console.log(`🔄 [OpenRouterClient] IA tentou parar com pergunta no Loop ${loopCount}. Re-solicitando execução de ferramentas de construção...`);
            apiMessages.push({ role: 'assistant', content: message.content });
            apiMessages.push({
              role: 'user',
              content: 'Continue a construção imediatamente executando a próxima etapa com execute_voxel_script, flattenArea ou createEntity! Não pare para fazer perguntas até concluir todas as estruturas.'
            });
            continue;
          }

          // No more tool calls, save final assistant text message
          await WorldRepository.addChatMessage({
            worldId,
            role: 'assistant',
            content: finalContent,
            timestamp: Date.now(),
            imageUrl: capturedSnapshot
          });
          break;
        }
      }

      return {
        content: finalContent,
        snapshotImageUrl: capturedSnapshot
      };

    } catch (err: any) {
      console.error(`${providerName} Client Error:`, err);
      const errorMessage = `❌ Erro ao comunicar com ${providerName}: ${err.message || err}`;
      await WorldRepository.addChatMessage({
        worldId,
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now()
      });
      return {
        content: errorMessage,
        error: err.message
      };
    }
  }
}
