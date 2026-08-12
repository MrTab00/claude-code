/**
 * 用内置 fixture 生成一份样例页面, 不需要采集也不需要 X 账号。
 * 先看看产物长什么样, 再决定要不要真的去采集。
 *
 *   bun run demo   ->  dist/c108-demo.html
 */

import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { paths } from '../../config';
import { buildDataset } from '../parse/classify';
import { extractTweets } from '../parse/extract';
import { renderHtml } from '../render/template';

const fixture = JSON.parse(readFileSync(join(import.meta.dir, '../fixtures/search-timeline.json'), 'utf8'));
const dataset = buildDataset(extractTweets([fixture]), {}, 1);

await mkdir(paths.dist, { recursive: true });
const out = join(paths.dist, 'c108-demo.html');
await writeFile(out, renderHtml(dataset), 'utf8');

console.log(`
サンプル出力: ${out}
  サークル ${dataset.stats.circles} 件 / コスプレ ${dataset.stats.cosplayers} 件
  ※ 画像は実在しないダミー URL なので表示されません
`);
