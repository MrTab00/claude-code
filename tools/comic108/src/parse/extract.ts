/**
 * GraphQL 响应 -> NormalizedTweet。
 *
 * 不硬编码 data.search_by_raw_query.search_timeline.timeline.instructions[...] 这类深路径:
 * 各 operation 的外层结构不同, 而且 X 会改。改为递归遍历整棵 JSON 树, 捞出所有
 * __typename === 'Tweet' 的对象。这样对 schema 变动和不同 operation 都稳。
 */

import type { Media, NormalizedTweet } from '../types';

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null;

/** 深挖一个可能被 Result 包了好几层的对象 */
function unwrap(node: unknown): Json | null {
    if (!isObj(node)) return null;
    if (node.__typename === 'TweetWithVisibilityResults' && isObj(node.tweet)) return node.tweet;
    return node;
}

/** 递归收集树里所有推文节点 */
export function collectTweetNodes(root: unknown, out = new Map<string, Json>()): Map<string, Json> {
    if (Array.isArray(root)) {
        for (const item of root) collectTweetNodes(item, out);
        return out;
    }
    if (!isObj(root)) return out;

    const node = unwrap(root);
    if (node && node.__typename === 'Tweet' && typeof node.rest_id === 'string' && isObj(node.legacy)) {
        // 后出现的通常字段更全, 但先到先得已足够 —— 同 id 只留一份
        if (!out.has(node.rest_id)) out.set(node.rest_id, node);
    }

    for (const value of Object.values(root)) collectTweetNodes(value, out);
    return out;
}

/** 作者信息。X 在 2025 年把 user 的字段从 legacy 挪到了 core, 两边都读 */
function readUser(node: Json): { screenName: string; displayName: string; avatar?: string } {
    const result = (node.core as Json | undefined)?.user_results as Json | undefined;
    const user = (result?.result ?? {}) as Json;
    const legacy = (user.legacy ?? {}) as Json;
    const core = (user.core ?? {}) as Json;
    const avatarSrc = (user.avatar ?? {}) as Json;

    return {
        screenName: String(core.screen_name ?? legacy.screen_name ?? ''),
        displayName: String(core.name ?? legacy.name ?? ''),
        avatar: (avatarSrc.image_url ?? legacy.profile_image_url_https) as string | undefined,
    };
}

/** 长推文的正文在 note_tweet 里, 优先取它 —— legacy.full_text 会被截断 */
function readText(node: Json, legacy: Json): string {
    const note = (((node.note_tweet as Json)?.note_tweet_results as Json)?.result ?? {}) as Json;
    const raw = String(note.text ?? legacy.full_text ?? '');
    // t.co 短链在卡片里只是噪声, 媒体信息另有字段
    return raw.replace(/https:\/\/t\.co\/\w+/g, '').replace(/\s+\n/g, '\n').trim();
}

function readHashtags(node: Json, legacy: Json): string[] {
    const note = (((node.note_tweet as Json)?.note_tweet_results as Json)?.result ?? {}) as Json;
    const sets = [note.entity_set, legacy.entities].filter(isObj) as Json[];
    const tags = new Set<string>();
    for (const set of sets) {
        for (const h of (set.hashtags as Json[] | undefined) ?? []) {
            if (isObj(h) && typeof h.text === 'string') tags.add(h.text);
        }
    }
    return [...tags];
}

function readMedia(legacy: Json): Media[] {
    const extended = (legacy.extended_entities as Json | undefined)?.media as Json[] | undefined;
    const basic = (legacy.entities as Json | undefined)?.media as Json[] | undefined;
    const list = extended ?? basic ?? [];

    const out: Media[] = [];
    const seen = new Set<string>();
    for (const m of list) {
        if (!isObj(m) || typeof m.media_url_https !== 'string') continue;
        if (seen.has(m.media_url_https)) continue;
        seen.add(m.media_url_https);
        const type = m.type === 'video' || m.type === 'animated_gif' ? m.type : 'photo';
        out.push({ url: m.media_url_https, type });
    }
    return out;
}

/** 把一个推文节点转成扁平结构 */
export function normalizeTweet(node: Json): NormalizedTweet | null {
    const legacy = node.legacy as Json;
    const id = String(node.rest_id);
    const user = readUser(node);
    if (!user.screenName) return null;

    return {
        id,
        text: readText(node, legacy),
        screenName: user.screenName,
        displayName: user.displayName || user.screenName,
        avatar: user.avatar,
        createdAt: legacy.created_at ? new Date(String(legacy.created_at)).toISOString() : '',
        hashtags: readHashtags(node, legacy),
        media: readMedia(legacy),
        url: `https://x.com/${user.screenName}/status/${id}`,
        isRetweet: isObj(legacy.retweeted_status_result),
        lang: legacy.lang as string | undefined,
    };
}

/**
 * 从任意数量的原始响应体里提取推文, 按 id 去重。
 * 转推会被丢掉 —— 转推里的摊位信息属于原作者, 原推本身通常也在采集范围内。
 */
export function extractTweets(bodies: unknown[]): NormalizedTweet[] {
    const nodes = new Map<string, Json>();
    for (const body of bodies) collectTweetNodes(body, nodes);

    const tweets: NormalizedTweet[] = [];
    for (const node of nodes.values()) {
        const t = normalizeTweet(node);
        if (t && !t.isRetweet) tweets.push(t);
    }
    return tweets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
