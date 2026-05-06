import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const defaultLogFile = path.resolve(import.meta.dirname, "../../..", "logs/submission-intake.log");
const logFilePath = process.env.SUBMISSION_INTAKE_LOG_FILE
  ? path.resolve(process.env.SUBMISSION_INTAKE_LOG_FILE)
  : defaultLogFile;

function writeLog(line: string) {
  console.error(line);
  try {
    mkdirSync(path.dirname(logFilePath), { recursive: true });
    appendFileSync(logFilePath, `${line}\n`, "utf-8");
  } catch (error) {
    console.error(`[submission-intake:log] failed file=${logFilePath} message=${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export function getLogFilePath() {
  return logFilePath;
}

export function logConsole(scope: string, message: string, context: Record<string, unknown> = {}) {
  const details = Object.entries(context)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  writeLog(`[submission-intake:${scope}] ${message}${details ? ` ${details}` : ""}`);
}
