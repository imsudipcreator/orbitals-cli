import { Prisma } from "@prisma/client";
import prisma from "../lib/db.js";

export class ChatService {
  /**
   * Creates a new conversation in the database.
   * @param {string} userId - The userId of the user creating the conversation.
   * @param {string} [mode="chat"] - The mode of the conversation. Defaults to "chat".
   * @param {string} [title=null] - The title of the conversation. Defaults to "New ${mode} conversation"
   * @returns {Promise<Prisma.ConversationCreateOutput>} - The newly created conversation.
   */
  async createConversation(userId, mode = "chat", title = null) {
    return prisma.conversation.create({
      data: {
        userId,
        mode,
        title: title || `New ${mode} conversation`,
      },
    });
  }

  /**
   * Gets a conversation by its id, or creates a new one if it doesn't exist.
   * @param {string} userId - The userId of the user creating the conversation.
   * @param {string} [conversationId=null] - The id of the conversation to get. If null, a new conversation is created.
   * @param {string} [mode="chat"] - The mode of the conversation. Defaults to "chat".
   * @returns {Promise<Prisma.ConversationCreateOutput>} - The conversation.
   */
  async getOrCreateConversation(userId, conversationId = null, mode = "chat") {
    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (conversation) return conversation;
    }

    return await this.createConversation(userId, mode);
  }

  /**
   * Adds a message to a conversation.
   * @param {string} conversationId - The id of the conversation to add the message to.
   * @param {string} role - The role of the user sending the message.
   * @param {string|Object} content - The content of the message. If a string, it is added as is. If an object, it is stringified with JSON.stringify.
   * @returns {Promise<Prisma.MessageCreateOutput>} - The created message.
   */
  async addMessage(conversationId, role, content) {
    const contentStr =
      typeof content === "string" ? content : JSON.stringify(content);

    return await prisma.message.create({
      data: {
        conversationId,
        role,
        content: contentStr,
      },
    });
  }

  /**
   * Gets all the messages in a conversation in ascending order by createdAt.
   * @param {string} conversationId - The id of the conversation to get the messages from.
   * @returns {Promise<Array<{id: string, conversationId: string, userId: string, role: string, content: string, createdAt: Date, updatedAt: Date}>>} - The messages in the conversation.
   */
  async getMessages(conversationId) {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    return messages.map((msg) => ({
      ...msg,
      content: this.parseContent(msg.content),
    }));
  }

  /**
   * Get all conversations for a user
   * @param {string} userId - User ID
   */
  async getUserConversations(userId) {
    return await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  /**
   * Delete a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (for security)
   */
  async deleteConversation(conversationId, userId) {
    return await prisma.conversation.deleteMany({
      where: {
        id: conversationId,
        userId,
      },
    });
  }

  /**
   * Update conversation title
   * @param {string} conversationId - Conversation ID
   * @param {string} title - New title
   */
  async updateTitle(conversationId, title) {
    return await prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  /**
   * Helper to parse content (JSON or string)
   */
  parseContent(content) {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }

  /**
   * Format messages for AI SDK
   * @param {Array} messages - Database messages
   */
  formatMessagesForAI(messages) {
    return messages.map((msg) => ({
      role: msg.role,
      content:
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content),
    }));
  }
}
