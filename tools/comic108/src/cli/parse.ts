/**
 * data/raw/*.jsonl + data/manual.txt  ->  data/dataset.json
 *
 * 纯离线, 可反复重跑。调正则后重跑即可, 不需要重新采集。
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { paths } from '../../config';
import { parseManual } from '../collect/manual';
import { buildDataset } from '../parse/classify';
import { extractTweets } from '../parse/extract';
import type { NormalizedTweet, Overrides, RawCapture } from '../types';

async function readRawCaptures(): Promise<RawCapture[]> {
    if (!existsSync(paths.raw)) return [];

    const files = (await readdir(paths.raw)).filter((f) => f.endsWith('.jsonl'));
    const captures: RawCapture[] = [];

    for (const file of files) {
        const content = await readFile(join(paths.raw, file), 'utf8');
        for (const [i, line] of content.split('\n').entries()) {
            if (!line.trim()) continue;
            try {
                captures.push(JSON.parse(line) as RawCapture);
            } catch {
                console.warn(`  ${file}:${i + 1} 不是合法 JSON, 已跳过`);
            }
        }
    }
    return captures;
}

async function readOverrides(): Promise<Overrides> {
    if (!existsSync(paths.overrides)) return {};
    try {
        return JSON.parse(await readFile(paths.overrides, 'utf8')) as Overrides;
    } catch (err) {
        console.error(`overrides.json 解析失败, 本次忽略: ${(err as Error).message}`);
        return {};
    }
}

async function readManual(): Promise<NormalizedTweet[]> {
    if (!existsSync(paths.manual)) return [];
    return parseManual(await readFile(paths.manual, 'utf8'));
}

/** 官方 API 采集的结果(如果跑过 collect:api) */
async function readApiTweets(): Promise<NormalizedTweet[]> {
    if (!existsSync(paths.apiTweets)) return [];
    try {
        return JSON.parse(await readFile(paths.apiTweets, 'utf8')) as NormalizedTweet[];
    } catch (err) {
        console.error(`api-tweets.json 解析失败, 本次忽略: ${(err as Error).message}`);
        return [];
    }
}

const captures = await readRawCaptures();
const fromCapture = extractTweets(captures.map((c) => c.body));
const fromApi = await readApiTweets();
const fromManual = await readManual();

// 优先级: 手动补录 > 官方 API > CDP 采集 (同 id 时后写入的覆盖)
const byId = new Map<string, NormalizedTweet>();
for (const t of fromCapture) byId.set(t.id, t);
for (const t of fromApi) byId.set(t.id, t);
for (const t of fromManual) byId.set(t.id, t);

const overrides = await readOverrides();
const dataset = buildDataset([...byId.values()], overrides, captures.length);

await mkdir(join(paths.root, 'data'), { recursive: true });
await writeFile(paths.dataset, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');

const { stats } = dataset;
console.log(`
解析完了:
  原始响应   ${stats.rawCaptures} 件 (API ${fromApi.length} 件 / 手动补录 ${fromManual.length} 件)
  推文       ${stats.tweets} 件
  社団       ${stats.circles} 件
  コスプレ   ${stats.cosplayers} 件
  未分類     ${stats.unclassified} 件
  人工修正   ${stats.overridesApplied} 件適用

  -> ${paths.dataset}
`);

if (stats.tweets === 0) {
    console.log('推文が 0 件です。先に bun run collect で採集するか, data/manual.txt に手動で書いてください。\n');
}
