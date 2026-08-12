/**
 * 社团(サークル)字段抽取: 社团名 / 新刊 / 价格 / 有无お品書き图。
 */

import type { Circle, Confidence, Media, NormalizedTweet } from '../types';
import { boothDays, normalize, parseBooths, parseDays } from './booth';

/** 各种括号包住的内容 —— 日文推文里社团名和本子名几乎都在括号里 */
const BRACKETED = /[「『【《\[]([^」』】》\]]{1,40})[」』】》\]]/g;

/** 明确点名社团的写法 */
const NAMED_CIRCLE = [
    /サークル(?:名)?\s*[:：]?\s*[「『【]?([^」』】\n]{1,40})[」』】]?/,
    /[「『【]([^」』】]{1,40})[」』】]\s*(?:という|さん)?\s*(?:サークル|で参加)/,
];

/** 新刊/既刊 标题 */
const WORK_PATTERNS = [
    /新刊\s*[:：]?\s*[「『【]([^」』】]{1,60})[」』】]/g,
    /既刊\s*[:：]?\s*[「『【]([^」』】]{1,60})[」』】]/g,
];

const PRICE = /([0-9]{2,5})\s*円/;
const SHINAGAKI = /お品書き|品書き|品書|おしながき/;

function extractCircleName(text: string, fallback: string, works: string[]): { name: string | null; confidence: Confidence } {
    for (const re of NAMED_CIRCLE) {
        const m = text.match(re);
        if (m?.[1]) return { name: m[1].trim(), confidence: 'high' };
    }

    // 没点名但正文里有唯一一个括号内容 —— 当作候选, 低置信度。
    // 既に本のタイトルとして拾ったものは除く(「新刊『X』」の X をサークル名にしてしまわないため)
    const bracketed = [...text.matchAll(BRACKETED)].map((m) => m[1].trim());
    const candidates = bracketed.filter(
        (s) => !/^C?108$/i.test(s) && !/新刊|既刊|お品書き/.test(s) && !works.includes(s),
    );
    if (candidates.length === 1) return { name: candidates[0], confidence: 'low' };

    // 兜底用作者显示名。同人作者的显示名常常就写着社团名
    return { name: fallback || null, confidence: 'low' };
}

function extractWorks(text: string): string[] {
    const works = new Set<string>();
    for (const re of WORK_PATTERNS) {
        re.lastIndex = 0;
        for (const m of text.matchAll(re)) {
            if (m[1]) works.add(m[1].trim());
        }
    }
    return [...works];
}

/**
 * 本文に配置が無い時の逃げ道。
 *
 * 実データで最も多い取りこぼしは「お品書き公開しました！」だけのツイートで、
 * 配置番号はお品書き画像の中にしか無い。ただし同人サークルはイベント週になると
 * 表示名やプロフィールに配置を書くのが通例 —— 「さんぷる工房@日曜東A-12b」のように。
 * そこは既に採集済みのデータに入っているので、読むだけで拾える。
 */
function boothsFromProfile(tweet: NormalizedTweet): Circle['booths'] {
    const fromName = parseBooths(tweet.displayName).filter((b) => b.confidence === 'high');
    if (fromName.length) return fromName.map((b) => ({ ...b, source: 'name' as const }));

    const fromBio = parseBooths(tweet.bio ?? '').filter((b) => b.confidence === 'high');
    return fromBio.map((b) => ({ ...b, source: 'bio' as const }));
}

export function buildCircle(tweet: NormalizedTweet, dual: boolean): Circle {
    const text = normalize(tweet.text);
    // 本文から完全な配置が読めなかった時だけプロフィールを見る。
    // 「本文が 0 件のときだけ」にすると、本文から地区しか読めなかった場合に
    // 表示名の完全な配置(「松本規之 C108 8/16「南1 T-17ab」」など)を見逃す。
    const booths = parseBooths(tweet.text);
    if (!booths.some((b) => b.confidence === 'high')) {
        const profile = boothsFromProfile(tweet);
        if (profile.length) booths.splice(0, booths.length, ...profile);
    }
    const works = extractWorks(text);
    const { name, confidence } = extractCircleName(text, tweet.displayName, works);
    const price = text.match(PRICE);

    return {
        kind: 'circle',
        tweetId: tweet.id,
        screenName: tweet.screenName,
        displayName: tweet.displayName,
        circleName: name,
        circleNameConfidence: confidence,
        booths,
        // 表示名の「@C108両日参加」のように、配置は無くても日程だけ分かる例が多い
        days: [
            ...new Set([...boothDays(booths), ...parseDays(tweet.text), ...parseDays(tweet.displayName)]),
        ].sort(),
        works,
        hasShinagaki: SHINAGAKI.test(text) && tweet.media.length > 0,
        price: price ? `${price[1]}円` : null,
        text: tweet.text,
        media: tweet.media as Media[],
        url: tweet.url,
        createdAt: tweet.createdAt,
        dual,
    };
}
