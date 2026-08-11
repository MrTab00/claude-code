/**
 * 手动补录。用来补上采集漏掉的、或你特别关心的几个人。
 *
 * data/manual.txt 格式 —— 用 --- 分隔多条, 每条第一行是作者和链接, 之后是正文:
 *
 *   @circle_name https://x.com/circle_name/status/1234567890
 *   C108 2日目 東A-12b で参加します
 *   新刊「タイトル」500円
 *   ---
 *   @layer_name
 *   1日目 屋上でコスプレしてます
 *
 * 走的是与 CDP 采集完全相同的 parse 管线, 所以字段和展示效果一致。
 */

import type { NormalizedTweet } from '../types';

const HEADER = /^@(\w{1,15})(?:\s+(https:\/\/x\.com\/\S+\/status\/(\d+)\S*))?\s*$/;

export function parseManual(content: string): NormalizedTweet[] {
    const blocks = content
        .split(/^\s*---+\s*$/m)
        .map((b) => b.trim())
        .filter(Boolean);

    const tweets: NormalizedTweet[] = [];

    for (const [i, block] of blocks.entries()) {
        // 先頭のコメント行と空行だけ落とす。本文中の # はハッシュタグなので触らない
        const lines = block.split('\n');
        while (lines.length && (/^\s*#/.test(lines[0]) || lines[0].trim() === '')) lines.shift();
        if (lines.length === 0) continue;

        const header = lines[0]?.match(HEADER);
        if (!header) {
            console.warn(`  manual.txt 第 ${i + 1} 块: 首行不是 "@用户名 [链接]", 已跳过`);
            continue;
        }

        const [, screenName, url, statusId] = header;
        const text = lines.slice(1).join('\n').trim();
        if (!text) {
            console.warn(`  manual.txt 第 ${i + 1} 块: 没有正文, 已跳过`);
            continue;
        }

        const id = statusId ?? `manual-${screenName}-${i}`;
        tweets.push({
            id,
            text,
            screenName,
            displayName: screenName,
            createdAt: new Date().toISOString(),
            hashtags: [...text.matchAll(/[#＃]([^\s#＃、。,.]+)/g)].map((m) => m[1]),
            media: [],
            url: url ?? `https://x.com/${screenName}`,
            isRetweet: false,
        });
    }

    return tweets;
}
