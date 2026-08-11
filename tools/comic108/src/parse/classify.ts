/**
 * 分类路由 + 数据集组装 + 人工修正合并。
 */

import { circleSignals, cosplaySignals, event } from '../../config';
import type { Circle, Cosplayer, Dataset, Entry, NormalizedTweet, Overrides, Unclassified } from '../types';
import { hasBooth, normalize } from './booth';
import { buildCircle } from './circle';
import { buildCosplayer } from './cosplay';

export type Kind = 'circle' | 'cosplayer' | 'both' | 'none';

/** 判断一条推文属于哪一类。命中摊位号本身就是最强的社团信号 */
export function classify(tweet: NormalizedTweet): Kind {
    const text = normalize(tweet.text);
    const isCircle = circleSignals.test(text) || hasBooth(tweet.text);
    const isCosplay = cosplaySignals.test(text);

    if (isCircle && isCosplay) return 'both';
    if (isCircle) return 'circle';
    if (isCosplay) return 'cosplayer';
    return 'none';
}

function buildUnclassified(tweet: NormalizedTweet): Unclassified {
    return {
        kind: 'unclassified',
        tweetId: tweet.id,
        screenName: tweet.screenName,
        displayName: tweet.displayName,
        text: tweet.text,
        media: tweet.media,
        url: tweet.url,
        createdAt: tweet.createdAt,
    };
}

/**
 * 应用人工修正。key 可以是 tweetId, 也可以是 "@screenName"(对该作者的所有条目生效)。
 * drop: true 则整条剔除。
 *
 * 这一步放在最后, 优先级最高 —— 重跑 parse 不会冲掉手工修正。
 */
function applyOverrides<T extends Entry>(entries: T[], overrides: Overrides): { entries: T[]; applied: number } {
    let applied = 0;
    const out: T[] = [];

    for (const entry of entries) {
        const patches = [overrides[entry.tweetId], overrides[`@${entry.screenName}`]].filter(Boolean);
        if (patches.length === 0) {
            out.push(entry);
            continue;
        }

        let merged: T = entry;
        let dropped = false;
        for (const patch of patches) {
            if (patch!.drop) dropped = true;
            const { drop: _drop, kind: _kind, ...fields } = patch!;
            merged = { ...merged, ...(fields as Partial<T>) };
        }

        applied++;
        if (!dropped) out.push(merged);
    }

    return { entries: out, applied };
}

/** 推文列表 -> 完整数据集 */
export function buildDataset(tweets: NormalizedTweet[], overrides: Overrides = {}, rawCaptures = 0): Dataset {
    const circles: Circle[] = [];
    const cosplayers: Cosplayer[] = [];
    const unclassified: Unclassified[] = [];

    for (const tweet of tweets) {
        switch (classify(tweet)) {
            case 'circle':
                circles.push(buildCircle(tweet, false));
                break;
            case 'cosplayer':
                cosplayers.push(buildCosplayer(tweet, false));
                break;
            case 'both':
                // 双边收录: 一条推文既宣传摊位又贴 cos 照的情况很常见
                circles.push(buildCircle(tweet, true));
                cosplayers.push(buildCosplayer(tweet, true));
                break;
            default:
                unclassified.push(buildUnclassified(tweet));
        }
    }

    const c = applyOverrides(circles, overrides);
    const p = applyOverrides(cosplayers, overrides);
    const u = applyOverrides(unclassified, overrides);

    return {
        generatedAt: new Date().toISOString(),
        event,
        stats: {
            rawCaptures,
            tweets: tweets.length,
            circles: c.entries.length,
            cosplayers: p.entries.length,
            unclassified: u.entries.length,
            overridesApplied: c.applied + p.applied + u.applied,
        },
        circles: c.entries,
        cosplayers: p.entries,
        unclassified: u.entries,
    };
}
