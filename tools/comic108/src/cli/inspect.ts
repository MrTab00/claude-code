/**
 * 採集した生データに対して、解析がどこまで効いているかを見る診断コマンド。
 *
 *   bun run inspect          概況 + 取りこぼしたツイート
 *   bun run inspect --all    全ツイートの解析結果
 *   bun run inspect --json   機械可読(そのまま貼って共有できる)
 *
 * 正規表現は実データを見ないと詰められないので、出力はそのまま貼れる形にしてある。
 */

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { paths } from '../../config';
import { classify } from '../parse/classify';
import { parseBooths } from '../parse/booth';
import { extractTweets } from '../parse/extract';
import type { NormalizedTweet, RawCapture } from '../types';

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
const flags = process.argv.slice(2);
const showAll = flags.includes('--all');

/** 貼り付けやすいように 1 行化して切り詰める */
const oneLine = (s: string, n = 150) => {
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length > n ? `${t.slice(0, n)}…` : t;
};

interface Row {
    tweet: NormalizedTweet;
    kind: ReturnType<typeof classify>;
    booths: ReturnType<typeof parseBooths>;
}

const rows: Row[] = tweets.map((tweet) => ({
    tweet,
    kind: classify(tweet),
    booths: parseBooths(tweet.text),
}));

const circleish = rows.filter((r) => r.kind === 'circle' || r.kind === 'both');
const missingBooth = circleish.filter((r) => r.booths.length === 0);
const lowConfidence = rows.filter((r) => r.booths.some((b) => b.confidence === 'low'));
const unclassified = rows.filter((r) => r.kind === 'none');

if (flags.includes('--json')) {
    console.log(
        JSON.stringify(
            rows.map((r) => ({
                url: r.tweet.url,
                kind: r.kind,
                text: r.tweet.text,
                hashtags: r.tweet.hashtags,
                booths: r.booths.map((b) => b.display),
            })),
            null,
            2,
        ),
    );
    process.exit(0);
}

console.log(`
=== 概況 ===
  生応答        ${bodies.length} 件 (${files.length} ファイル)
  ツイート      ${tweets.length} 件
  サークル系    ${circleish.length} 件
  コスプレ系    ${rows.filter((r) => r.kind === 'cosplayer' || r.kind === 'both').length} 件
  未分類        ${unclassified.length} 件

  配置が取れた  ${circleish.length - missingBooth.length} / ${circleish.length} 件${
      circleish.length ? ` (${Math.round(((circleish.length - missingBooth.length) / circleish.length) * 100)}%)` : ''
  }
  確度 low      ${lowConfidence.length} 件
  画像のみ      ${missingBooth.filter((r) => r.tweet.media.length > 0).length} 件 (本文に配置が無く、お品書き画像だけ)
`);

const dump = (title: string, list: Row[], limit = 25) => {
    if (list.length === 0) return;
    console.log(`=== ${title} (${list.length} 件) ===\n`);
    for (const r of list.slice(0, limit)) {
        console.log(`@${r.tweet.screenName}  ${r.tweet.url}`);
        if (r.booths.length) console.log(`  配置: ${r.booths.map((b) => `${b.display} [${b.confidence}]`).join(' / ')}`);
        if (r.tweet.hashtags.length) console.log(`  tags: ${r.tweet.hashtags.join(' ')}`);
        console.log(`  本文: ${oneLine(r.tweet.text)}\n`);
    }
    if (list.length > limit) console.log(`  ... 他 ${list.length - limit} 件\n`);
};

if (showAll) {
    dump('全ツイート', rows, 200);
} else {
    dump('配置が取れなかったサークル系ツイート', missingBooth);
    dump('確度 low の配置', lowConfidence);
    dump('未分類', unclassified, 10);
    console.log('全部見るには --all、そのまま共有するには --json\n');
}
