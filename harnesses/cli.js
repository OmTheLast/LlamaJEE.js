#!/usr/bin/env node
// Uses a caller-supplied local adapter; no network provider or credentials are configured here.
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runHarness } from './controller.js';

const [mode, questionFile, adapterFile, outputFile] = process.argv.slice(2);
if (!mode || !questionFile || !adapterFile || !outputFile) {
  console.error('Usage: node harnesses/cli.js <direct|h0|h1|h2> <question.json> <generation-adapter.mjs> <output.json>');
  process.exitCode = 2;
} else {
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  const question = JSON.parse(await readFile(questionFile, 'utf8'));
  const { generate } = await import(pathToFileURL(resolve(adapterFile)).href);
  const output = resolve(outputFile); await mkdir(dirname(output), { recursive: true });
  const save = async (path, value) => {
    const temporary = path + '.tmp';
    await writeFile(temporary, JSON.stringify(value, null, 2) + '\n'); await rename(temporary, path);
  };
  // Serialized atomic progress writes preserve stage outputs if the process is interrupted.
  let writing = Promise.resolve(); const events = [];
  const result = await runHarness({ mode, question, generate, signal: controller.signal,
    onEvent: event => {
      events.push(event);
      if (event.type !== 'token' || events.length % 32 === 0) {
        const snapshot = structuredClone(events);
        writing = writing.then(() => save(output + '.progress.json', { status: 'running', events: snapshot }));
      }
    } });
  await writing;
  await save(output, result);
  await save(output + '.progress.json', { status: result.status, events });
  console.log(`${result.harnessId}: ${result.status}; ${result.stages.length} new calls. Saved ${output}`);
  if (result.status !== 'completed') process.exitCode = 1;
}
