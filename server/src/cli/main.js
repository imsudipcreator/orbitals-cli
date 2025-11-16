#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import dotenv from "dotenv";
import figlet from "figlet";
import { login, logout, whoami } from "./commands/auth/login.js";

dotenv.config();

async function main() {
  console.log(
    chalk.cyan(
      figlet.textSync("Orbital CLI", {
        font: "Standard",
        horizontalLayout: "default",
      })
    )
  );

  console.log(chalk.gray("A CLI based AI Tool \n"));

  const program = new Command("orbital");
  program.version("0.0.1").description("A CLI based AI Tool");

  program.addCommand(login);
  program.addCommand(logout);
  program.addCommand(whoami);

  program.action(() => {
    program.help();
  });

  program.parse();
}

main().catch((err) => {
  console.log(chalk.red("Error: " + err.message));
  process.exit(1);
});
