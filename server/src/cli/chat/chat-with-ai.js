import chalk from "chalk";
import { getStoredToken } from "../../lib/token.js";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { AiService } from "../ai/google-service.js";
import { ChatService } from "../../services/chat-service.js";
import { text, isCancel, cancel, intro, outro } from "@clack/prompts";
import boxen from "boxen";
import yoctoSpinner from "yocto-spinner";
import prisma from "../../lib/db.js";

// Configure marked to use terminal renderer
marked.use(
  markedTerminal({
    // Styling options for terminal output
    code: chalk.cyan,
    blockquote: chalk.gray.italic,
    heading: chalk.green.bold,
    firstHeading: chalk.magenta.underline.bold,
    hr: chalk.reset,
    listitem: chalk.reset,
    list: chalk.reset,
    paragraph: chalk.reset,
    strong: chalk.bold,
    em: chalk.italic,
    codespan: chalk.yellow.bgBlack,
    del: chalk.dim.gray.strikethrough,
    link: chalk.blue.underline,
    href: chalk.blue.underline,
  })
);

const aiService = new AiService();
const chatService = new ChatService();

/**
 * Retrieves the user associated with the stored authentication token.
 * If the token is invalid or the user is not found, an error is thrown.
 * @returns {Promise<User>} - The user associated with the stored authentication token.
 * @throws {Error} - If the token is invalid or the user is not found.
 */
async function getUserFromToken() {
  const token = await getStoredToken();

  if (!token?.access_token) {
    throw new Error("Not authenticated. Please run 'orbital login' first.");
  }

  const spinner = yoctoSpinner({ text: "Authenticating..." }).start();

  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: { token: token.access_token },
      },
    },
  });

  if (!user) {
    spinner.error("User not found");
    throw new Error("User not found. Please login again.");
  }

  spinner.success(`Welcome back, ${user.name}!`);
  return user;
}

/**
 * Initializes a chat conversation with the given user ID, conversation ID, and mode.
 * If a conversation ID is provided, it will be used to get the conversation.
 * If no conversation ID is provided, a new conversation will be created.
 * The function will display the conversation info in a box, and if there are any
 * existing messages in the conversation, it will display them.
 * @param {string} userId - The user ID to initialize the conversation with.
 * @param {string} [conversationId=null] - The ID of the conversation to get. If null, a new conversation is created.
 * @param {string} [mode="chat"] - The mode of the conversation. Defaults to "chat".
 * @returns {Promise<Object>} - The conversation object from the database.
 */
