#!/usr/bin/env node
import { execSync } from "child_process";
import inquirer from "inquirer";
import { readdirSync, renameSync, rmSync, existsSync } from "fs";
import { join } from "path";
const ORG_NAME = "Blue-Kelpie";
function run(cmd, opts = {}) {
    return execSync(cmd, { stdio: "inherit", ...opts });
}
function runAndGet(cmd) {
    return execSync(cmd, { encoding: "utf8" }).trim();
}
async function main() {
    const cwd = process.cwd();
    console.log("\n 🌉 The bridge between local WordPress and your organisation's Git \n");
    console.log("\n ⚠️ Warning: If you select a template or existing repository to clone, its contents will override any existing files and folders with matching names. For example, cloning a template/existing repository that contains a 'plugins' folder will completely replace the existing 'plugins' folder in this site's wp-content. \n");
    const { projectType } = await inquirer.prompt([
        {
            type: "list",
            name: "projectType",
            message: "What are you working on?",
            choices: [
                {
                    name: "New project",
                    value: "new",
                    description: "I'm starting a new project that doesn't exist yet in our organisation's Git repository."
                },
                {
                    name: "Existing project",
                    value: "existing",
                    description: "I want to work on a project that already exists in our organisation's Git repository."
                },
            ]
        }
    ]);
    switch (projectType) {
        case 'new':
            prepareNewRepo();
            break;
        case 'existing':
            prepareExistingRepo();
            break;
    }
    async function prepareNewRepo() {
        const repoName = await promptNewRepoName();
        const useTemplate = await promptUseTemplate();
        if (!useTemplate) {
            createRepo(repoName);
            cloneRepo(repoName);
            return;
        }
        const templateRepos = await fetchRepos(true);
        const selectedTemplateName = await promptSelectRepo(templateRepos);
        createRepo(repoName, selectedTemplateName);
        cloneRepo(repoName);
    }
    async function prepareExistingRepo() {
        const nonTemplateRepos = await fetchRepos();
        const selectedTemplateName = await promptSelectRepo(nonTemplateRepos);
        cloneRepo(selectedTemplateName);
    }
    async function promptNewRepoName() {
        const { repoName } = await inquirer.prompt([
            {
                type: "input",
                name: "repoName",
                message: "Enter the new repository name:",
                validate: input => input.trim().length > 0 || "Repository name cannot be empty",
            },
        ]);
        return repoName;
    }
    async function promptUseTemplate() {
        const { useTemplate } = await inquirer.prompt([
            {
                type: "list",
                name: "useTemplate",
                message: "Base this repository on a template?",
                choices: [
                    {
                        name: "Yes (recommended)",
                        value: true,
                        description: "Start with an existing scaffold."
                    },
                    {
                        name: "No",
                        value: false,
                        description: "Start from scratch."
                    },
                ]
            }
        ]);
        return useTemplate;
    }
    // Prompts the user to select from the provided array
    async function promptSelectRepo(repos) {
        const { selectedTemplateName } = await inquirer.prompt([
            {
                type: "list",
                name: "selectedTemplateName",
                message: "Select:",
                choices: repos.map(t => ({
                    name: `${t.name}${t.description ? ` — ${t.description}` : ""}`,
                    value: t.name,
                })),
            },
        ]);
        return selectedTemplateName;
    }
    // Get repositories from your organisation's Git
    async function fetchRepos(template = false) {
        console.log(`🔍 Fetching available ${template ? 'templates' : 'projects'}...\n`);
        const repositoriesRaw = runAndGet(`gh api orgs/${ORG_NAME}/repos --paginate --jq '.[] | select(.is_template==${template}) | {name: .name, description: .description}'`);
        if (!repositoriesRaw) {
            console.error("❌ No template repositories found in your organization.");
            process.exit(1);
        }
        const repositories = repositoriesRaw
            .split("\n")
            .filter(Boolean)
            .map(line => JSON.parse(line));
        return repositories;
    }
    function cloneRepo(repoName) {
        console.log("Cloning repo");
        // Create temorary folder to clone repo in
        const tmpDir = join(cwd, "__temporary__");
        run(`git clone git@github.com:${ORG_NAME}/${repoName}.git "${tmpDir}"`);
        // Move all files (including dotfiles)
        const tmpContents = readdirSync(tmpDir, { withFileTypes: true });
        for (const entry of tmpContents) {
            const src = join(tmpDir, entry.name);
            const dest = join(cwd, entry.name);
            if (existsSync(dest)) {
                console.log(`File or folder already exists. Overwriting: ${entry.name}`);
                rmSync(dest, { recursive: true, force: true });
            }
            renameSync(src, dest);
        }
        // Remove the now-empty temp folder
        rmSync(tmpDir, { recursive: true, force: true });
    }
    // Create repo in organisation with provided options
    function createRepo(name, templateName = null) {
        if (templateName) {
            console.log(`\n🏗️  Creating ${ORG_NAME}/${name} from ${templateName}...`);
            run(`gh repo create ${ORG_NAME}/${name} --template ${ORG_NAME}/${templateName} --private`);
            return;
        }
        console.log(`\n🏗️  Creating ${ORG_NAME}/${name} from blank slate...`);
        run(`gh repo create ${ORG_NAME}/${name} --private`);
    }
}
main().catch(err => {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
});
//# sourceMappingURL=script.js.map