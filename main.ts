import {
	App,
	Editor,
	FileSystemAdapter,
	MarkdownView,
	Modal,
	normalizePath,
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
				reject(err);
			});
		});
	}

	async callResnapRs() {
		if (this.app.vault.adapter instanceof FileSystemAdapter) {
			const basepath = this.app.vault.adapter.getBasePath();
			console.log(basepath);
			let { stderr, stdout } = await this.runProcess("resnap-rs", [
				"--ip-address",
				this.settings.reMarkableIP,
				"--directory",
				`${basepath}/${this.settings.imagesDir || ""}`,
			]);
			console.log("ran resnap-rs");
			console.log(stdout);
			console.log(stderr);
			return;
		}
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
				await this.callResnapRs();
				new Notice("Took screenshot");
			},
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Screenshot");

		// This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: "open-sample-modal-simple",
		// 	name: "Open sample modal (simple)",
		// 	callback: () => {
		// 		new SampleModal(this.app).open();
		// 	},
		// });

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "insert-remarkable-screenshot",
			name: "Insert Remarkable Screeenshot",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				console.log(await this.callResnapRs());
				console.log(editor.getSelection());
				editor.replaceSelection("Took Screenshot");
			},
		});

		// // This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: "open-sample-modal-complex",
		// 	name: "Open sample modal (complex)",
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView =
		// 			this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}
		//
		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 	},
		// });

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000),
		);
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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
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
