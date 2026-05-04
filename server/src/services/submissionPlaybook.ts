import fs from "node:fs/promises";
import path from "node:path";

export type SubmissionPlaybook = {
  markdown: string;
  classificationIndicators: string[];
  labels: Record<string, string[]>;
  defaults: Record<string, string>;
  coversRequested: string[];
  missingFields: string[];
  warnings: string[];
};

const playbookPath = path.resolve(import.meta.dirname, "../../playbooks/submission-intake.md");
let playbookCache: Promise<SubmissionPlaybook> | undefined;

function section(markdown: string, heading: string): string {
  const headingLine = `## ${heading}`;
  const lines = markdown.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === headingLine);
  if (startIndex === -1) return "";

  const endIndex = lines.findIndex((line, index) => index > startIndex && line.startsWith("## "));
  return lines.slice(startIndex + 1, endIndex === -1 ? undefined : endIndex).join("\n").trim();
}

function listItems(markdown: string, heading: string): string[] {
  return section(markdown, heading)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function keyValueItems(markdown: string, heading: string): Record<string, string> {
  return Object.fromEntries(
    listItems(markdown, heading).flatMap((item) => {
      const separatorIndex = item.indexOf(":");
      if (separatorIndex === -1) return [];
      const key = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();
      return key && value ? [[key, value]] : [];
    }),
  );
}

export async function getSubmissionPlaybook(): Promise<SubmissionPlaybook> {
  playbookCache ??= fs.readFile(playbookPath, "utf-8").then((markdown) => {
    const labelItems = keyValueItems(markdown, "Extraction Labels");
    const labels = Object.fromEntries(
      Object.entries(labelItems).map(([field, value]) => [
        field,
        value.split("|").map((label) => label.trim()).filter(Boolean),
      ]),
    );

    return {
      markdown,
      classificationIndicators: listItems(markdown, "Classification Indicators"),
      labels,
      defaults: keyValueItems(markdown, "Defaults"),
      coversRequested: listItems(markdown, "Covers Requested"),
      missingFields: listItems(markdown, "Missing Fields"),
      warnings: listItems(markdown, "Warnings"),
    };
  });

  return playbookCache;
}
