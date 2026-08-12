/**
 * C108 情报工具的数据结构定义。
 *
 * 数据流: RawCapture -> NormalizedTweet -> (Circle | Cosplayer | Unclassified) -> Dataset -> HTML
 *
 * 每一层都保留上一层的引用(tweetId), 所以任何一条结论都能追回原始推文。
 */

/** 采集层落盘的一行 jsonl: 页面自己发出的一次 GraphQL 响应, 原样保存 */
export interface RawCapture {
    /** GraphQL operation 名, 如 SearchTimeline / UserTweets。不记 doc_id, 因为 X 会轮换它 */
    op: string;
    url: string;
    capturedAt: string;
    /** 触发这次捕获的搜索关键词(如果有), 便于回溯来源 */
    query?: string;
    /** 响应体原文 */
    body: unknown;
}

/** 一张图片/视频缩略图 */
export interface Media {
    /** 原始 pbs.twimg.com URL */
    url: string;
    type: 'photo' | 'video' | 'animated_gif';
    /** --embed-media 模式下填入 base64 data URI */
    dataUri?: string;
    /** --save-media 模式下填入 dist/ からの相対パス */
    local?: string;
}

/** 从 GraphQL 响应里抽出来的一条推文, 已剥离 X 的嵌套结构 */
export interface NormalizedTweet {
    id: string;
    text: string;
    screenName: string;
    displayName: string;
    /** 作者头像 */
    avatar?: string;
    /** プロフィール文。イベント期間中はここに配置を書くサークルが多い */
    bio?: string;
    createdAt: string;
    hashtags: string[];
    media: Media[];
    url: string;
    /** 是否为转推 —— 转推里的摊位信息属于原作者, 不重复计入 */
    isRetweet: boolean;
    lang?: string;
}

export type Day = 1 | 2;
export type Area = '東' | '西' | '南';
export type AB = 'a' | 'b' | 'ab';
export type Confidence = 'high' | 'low';

/** 一个解析出来的 Comiket 摊位配置 */
export interface Booth {
    /** 1 = 8/15(土), 2 = 8/16(日) */
    day: Day | null;
    area: Area | null;
    /** ホール号, 如 "4" / "1-2" */
    hall: string | null;
    /** ブロック: 英字 A-Z 或片假名 ア-ン */
    block: string | null;
    number: number | null;
    ab: AB | null;
    /** 命中的原始文本片段 */
    raw: string;
    /** 归一化后的展示串, 如 "2日目 東A-12b" */
    display: string;
    confidence: Confidence;
    /**
     * 配置をどこから読んだか。未設定 = そのツイート本文から。
     * 本文に無い場合は 表示名 -> プロフィール -> 同じアカウントの別ツイート の順で探す。
     */
    source?: 'name' | 'bio' | 'account';
}

/** 社团 / サークル 条目 */
export interface Circle {
    kind: 'circle';
    tweetId: string;
    screenName: string;
    displayName: string;
    /** 社团名。推文里未必写, 抽不到时回退为作者显示名 */
    circleName: string | null;
    circleNameConfidence: Confidence;
    booths: Booth[];
    /** 出展日。配置から取れた日に加え、本文や表示名の「両日参加」なども反映する */
    days: Day[];
    /** 新刊/既刊 标题候选 */
    works: string[];
    /** 是否包含お品書き图 */
    hasShinagaki: boolean;
    price: string | null;
    text: string;
    media: Media[];
    url: string;
    createdAt: string;
    /** 同时也被判定为 cosplay 推文 */
    dual: boolean;
}

/** Cosplayer / レイヤー 条目 */
export interface Cosplayer {
    kind: 'cosplayer';
    tweetId: string;
    screenName: string;
    displayName: string;
    /** cos 的角色名 */
    characters: string[];
    /** 作品名 */
    series: string[];
    charactersConfidence: Confidence;
    /** 出场日程 */
    days: Day[];
    /** 位置: 屋上 / エントランス / コスプレエリア 等, 不是摊位号 */
    locations: string[];
    text: string;
    media: Media[];
    url: string;
    createdAt: string;
    dual: boolean;
}

/** 两边都没命中的推文, 单列一个 Tab 供人工扫 */
export interface Unclassified {
    kind: 'unclassified';
    tweetId: string;
    screenName: string;
    displayName: string;
    text: string;
    media: Media[];
    url: string;
    createdAt: string;
}

export type Entry = Circle | Cosplayer | Unclassified;

/** parse 阶段的产物, 也是 render 阶段的输入 */
export interface Dataset {
    generatedAt: string;
    event: {
        name: string;
        days: { day: Day; date: string; label: string }[];
    };
    stats: {
        rawCaptures: number;
        tweets: number;
        circles: number;
        cosplayers: number;
        unclassified: number;
        overridesApplied: number;
        /** 本文以外(表示名 / プロフィール / 別ツイート)から補った配置の数 */
        boothsInherited: number;
    };
    circles: Circle[];
    cosplayers: Cosplayer[];
    unclassified: Unclassified[];
}

/**
 * 人工修正。按 tweetId 或 "@screenName" 作 key, 值是要覆盖的字段。
 * parse 阶段最后合并, 优先级最高 —— 重跑解析不会冲掉手工修正。
 */
export type Overrides = Record<string, Partial<Circle & Cosplayer> & { kind?: Entry['kind']; drop?: boolean }>;
