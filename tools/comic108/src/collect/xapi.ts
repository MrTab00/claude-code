/**
 * 官方 X API 适配器 —— 预留路径。
 *
 * 现在用不上(Free 档没有 search 权限, Basic 档 $200/月), 但采集层是可插拔的:
 * 将来真拿到 Key, 设好 X_BEARER_TOKEN 就能直接用, 解析层和渲染层一行都不用改。
 *
 * 注意档位限制:
 *   Free  —— /2/tweets/search/recent 不可用, 这个适配器会直接 403
 *   Basic —— 只能搜最近 7 天
 *   Pro   —— 可用 full-archive (把 ENDPOINT 换成 /2/tweets/search/all)
 */

import type { Media, NormalizedTweet } from '../types';

const ENDPOINT = 'https://api.x.com/2/tweets/search/recent';

const FIELDS = {
    'tweet.fields': 'created_at,entities,note_tweet,attachments,lang,referenced_tweets',
    expansions: 'author_id,attachments.media_keys',
    'user.fields': 'username,name,profile_image_url,description',
    'media.fields': 'url,type,preview_image_url',
    max_results: '100',
};

interface ApiUser {
    id: string;
    username: string;
    name: string;
    profile_image_url?: string;
    description?: string;
}

interface ApiMedia {
    media_key: string;
    type: string;
    url?: string;
    preview_image_url?: string;
}

interface ApiTweet {
    id: string;
    text: string;
    author_id: string;
    created_at?: string;
    lang?: string;
    note_tweet?: { text?: string };
    entities?: { hashtags?: { tag: string }[] };
    attachments?: { media_keys?: string[] };
    referenced_tweets?: { type: string }[];
}

interface ApiResponse {
    data?: ApiTweet[];
    includes?: { users?: ApiUser[]; media?: ApiMedia[] };
    meta?: { next_token?: string };
    title?: string;
    detail?: string;
}

function toNormalized(tweet: ApiTweet, users: Map<string, ApiUser>, media: Map<string, ApiMedia>): NormalizedTweet | null {
    const user = users.get(tweet.author_id);
    if (!user) return null;

    const attached: Media[] = (tweet.attachments?.media_keys ?? [])
        .map((key) => media.get(key))
        .filter((m): m is ApiMedia => !!m)
        .map((m) => ({
            url: m.url ?? m.preview_image_url ?? '',
            type: m.type === 'video' || m.type === 'animated_gif' ? m.type : 'photo',
        }))
        .filter((m) => m.url);

    return {
        id: tweet.id,
        text: (tweet.note_tweet?.text ?? tweet.text).replace(/https:\/\/t\.co\/\w+/g, '').trim(),
        screenName: user.username,
        displayName: user.name || user.username,
        avatar: user.profile_image_url,
        bio: user.description,
        createdAt: tweet.created_at ? new Date(tweet.created_at).toISOString() : '',
        hashtags: (tweet.entities?.hashtags ?? []).map((h) => h.tag),
        media: attached,
        url: `https://x.com/${user.username}/status/${tweet.id}`,
        isRetweet: (tweet.referenced_tweets ?? []).some((r) => r.type === 'retweeted'),
        lang: tweet.lang,
    };
}

/** 用官方 API 搜一个关键词。maxPages 用来给自己设个上限, 免得把额度一次跑光 */
export async function searchRecent(query: string, maxPages = 5): Promise<NormalizedTweet[]> {
    const token = process.env.X_BEARER_TOKEN;
    if (!token) {
        throw new Error(
            'X_BEARER_TOKEN が設定されていません。\n' +
                '公式 API を使わない場合は bun run collect (CDP 採集) を使ってください。',
        );
    }

    const out: NormalizedTweet[] = [];
    let nextToken: string | undefined;

    for (let page = 0; page < maxPages; page++) {
        const params = new URLSearchParams({ query, ...FIELDS });
        if (nextToken) params.set('next_token', nextToken);

        const res = await fetch(`${ENDPOINT}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        const json = (await res.json()) as ApiResponse;

        if (!res.ok) {
            const reason = json.detail ?? json.title ?? res.statusText;
            if (res.status === 403) {
                throw new Error(`403: ${reason}\nFree 档では検索 API を利用できません。CDP 採集を使ってください。`);
            }
            if (res.status === 429) {
                throw new Error(`429: レート制限に達しました。しばらく待ってから再実行してください。`);
            }
            throw new Error(`${res.status}: ${reason}`);
        }

        const users = new Map((json.includes?.users ?? []).map((u) => [u.id, u]));
        const media = new Map((json.includes?.media ?? []).map((m) => [m.media_key, m]));

        for (const tweet of json.data ?? []) {
            const normalized = toNormalized(tweet, users, media);
            if (normalized && !normalized.isRetweet) out.push(normalized);
        }

        nextToken = json.meta?.next_token;
        if (!nextToken) break;
    }

    return out;
}
