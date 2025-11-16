import { cancel, outro, isCancel, intro, confirm, spinner } from "@clack/prompts";
import { logger } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/plugins";

import chalk from "chalk";
import fs from "fs/promises";
import open from "open";
import os from "os";
import path from "path";
import yoctoSpinner from "yocto-spinner";
import dotenv from "dotenv";
import prisma from "../../../lib/db.js";
import { Command } from "commander";
import * as z from "zod/v4";
import {
    clearStoredToken,
  getStoredToken,
  isTokenExpired,
  requireAuth,
  storeToken,
} from "../../../lib/token.js";

dotenv.config();

const URL = "http://localhost:3005";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
export const CONFIG_DIR = path.join(os.homedir(), ".orbital-cli");
export const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");

// ============================================
// LOGIN COMMAND
// ============================================

export async function loginAction(opts) {
  const options = z.object({
    serverUrl: z.string().optional(),
    clientId: z.string().optional(),
  });

  const serverUrl = options.serverUrl || URL;
  const clientId = options.clientId || CLIENT_ID;

  intro(chalk.bold("🔐 Auth CLI Login"));

  const existingToken = await getStoredToken();
  const expired = await isTokenExpired();

  if (existingToken && !expired) {
    const shouldReAuth = await confirm({
      message: "Do you want to re-authenticate?",
      initialValue: false,
    });

    if (isCancel(shouldReAuth) || !shouldReAuth) {
      cancel("Login cancelled");
      process.exit(0);
    }
  }

  const authClient = createAuthClient({
    baseURL: serverUrl,
    plugins: [deviceAuthorizationClient()],
  });

  const spinner = yoctoSpinner({ text: "Requesting device authorization..." });
  spinner.start();

  try {
    const { data, error } = await authClient.device.code({
      client_id: clientId,
      scope: "openid profile email",
    });

    spinner.stop();

    if (error || !data) {
      logger.error(
        `Failed to request device authorization: ${
          error.error_description || "Unknown error"
        }`
      );

      process.exit(1);
    }

    const {
      device_code,
      user_code,
      verification_uri,
      verification_uri_complete,
      expires_in,
      interval = 5,
    } = data;

    console.log(chalk.cyan("Device authorization required"));

    console.log(
      `Please visit ${chalk.underline.blue(
        verification_uri || verification_uri_complete
      )}`
    );
    console.log(`Enter code: ${chalk.bold.green(user_code)}`);

    const shouldOpen = await confirm({
      message: "Open in browser?",
      initialValue: true,
    });

    if (!isCancel(shouldOpen) && shouldOpen) {
      const urlToOpen = verification_uri_complete || verification_uri;
      await open(urlToOpen);
    }

    console.log(
      chalk.gray(
        `Waiting for authorization (expires in ${Math.floor(
          expires_in / 60
        )} minutes)...`
      )
    );

    const token = await pollForToken(authClient, device_code, clientId, interval);

    if (token) {
      const saved = await storeToken(token);

      if (!saved) {
        console.log(chalk.yellow("\nWarning: Could not save token to disk."));

        console.log(chalk.yellow("Run 'auth login' to re-authenticate."));
      }

      // Todo:

      outro(chalk.green("Login successful!"));
      console.log(chalk.gray(`\nToken saved to: ${TOKEN_FILE}`));
      console.log(
        chalk.gray("You can now use AI commands without logging in again.")
      );
    }
  } catch (error) {
    spinner.stop();
    console.error(chalk.red("Login failed"), error.message);
    process.exit(1);
  }
}

async function pollForToken(authClient, deviceCode, clientId, initialInterval) {
  let pollingInterval = initialInterval;
  const spinner = yoctoSpinner({
    text: "",
    color: "cyan",
  });

  let dots = 0;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      dots = (dots + 1) % 4;
      spinner.text = chalk.gray(
        `Polling for authorization${".".repeat(dots)}${" ".repeat(3 - dots)}`
      );
      if (!spinner.isSpinning) spinner.start();

      try {
        const { data, error } = await authClient.device.token({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
          client_id: clientId,
          fetchOptions: {
            headers: {
              "user-agent": `Better Auth CLI`,
            },
          },
        });

        if (data?.access_token) {
          console.log(
            chalk.bold.yellow(`Your access token: ${data.access_token}`)
          );
          spinner.stop();
          resolve(data);
          return;
        } else if (error) {
          switch (error.error) {
            case "authorization_pending":
              // Continue polling
              break;
            case "slow_down":
              pollingInterval += 5;
              break;
            case "access_denied":
              spinner.stop();
              logger.error("Access was denied by the user");
              process.exit(1);
            case "expired_token":
              spinner.stop();
              logger.error("The device code has expired. Please try again.");
              process.exit(1);
            default:
              spinner.stop();
              logger.error(`Error: ${error.error_description}`);
              process.exit(1);
          }
        }
      } catch (err) {
        spinner.stop();
        logger.error(`Network error: ${err.message}`);
        process.exit(1);
      }

      setTimeout(poll, pollingInterval * 1000);
    };

    setTimeout(poll, pollingInterval * 1000);
  });
}

// ============================================
// LOGOUT COMMAND
// ============================================

export async function logoutAction() {
  intro(chalk.bold("👋 Logout"));

  const token = await getStoredToken();

  if (!token) {
    console.log(chalk.yellow("You're not logged in."));
    process.exit(0);
  }

  const shouldLogout = await confirm({
    message: "Are you sure you want to logout?",
    initialValue: false,
  });

  if (isCancel(shouldLogout) || !shouldLogout) {
    cancel("Logout cancelled");
    process.exit(0);
  }

  const cleared = await clearStoredToken();

  if (cleared) {
    outro(chalk.green("✅ Successfully logged out!"));
  } else {
    console.log(chalk.yellow("⚠️  Could not clear token file."));
  }
}

// ============================================
// WHOAMI COMMAND
// ============================================

export async function whoamiAction(opts) {
  const token = await requireAuth();
  if (!token?.access_token) {
    console.log("No access token found. Please login.");
    process.exit(1);
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

  // Output user session info
  console.log(
    chalk.bold.greenBright(`\n👤 User: ${user.name}
📧 Email: ${user.email}
👤 ID: ${user.id}`)
  );
}

// ============================================
// COMMANDER SETUP
// ============================================

export const login = new Command("login")
  .description("Login to your account")
  .option("--server-url <url>", "The Better Auth server URL", URL)
  .option("--client-id <id>", "The OAuth client ID", CLIENT_ID)
  .action(loginAction);

export const logout = new Command("logout")
  .description("Logout and clear stored credentials")
  .action(logoutAction);

export const whoami = new Command("whoami")
  .description("Show current authenticated user")
  .option("--server-url <url>", "The Better Auth server URL", URL)
  .action(whoamiAction);
