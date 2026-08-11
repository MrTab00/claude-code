/**
 * Cosplayer 字段抽取: 角色 / 作品 / 出场日 / 位置。
 *
 * 这一步天然模糊 —— 日文自由文本没有稳定结构。hashtag 是信噪比最高的信号, 正文只能靠模式兜底。
 * 所以每条都带 confidence, 低置信度会在 HTML 里被标出来供人工过一遍。
 */

import { cosplayLocations, hashtagNoisePattern, hashtagStoplist } from '../../config';
import type { Confidence, Cosplayer, Media, NormalizedTweet } from '../types';
import { normalize, parseDays } from './booth';

/**
 * 「〇〇のコスプレ」「〇〇 cos」 —— 角色名在前。
 * コスプレエリア / コスプレ広場 是场地名而不是「〇〇のコスプレ」, 用否定先行断言排除,
 * 否则「そのあと コスプレエリア で」会把「そのあと」当成角色名。
 */
const CHARACTER_PATTERNS = [
    /([^\s、。！？!?,.\/「」『』【】#＃]{1,20})\s*の?\s*コスプレ(?!エリア|広場|イベント|衣装|カメラ)/g,
    /([^\s、。！？!?,.\/「」『』【】#＃]{1,20})\s*[のC]?cos\b/gi,
];

/** 作品名常写在 『』 或 【】 里 */
const SERIES_PATTERNS = [/『([^』]{1,40})』/g, /【([^】]{1,40})】/g];

/** 一看就不是角色名的词。接续词和时间词最容易被模式误捕 */
const NOT_A_CHARACTER =
    /^(今日|明日|昨日|本日|初日|最終日|初|久々|久しぶり|自分|わたし|私|僕|俺|みんな|全部|以上|新作|今回|前回|次回|そのあと|そのご|あと|つぎ|次|最後|最初|ラスト|予定|参加|予告|一緒|以下|本番|今年|去年|来年)$/;

function fromHashtags(hashtags: string[]): string[] {
    return hashtags.filter((h) => {
        const lower = h.toLowerCase();
        if (hashtagStoplist.has(lower)) return false;
        // 精确表挡不住 #C108コスプレ 这类拼接标签, 再过一道模式
        if (hashtagNoisePattern.test(h)) return false;
        // 纯数字多半是活动标签, 不是角色名
        if (/^\d+$/.test(h)) return false;
        if (h.length > 24) return false;
        return true;
    });
}

function matchAllGroups(text: string, patterns: RegExp[]): string[] {
    const out = new Set<string>();
    for (const re of patterns) {
        re.lastIndex = 0;
        for (const m of text.matchAll(re)) {
            const v = m[1]?.trim();
            if (v && v.length >= 2 && !NOT_A_CHARACTER.test(v)) out.add(v);
        }
    }
    return [...out];
}

function extractLocations(text: string): string[] {
    return cosplayLocations.filter((loc) => text.includes(loc));
}

export function buildCosplayer(tweet: NormalizedTweet, dual: boolean): Cosplayer {
    const text = normalize(tweet.text);

    // hashtag 优先: 作者自己打的标签比正文里猜出来的可靠得多
    const tagged = fromHashtags(tweet.hashtags);
    const fromText = matchAllGroups(text, CHARACTER_PATTERNS);
    const series = matchAllGroups(text, SERIES_PATTERNS);

    const characters = tagged.length > 0 ? tagged : fromText;
    const confidence: Confidence = tagged.length > 0 ? 'high' : fromText.length > 0 ? 'low' : 'low';

    return {
        kind: 'cosplayer',
        tweetId: tweet.id,
        screenName: tweet.screenName,
        displayName: tweet.displayName,
        characters,
        series: series.filter((s) => !characters.includes(s)),
        charactersConfidence: confidence,
        days: parseDays(tweet.text),
        locations: extractLocations(text),
        text: tweet.text,
        media: tweet.media as Media[],
        url: tweet.url,
        createdAt: tweet.createdAt,
        dual,
    };
}
