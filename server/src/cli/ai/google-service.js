import chalk from "chalk";
import { generateObject, streamText } from "ai";
import { google } from "@ai-sdk/google";
import { config } from "../../config/google.config.js";

export class AiService {
  constructor() {
    if (!config.googleApiKey) {
      throw new Error("GOOGLE_API_KEY is not set in env.");
    }

    this.model = google(config.model, {
      apiKey: config.googleApiKey,
    });
  }

  /**
   * Send a message and get streaming response
   * @param {Array} messages
   * @param {Function} onChunk
   * @param {Object} tools
   * @param {Function} onToolCall
   * @returns {Promise<Object>}
   */

  async sendMessage(messages, onChunk, tools = undefined, onToolCall = null) {
    try {
      const streamConfig = {
        model: this.model,
        messages: messages,
      };

      if (tools && Object.keys(tools).length > 0) {
        streamConfig.tools = tools;
        streamConfig.maxSteps = 5;

        console.log(
          chalk.gray(`[DEBUG TOOLS ENABLED]: ${Object.keys(tools).join(", ")}`)
        );
      }

      const result = streamText(streamConfig);
      let fullResponse = "";

      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      const fullResult = result;

      const toolCalls = [];
      const toolResults = [];

      // Collect tool calls from all steps (if they exist)
      if (fullResult.steps && Array.isArray(fullResult.steps)) {
        for (const step of fullResult.steps) {
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const toolCall of step.toolCalls) {
              toolCalls.push(toolCall);
              if (onToolCall) {
                onToolCall(toolCall);
              }
            }
          }

          // Collect tool results
          if (step.toolResults && step.toolResults.length > 0) {
            toolResults.push(...step.toolResults);
          }
        }
      }

      return {
        content: fullResponse,
        finishResponse: fullResult.finishReason,
        usage: fullResult.usage,
      };
    } catch (error) {
      console.error(chalk.red("AI Service Error: " + error.message));
      throw error;
    }
  }

  /**
   * Sends a message to the AI and returns the full response
   * @param {Array} messages - The messages to be sent to the AI
   * @param {Object} [tools] - The tools to be passed to the AI
   * @returns {Promise<string>} - The full response from the AI
   */
  async getMessage(messages, tools = undefined) {
    let fullResponse = "";
    const result = await this.sendMessage(
      messages,
      (chunk) => {
        fullResponse += chunk;
      },
      tools
    );

    return result.content;
  }

  /**
   * Generate structured output using a Zod schema
   * @param {Object} schema - Zod schema
   * @param {string} prompt - Prompt for generation
   * @returns {Promise<Object>} Parsed object matching the schema
   */
  async generateStructured(schema, prompt) {
    try {
      const result = await generateObject({
        model: this.model,
        schema: schema,
        prompt: prompt,
      });

      return result.object;
    } catch (error) {
      console.error(
        chalk.red("AI Structured Generation Error:"),
        error.message
      );
      throw error;
    }
  }
}
