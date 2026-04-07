import fs from "node:fs";
import path from "node:path";

import type { Page } from "playwright";

import type { DebugState } from "../shared/types";
import type { DebugConfig } from "./debug-config";
import { buildArtifactFileName } from "./debug-artifacts";

export class DebugRuntime {
  public readonly artifactsDirectory: string;
  public readonly logFilePath: string;

  constructor(public readonly config: DebugConfig, baseDir: string) {
    this.artifactsDirectory = path.join(baseDir, "debug-artifacts");
    this.logFilePath = path.join(this.artifactsDirectory, "monitor.log");

    if (config.enabled) {
      fs.mkdirSync(this.artifactsDirectory, { recursive: true });
    }
  }

  getState(): DebugState {
    return {
      ...this.config,
      artifactsDirectory: this.artifactsDirectory,
      logFilePath: this.logFilePath
    };
  }

  info(scope: string, message: string, data?: unknown): void {
    this.write("INFO", scope, message, data, false);
  }

  warn(scope: string, message: string, data?: unknown): void {
    this.write("WARN", scope, message, data, false);
  }

  error(scope: string, message: string, data?: unknown): void {
    this.write("ERROR", scope, message, data, false);
  }

  debug(scope: string, message: string, data?: unknown): void {
    this.write("DEBUG", scope, message, data, true);
  }

  async capturePage(page: Page, label: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.config.enabled || !this.config.persistHtmlSnapshots) {
      return;
    }

    const timestamp = new Date().toISOString();
    const fileStem = buildArtifactFileName({ label, timestamp, extension: "html" }).replace(/\.html$/, "");
    const htmlPath = path.join(this.artifactsDirectory, `${fileStem}.html`);
    const jsonPath = path.join(this.artifactsDirectory, `${fileStem}.json`);
    const textPath = path.join(this.artifactsDirectory, `${fileStem}.txt`);

    const [html, bodyText, title] = await Promise.all([
      page.content(),
      page.textContent("body").catch(() => ""),
      page.title().catch(() => "")
    ]);

    fs.writeFileSync(htmlPath, html, "utf8");
    fs.writeFileSync(textPath, bodyText ?? "", "utf8");
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          timestamp,
          url: page.url(),
          title,
          metadata: metadata ?? {}
        },
        null,
        2
      ),
      "utf8"
    );

    this.debug("snapshot", `Saved page artifact: ${path.basename(htmlPath)}`);
  }

  private write(level: string, scope: string, message: string, data: unknown, verboseOnly: boolean): void {
    if (!this.config.enabled) {
      return;
    }

    if (verboseOnly && !this.config.verboseLogging) {
      return;
    }

    const timestamp = new Date().toISOString();
    const line = JSON.stringify({ timestamp, level, scope, message, data: data ?? null });
    fs.mkdirSync(this.artifactsDirectory, { recursive: true });
    fs.appendFileSync(this.logFilePath, `${line}\n`, "utf8");

    if (level === "ERROR") {
      console.error(`[${scope}] ${message}`, data ?? "");
      return;
    }

    if (level === "WARN") {
      console.warn(`[${scope}] ${message}`, data ?? "");
      return;
    }

    console.log(`[${scope}] ${message}`, data ?? "");
  }
}
