import prisma from "../../../lib/db.js";
import { getStoredToken } from "../../../lib/token.js";
import chalk from "chalk";
import { select } from "@clack/prompts";
import yoctoSpinner from "yocto-spinner";
import { Command } from "commander";
import { startChat } from "../../chat/chat-with-ai.js";
import { startAgentChat } from "../../chat/chat-with-ai-agent.js";

const wakeUpAction = async () => {
  const token = await getStoredToken();

  if (!token?.access_token) {
    console.log(chalk.red("Not Authenticated. Please login."));
    return;
  }

  const spinner = yoctoSpinner({ text: "Getting user info..." });
  spinner.start();

  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: {
          token: token.access_token,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });

  spinner.stop();
  if (!user) {
    console.log(chalk.red("User not found. Please login."));
    return;
  }

  console.log(chalk.bold.green(`\n👤 User: ${user.name}`));

  const choice = await select({
    message: "Select an option:",
    options: [
      {
        value: "chat",
        label: "Chat",
        hint: "Simple chat with the AI",
      },
      {
        value: "tool",
        label: "Tool Calling",
        hint: "Chat with tools (Google search, Code execution)",
      },
      {
        value: "agent",
        label: "Agentic Mode",
        hint: "Advanced AI Agent",
      },
    ],
  });

  switch (choice) {
    case "chat":
      startChat("chat");
      break;
    case "tool":
      console.log(chalk.yellow("Tool Calling Mode Activated."));
      break;
    case "agent":
      startAgentChat();
      break;
  }
};

export const wakeUp = new Command("wakeup")
  .description("Wake up the AI")
  .action(wakeUpAction);
