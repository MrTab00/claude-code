/**
 * 官方 X API での採集(予備ルート)。X_BEARER_TOKEN が要る。
 *
 *   X_BEARER_TOKEN=xxx bun run collect:api
 *   X_BEARER_TOKEN=xxx bun run collect:api "#C108 お品書き"
 *
 * 結果は data/api-tweets.json に書き、bun run parse が CDP 採集分と自動でマージする。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { collect as collectConfig, paths } from '../../config';
import { searchRecent } from '../collect/xapi';
import type { NormalizedTweet } from '../types';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const queries = args.length > 0 ? args : collectConfig.queries;

const byId = new Map<string, NormalizedTweet>();

try {
    for (const [i, query] of queries.entries()) {
        process.stdout.write(`  [${i + 1}/${queries.length}] ${query} ... `);
        const tweets = await searchRecent(query);
        for (const t of tweets) byId.set(t.id, t);
        console.log(`${tweets.length} 件`);
    }
} catch (err) {
    console.error(`\n${(err as Error).message}\n`);
    process.exit(1);
}

await mkdir(join(paths.root, 'data'), { recursive: true });
await writeFile(paths.apiTweets, `${JSON.stringify([...byId.values()], null, 2)}\n`, 'utf8');

console.log(`\n合計 ${byId.size} 件 -> ${paths.apiTweets}\n次: bun run parse\n`);
