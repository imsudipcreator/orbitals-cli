import chalk from "chalk";
import { streamText } from "ai";
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

      const result = streamText(streamConfig);
      let fullResponse = "";

      for await (const chunk of result.textStream()){
        fullResponse += chunk;
        if(onChunk) {
          onChunk(chunk);
        }
      }

      const fullResult = result;
      return {
        content: fullResponse,
        finishResponse: fullResult.finishReason,
        usage: fullResult.usage
      }
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
  async getMessage(messages, tools = undefined){
    let fullResponse = "";
    await this.sendMessage(messages, (chunk) => {
        fullResponse += chunk;
    });

    return fullResponse
  }
}
