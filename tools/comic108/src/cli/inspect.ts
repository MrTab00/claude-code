/**
 * 採集した生データに対して、解析がどこまで効いているかを見る診断コマンド。
 *
 *   bun run inspect          概況 + 取りこぼしたツイート
 *   bun run inspect --all    全ツイートの解析結果
 *   bun run inspect --json   機械可読(そのまま貼って共有できる)
 *
 * parse と同じ buildDataset を通す —— 本文だけを見ていた頃は、表示名やプロフィールからの
 * 補完が効いているかどうかがここに出てこなかった。
 */

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { paths } from '../../config';
import { buildDataset } from '../parse/classify';
import { extractTweets } from '../parse/extract';
import type { Circle, RawCapture } from '../types';

if (!existsSync(paths.raw)) {
    console.error(`まだ採集していません: ${paths.raw}\n先に bun run collect を実行してください。`);
    process.exit(1);
}

const files = (await readdir(paths.raw)).filter((f) => f.endsWith('.jsonl'));
const bodies: unknown[] = [];
for (const file of files) {
    const content = await readFile(join(paths.raw, file), 'utf8');
    for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
            bodies.push((JSON.parse(line) as RawCapture).body);
        } catch {
            /* 壊れた行は無視 */
        }
    }
}

const tweets = extractTweets(bodies);
const dataset = buildDataset(tweets, {}, bodies.length);
const byId = new Map(tweets.map((t) => [t.id, t]));

const flags = process.argv.slice(2);
const showAll = flags.includes('--all');

/** 貼り付けやすいように 1 行化して切り詰める */
const oneLine = (s: string, n = 140) => {
    const t = (s ?? '').replace(/\s+/g, ' ').trim();
    return t.length > n ? `${t.slice(0, n)}…` : t;
};

const sourceOf = (c: Circle) => c.booths[0]?.source ?? (c.booths.length ? 'text' : 'none');
const count = (s: string) => dataset.circles.filter((c) => sourceOf(c) === s).length;

const withBooth = dataset.circles.filter((c) => c.booths.length > 0);
const missing = dataset.circles.filter((c) => c.booths.length === 0);
const imageOnly = missing.filter((c) => c.media.length > 0);
const lowConfidence = dataset.circles.filter((c) => c.booths.some((b) => b.confidence === 'low' && !b.source));

if (flags.includes('--json')) {
    console.log(
        JSON.stringify(
            dataset.circles.map((c) => {
                const t = byId.get(c.tweetId);
                return {
                    url: c.url,
                    displayName: c.displayName,
                    bio: t?.bio,
                    text: c.text,
                    booths: c.booths.map((b) => ({ display: b.display, confidence: b.confidence, source: b.source })),
                    hasMedia: c.media.length > 0,
                };
            }),
            null,
            2,
        ),
    );
    process.exit(0);
}

const pct = (n: number) => (dataset.circles.length ? ` (${Math.round((n / dataset.circles.length) * 100)}%)` : '');

console.log(`
=== 概況 ===
  生応答        ${bodies.length} 件 (${files.length} ファイル)
  ツイート      ${tweets.length} 件
  サークル系    ${dataset.circles.length} 件
  コスプレ系    ${dataset.cosplayers.length} 件
  未分類        ${dataset.unclassified.length} 件

=== 配置の取得元 ===
  合計          ${withBooth.length} / ${dataset.circles.length} 件${pct(withBooth.length)}
    本文から    ${count('text')} 件
    表示名から  ${count('name')} 件
    プロフから  ${count('bio')} 件
    別ツイート  ${count('account')} 件
  取れず        ${missing.length} 件 (うち画像あり ${imageOnly.length} 件)
  要確認(low)   ${lowConfidence.length} 件
`);

const dump = (title: string, list: Circle[], limit = 25) => {
    if (list.length === 0) return;
    console.log(`=== ${title} (${list.length} 件) ===\n`);
    for (const c of list.slice(0, limit)) {
        const t = byId.get(c.tweetId);
        console.log(`@${c.screenName}  ${c.url}`);
        console.log(`  表示名: ${oneLine(c.displayName, 60)}`);
        if (t?.bio) console.log(`  プロフ: ${oneLine(t.bio)}`);
        if (c.booths.length) {
            console.log(`  配置: ${c.booths.map((b) => `${b.display} [${b.source ?? 'text'}/${b.confidence}]`).join(' / ')}`);
        }
        console.log(`  本文: ${oneLine(c.text)}\n`);
    }
    if (list.length > limit) console.log(`  ... 他 ${list.length - limit} 件\n`);
};

if (showAll) {
    dump('全サークル系ツイート', dataset.circles, 200);
} else {
    // 表示名とプロフィールも出す —— そこに配置が書いてあるのに拾えていないのか、
    // そもそもどこにも書かれていないのかを切り分けるため
    dump('配置が取れなかったサークル系ツイート', missing);
    dump('要確認(一部しか読めていない)', lowConfidence, 10);
    console.log('全部見るには --all、そのまま共有するには --json\n');
}