async function initConversation(userId, conversationId = null, mode = "chat") {
  const spinner = yoctoSpinner({ text: "Loading conversation..." }).start();

  const conversation = await chatService.getOrCreateConversation(
    userId,
    conversationId,
    mode
  );

  spinner.success("Conversation loaded");

  // Display conversation info in a box
  const conversationInfo = boxen(
    `${chalk.bold("Conversation")}: ${conversation.title}\n${chalk.gray(
      "ID: " + conversation.id
    )}\n${chalk.gray("Mode: " + conversation.mode)}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "cyan",
      title: "💬 Chat Session",
      titleAlignment: "center",
    }
  );

  console.log(conversationInfo);

  // Display existing messages if any
  if (conversation.messages?.length > 0) {
    console.log(chalk.yellow("📜 Previous messages:\n"));
    displayMessages(conversation.messages);
  }

  return conversation;
}

/**
 * Displays a list of messages in a conversation, with
 * user messages displayed in a blue box and assistant
 * messages displayed in a green box.
 * @param {Array<Object>} messages - The messages to display.
 * @returns {void}
 */
function displayMessages(messages) {
  messages.forEach((msg) => {
    if (msg.role === "user") {
      const userBox = boxen(chalk.white(msg.content), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderStyle: "round",
        borderColor: "blue",
        title: "👤 You",
        titleAlignment: "left",
      });
      console.log(userBox);
    } else {
      // Render markdown for assistant messages
      const renderedContent = marked.parse(msg.content);
      const assistantBox = boxen(renderedContent.trim(), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderStyle: "round",
        borderColor: "green",
        title: "🤖 Assistant",
        titleAlignment: "left",
      });
      console.log(assistantBox);
    }
  });
}

async function saveMessage(conversationId, role, content) {
  return await chatService.addMessage(conversationId, role, content);
}

/**
 * Updates the title of a conversation if the user has only sent one message.
 * @param {string} conversationId - The ID of the conversation to update.
 * @param {string} userInput - The text entered by the user.
 * @param {number} messageCount - The number of messages sent by the user in the conversation.
 * @returns {Promise<void>} - A promise that resolves when the conversation title has been updated.
 */
async function updateConversationTitle(
  conversationId,
  userInput,
  messageCount
) {
  if (messageCount === 1) {
    const title = userInput.slice(0, 50) + (userInput.length > 50 ? "..." : "");
    await chatService.updateTitle(conversationId, title);
  }
}

/**
 * Sends user messages to the AI service and displays the response.
 * @param {string} conversationId - The ID of the conversation to get messages from.
 * @returns {Promise<string>} - The markdown response from the AI service.
 */

async function getAIResponse(conversationId) {
  const spinner = yoctoSpinner({
    text: "AI is thinking...",
    color: "cyan",
  }).start();

  const dbMessages = await chatService.getMessages(conversationId);
  const aiMessages = chatService.formatMessagesForAI(dbMessages);

  let fullResponse = "";
  let isFirstChunk = true;

  try {
    const result = await aiService.sendMessage(aiMessages, (chunk) => {
      // Stop spinner on first chunk and show header
      if (isFirstChunk) {
        spinner.stop();
        console.log("\n");
        const header = chalk.green.bold("🤖 Assistant:");
        console.log(header);
        console.log(chalk.gray("─".repeat(60)));
        isFirstChunk = false;
      }
      fullResponse += chunk;
    });

    // Now render the complete markdown response
    console.log("\n");
    const renderedMarkdown = marked.parse(fullResponse);
    console.log(renderedMarkdown);
    console.log(chalk.gray("─".repeat(60)));
    console.log("\n");

    return result.content;
  } catch (error) {
    spinner.error("Failed to get AI response");
    throw error;
  }
}

/**
 * Enters a chat loop with the user, displaying help information and handling user input.
 * The chat loop will continue until the user types "exit" or presses Ctrl+C to cancel.
 * During the loop, the user's input is saved to the database and an AI response is
 * generated using the AI service. The AI response is then saved to the database.
 * After the first exchange, the conversation title is updated if the user has only sent one
 * message.
 * @param {Object} conversation - The conversation object from the database.
 * @returns {Promise<void>} - A promise that resolves when the chat loop has ended.
 */
async function chatLoop(conversation) {
  const helpBox = boxen(
    `${chalk.gray("• Type your message and press Enter")}\n${chalk.gray(
      "• Markdown formatting is supported in responses"
    )}\n${chalk.gray('• Type "exit" to end conversation')}\n${chalk.gray(
      "• Press Ctrl+C to quit anytime"
    )}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderStyle: "round",
      borderColor: "gray",
      dimBorder: true,
    }
  );

  console.log(helpBox);

  while (true) {
    const userInput = await text({
      message: chalk.blue("💬 Your message"),
      placeholder: "Type your message...",
      validate(value) {
        if (!value || value.trim().length === 0) {
          return "Message cannot be empty";
        }
      },
    });

    // Handle cancellation (Ctrl+C)
    if (isCancel(userInput)) {
      const exitBox = boxen(chalk.yellow("Chat session ended. Goodbye! 👋"), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "yellow",
      });
      console.log(exitBox);
      process.exit(0);
    }

    // Handle exit command
    if (userInput.toLowerCase() === "exit") {
      const exitBox = boxen(chalk.yellow("Chat session ended. Goodbye! 👋"), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "yellow",
      });
      console.log(exitBox);
      break;
    }

    // Save user message
    await saveMessage(conversation.id, "user", userInput);

    // Get messages count before AI response
    const messages = await chatService.getMessages(conversation.id);

    // Get AI response with streaming and markdown rendering
    const aiResponse = await getAIResponse(conversation.id);

    // Save AI response
    await saveMessage(conversation.id, "assistant", aiResponse);

    // Update title if first exchange
    await updateConversationTitle(conversation.id, userInput, messages.length);
  }
}

/**
 * Starts a chat session with the Orbital AI service.
 * @param {string} [mode="chat"] - The mode of the chat session. Defaults to "chat".
 * @param {string} [conversationId=null] - The ID of the conversation to start. If null, a new conversation is created.
 * @throws {Error} - If there is an error starting the chat session.
 */
export async function startChat(mode = "chat", conversationId = null) {
  try {
    intro(
      boxen(chalk.bold.cyan("Orbital AI Chat"), {
        padding: 1,
        borderStyle: "double",
        borderColor: "cyan",
      })
    );

    const user = await getUserFromToken();
    const conversation = await initConversation(user.id, conversationId, mode);
    await chatLoop(conversation);

    // Display outro
    outro(chalk.green("✨ Thanks for chatting!"));
  } catch (error) {
    const errorBox = boxen(chalk.red(`❌ Error: ${error.message}`), {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "red",
    });
    console.log(errorBox);
    process.exit(1);
  }
}
