import {
	App,
	Editor,
	FileSystemAdapter,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { spawn } from "child_process";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	reMarkableIP: string;
	imagesDir: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	reMarkableIP: process.env.REMARKABLE_IP || "10.11.99.1",
	imagesDir: "remarkable_screenshots",
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async runProcess(
		executable_path: string,
		args: string[],
	): Promise<Record<"stderr" | "stdout", string>> {
		let outputs: Record<"stderr" | "stdout", string> = {
			stderr: "",
			stdout: "",
		};
		return new Promise(function (resolve, reject) {
			const process = spawn(executable_path, args);
			process.stdout.on("data", (data: string) => {
				outputs.stdout += data;
			});
			process.stderr.on("data", (data: string) => {
				outputs.stderr += data;
			});

			process.on("close", async function (code: number) {
				if (code === 0) {
					resolve(outputs);
				} else {
					reject(
						"Nonzero exitcode.\nSTDERR: " +
							outputs.stderr +
							"\nSTDOUT: " +
							outputs.stdout,
					);
				}
			});
			process.on("error", function (err: string) {
				console.log("something wrong", err);
				reject(err);
			});
		});
	}

	async callResnapRs(): Promise<string> {
		if (this.app.vault.adapter instanceof FileSystemAdapter) {
			const basepath = this.app.vault.adapter.getBasePath();
			const args = [
				"--ip-address",
				this.settings.reMarkableIP,
				"--directory",
				`${basepath}/${this.settings.imagesDir || ""}`,
			];
			let { stdout } = await this.runProcess("resnap-rs", args);
			return stdout.replace("\n", "");
		}
		throw new Error("something went wrong with callResnapRs");
	}

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"tablet",
			"Remarkable 2.0 Screenshot",
			async (evt: MouseEvent) => {
				// Called when the user clicks the icon.
				// TODO: by default, screenshot. maybe open settings?
				let realPath = await this.callResnapRs();
				new Notice(`Took screenshot: ${realPath}`);
			},
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Screenshot");

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "insert-remarkable-screenshot",
			name: "Insert Remarkable Screeenshot",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const realPath = await this.callResnapRs();
				const filePath = realPath
					.split(`/${this.settings.imagesDir}/`)
					.pop();
				console.log(editor.getSelection());
				const reference = `/${this.settings.imagesDir}/${filePath}`;
				editor.replaceSelection(`![[${reference}]]`);
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", "Remarkable 2.0 Screenshot");

		new Setting(containerEl)
			.setName("Screenshot directory")
			.setDesc(
				"Specify a directory to put generated screenshots. Defaults to 'remarkable_screenshots'",
			)
			.addText((text) => {
				text.setPlaceholder("Enter screenshot directory")
					.setValue(this.plugin.settings.imagesDir)
					.onChange(async (value) => {
						this.plugin.settings.imagesDir = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Remarkable IP")
			.setDesc(
				"The IP Address of your Remarkable 2.0. Defaults to either REMARKABLE_IP env var or '10.11.99.1'.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter your Remarkable IP")
					.setValue(this.plugin.settings.reMarkableIP)
					.onChange(async (value) => {
						this.plugin.settings.reMarkableIP = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
