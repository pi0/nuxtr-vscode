import * as vscode from 'vscode'
import {
    getNonce,
    getUri,
    getProjectDependencies,
    projectRootDirectory,
    openExternalLink,
    getProjectScripts,
    newTerminal,
    detectPackageManagerByName,
    addNuxtModule,
    removeNuxtModule,
    getInstallationCommand,
    getOutdatedPackages,
    runCommand,
    managePackageVersion,
    removePackage,
} from '../utils'
import * as fs from 'fs'
import { exec } from 'child_process'
import { destr } from "destr"


const nonce = getNonce()
export class ModulesView implements vscode.WebviewViewProvider {
    _view?: vscode.WebviewView

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        }

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)
        this._setWebviewMessageListener(webviewView.webview)

        // in case the user reload the window while opening the extension tab
        if (webviewView.visible) {
            this.goToProjectView()
        }

        webviewView.onDidChangeVisibility((e) => {
            if (webviewView.visible) {
                this.goToProjectView()
            }
        })
    }

    public goToProjectView() {
        this.postMessage({ command: 'projectView' })
        this.getDependencies()
    }

    public async getDependencies() {
        const dependencies = await getProjectDependencies()
        const scripts = getProjectScripts()

        const vscodeVersion = vscode.version
        const extension_version = fs.existsSync(`${this._extensionUri.fsPath}/package.json`)
            ? JSON.parse(fs.readFileSync(`${this._extensionUri.fsPath}/package.json`, 'utf8')).version
            : 'undefined'
        const feedbackContent = {
            vscode_version: vscodeVersion,
            extension_version: extension_version,
            vscode_theme_id: vscode.workspace.getConfiguration().get('workbench.colorTheme'),
        }

        // regex find list of snippets inside .vscode folder
        const snippets = fs.existsSync(`${projectRootDirectory()}/.vscode`)
            ? fs
                .readdirSync(`${projectRootDirectory()}/.vscode`)
                .filter((file) => file.match(/.*\.code-snippets/))
            : []

        // regex find list of file templates inside .vscode folder
        const fileTemplates = fs.existsSync(`${projectRootDirectory()}/.vscode`)
            ? fs
                .readdirSync(`${projectRootDirectory()}/.vscode`)
                .filter((file) => file.match(/.*\.(page-template|layout-template)/))
            : []

        this.postMessage({
            command: 'projectViewData',
            data: {
                dependencies: dependencies,
                scripts: scripts,
                feedbackContent: feedbackContent,
                snippets: snippets,
                fileTemplates: fileTemplates
            },
        })

        await this.updateModules();

        let outdatedDependencies: any = await getOutdatedPackages()

        outdatedDependencies = destr(outdatedDependencies)

        if (outdatedDependencies) {
            outdatedDependencies = Object.keys(outdatedDependencies).map((key) => {
                return {
                    current: outdatedDependencies[key].current,
                    latest: outdatedDependencies[key].latest,
                    wanted: outdatedDependencies[key].wanted,
                    dependent: outdatedDependencies[key].dependent,
                    name: key,
                }
            })

            await vscode.commands.executeCommand('nuxtr.globalState', { update: true, name: 'outdatedDependencies', value: outdatedDependencies })

            this.postMessage({
                command: 'outdatedDependencies',
                data: outdatedDependencies,
            })
        }
    }

    public runAction(script: string) {
        const packageManager = detectPackageManagerByName()

        switch (packageManager?.name) {
            case 'Yarn':
                if (script.includes('build') || script.includes('generate')) {
                    runCommand({
                        command: `yarn ${script}`,
                        message: `Nuxtr: ${script}`,
                        successMessage: `Nuxtr: ${script} successfully`,
                        errorMessage: `Nuxtr: ${script} failed`,
                        logger: true
                    })
                } else {
                    newTerminal(`${script}`, `yarn ${script}`, `${projectRootDirectory()}`)
                }
                break
            case 'NPM':
                if (script.includes('build') || script.includes('generate')) {
                    runCommand({
                        command: `npm run ${script}`,
                        message: `Nuxtr: ${script}`,
                        successMessage: `Nuxtr: ${script} successfully`,
                        errorMessage: `Nuxtr: ${script} failed`,
                        logger: true
                    })
                } else {
                    newTerminal(`${script}`, `npm run ${script}`, `${projectRootDirectory()}`)
                }
                break
            case 'pnpm':
                if (script.includes('build') || script.includes('generate')) {
                    runCommand({
                        command: `pnpm ${script}`,
                        message: `Nuxtr: ${script}`,
                        successMessage: `Nuxtr: ${script} successfully`,
                        errorMessage: `Nuxtr: ${script} failed`,
                        logger: true
                    })
                } else {
                    newTerminal(`${script}`, `pnpm ${script}`, `${projectRootDirectory()}`)
                }
                break
            case 'Bun':
                if (script.includes('build') || script.includes('generate')) {
                    runCommand({
                        command: `bun --bun run ${script}`,
                        message: `Nuxtr: ${script}`,
                        successMessage: `Nuxtr: ${script} successfully`,
                        errorMessage: `Nuxtr: ${script} failed`,
                        logger: true
                    })
                } else {
                    newTerminal(`${script}`, `bun ${script}`, `${projectRootDirectory()}`)
                }
                break
            default:
                vscode.window.showErrorMessage('Nuxtr: No package manager found')
        }
    }

    public async updateModules() {
        const installedModules = await getProjectDependencies()
        this.postMessage({
            command: 'installedModules',
            data: installedModules,
        })
    }

    public postMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message)
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const stylesUri = getUri(webview, this._extensionUri, ['ui', 'build', 'assets', 'index.css'])
        // The JS file from the Vue build output
        const scriptUri = getUri(webview, this._extensionUri, ['ui', 'build', 'assets', 'index.js'])

        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src https://fonts.gstatic.com/ https://fonts.googleapis.com/ https://raw.githubusercontent.com/ https://ozgtbqizepstargxfqcm.supabase.co/  img-src https: data: style-src 'unsafe-inline' ${webview.cspSource} script-src 'nonce-${nonce}'">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Nuxtr UI</title>
        </head>
        <body>
          <div id="app"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `
    }

    private async installModule(module: any) {
        const command = await getInstallationCommand(
            module.npm,
            module['dependency-type'] === 'dev' ? true : false
        )
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Installing ${module.npm}...`,
                cancellable: false,
            },
            async () => {
                return new Promise(async (resolve, reject) => {
                    const child = exec(
                        command,
                        { cwd: projectRootDirectory() },
                        (error: any, stdout: any, stderr: any) => {
                            if (error) {
                                reject(error.message)
                            } else if (stderr) {
                                reject(stderr)
                            } else {
                                resolve(stdout)
                            }
                        }
                    )

                    child.on('exit', async (code) => {
                        if (code === 0) {
                            this.addNuxtModule(module)
                        } else {
                            vscode.window.showErrorMessage(
                                `${module.npm} is installed but we got an error in configuration, please make sure all modules are configured`
                            )
                            this.postMessage({
                                command: 'moduleInstalled',
                                installed: false,
                                cmd: module.npm,
                            })
                        }
                    })
                })
            }
        )
    }

    private async addNuxtModule(module: any) {
        await addNuxtModule(module)
            .then(async () => {
                this.postMessage({
                    command: 'moduleInstalled',
                    installed: true,
                    cmd: module.npm,
                })
                await vscode.window
                    .showInformationMessage(
                        `${module.npm} is installed successfully and added to Nuxt config`,
                        'Open documentation'
                    )
                    .then(async (value) => {
                        if (value === 'Open documentation') {
                            openExternalLink(module.website)
                        }
                    })
            })
            .catch(() => {
                this.postMessage({
                    command: 'moduleInstalled',
                    installed: false,
                    cmd: module.npm,
                })
            })
    }

    public async upgradeModule(module: any) {
        await managePackageVersion(module)
    }

    public async removeModule(module: any) {
        // show confirmation message
        const confirmation = await vscode.window.showInformationMessage(
            `Are you sure you want to remove ${module}?`,
            'Yes',
            'No'
        )
        if (confirmation === 'Yes') {
            await removeNuxtModule(module)
            await removePackage(module)
        }
    }
    public editSnippet(snippet: string) {
        const snippetPath = `${projectRootDirectory()}/.vscode/${snippet}`
        if (fs.existsSync(snippetPath)) {
            vscode.window.showTextDocument(vscode.Uri.file(snippetPath))
        } else {
            vscode.window.showErrorMessage(`Snippet ${snippet} not found`)
        }
    }

    public editTemplate(snippet: string) {
        const snippetPath = `${projectRootDirectory()}/.vscode/${snippet}`
        if (fs.existsSync(snippetPath)) {
            vscode.window.showTextDocument(vscode.Uri.file(snippetPath))
        } else {
            vscode.window.showErrorMessage(`Snippet ${snippet} not found`)
        }
    }

    public async deleteTemplate(template: string) {
        //  create a confirmation message to delete the template
        const confirmation = await vscode.window.showInformationMessage(
            `Are you sure you want to delete ${template}?`,
            'Yes',
            'No'
        )
        if (confirmation === 'Yes') {
            const templatePath = `${projectRootDirectory()}/.vscode/${template}`
            if (fs.existsSync(templatePath)) {
                fs.unlinkSync(templatePath)
            } else {
                vscode.window.showErrorMessage(`Template ${template} not found`)
            }
        }

    }

    public async deleteSnippet(snippet: string) {
        //  create a confirmation message to delete the template
        const confirmation = await vscode.window.showInformationMessage(
            `Are you sure you want to delete ${snippet}?`,
            'Yes',
            'No'
        )
        if (confirmation === 'Yes') {
            const snippetPath = `${projectRootDirectory()}/.vscode/${snippet}`
            if (fs.existsSync(snippetPath)) {
                fs.unlinkSync(snippetPath)
            } else {
                vscode.window.showErrorMessage(`Snippet ${snippet} not found`)
            }
        }

    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(async (message: any) => {
            const { command, module, script } = message
            switch (command) {
                case 'installModule':
                    this.installModule(module)
                    break
                case 'runAction':
                    this.runAction(script)
                    break
                case 'upgradeModule':
                    this.upgradeModule(module)
                    break
                case 'removeModule':
                    this.removeModule(module)
                    break
                case 'editSnippet':
                    this.editSnippet(message.data)
                    break
                case 'deleteSnippet':
                    this.deleteSnippet(message.data)
                    break
                case 'configureNewSnippet':
                    vscode.commands.executeCommand('workbench.action.openSnippets')
                    break
                case 'editTemplate':
                    this.editTemplate(message.data)
                    break
                case 'deleteTemplate':
                    this.deleteTemplate(message.data)
                    break
                case 'createFileFromTemplate':
                    vscode.commands.executeCommand('nuxtr.createFileFromTemplate', message.data)
                    break
                case 'createEmptyFileTemplate':
                    vscode.commands.executeCommand('nuxtr.createEmptyFileTemplate')

                default:
                    break
            }
        })
    }
}
