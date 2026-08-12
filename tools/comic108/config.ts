import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

export const paths = {
    root: ROOT,
    raw: join(ROOT, 'data', 'raw'),
    dataset: join(ROOT, 'data', 'dataset.json'),
    overrides: join(ROOT, 'data', 'overrides.json'),
    manual: join(ROOT, 'data', 'manual.txt'),
    apiTweets: join(ROOT, 'data', 'api-tweets.json'),
    dist: join(ROOT, 'dist'),
    html: join(ROOT, 'dist', 'c108.html'),
};

export const event = {
    name: 'コミックマーケット108 (C108)',
    days: [
        { day: 1 as const, date: '2026-08-15', label: '1日目 8/15(土)' },
        { day: 2 as const, date: '2026-08-16', label: '2日目 8/16(日)' },
    ],
};

/**
 * 采集配置。
 *
 * 设计前提: 只被动读取页面自己发出的 GraphQL 响应, 不构造任何 API 请求。
 * X 每 2-4 周轮换 doc_id 和 features 参数, 构造请求的爬虫都会周期性失效; 被动捕获不受影响。
 */
export const collect = {
    /** 已登录 Chrome 的远程调试端口 */
    cdpEndpoint: process.env.C108_CDP ?? 'http://127.0.0.1:9222',

    /**
     * 搜索关键词。f=live 取最新时间线。
     *
     * コスプレ系は「#C108コスプレ」のような連結ハッシュタグを当てにいくと外れる —— 実際に
     * 空振りした。ハッシュタグ + 語句の AND 検索の方が確実に当たる。
     * なおコスプレ写真はイベント当日以降に投稿されるので、開催前に走らせても数は出ない。
     */
    queries: [
        '#C108 お品書き',
        '#C108 新刊',
        '#コミケ108 お品書き',
        '#C108',
        '#C108 コスプレ',
        '#コミケ108 コスプレ',
    ],

    /**
     * 1 回の検索(= 1 つの期間の窓)で採る上限。
     * ここに当たった窓は「まだ奥に残っている」ということなので、半分に割って掘り直す。
     */
    maxTweetsPerQuery: 600,

    /**
     * 期間で切って何度も検索する設定。
     *
     * X の検索は 1 クエリでどこまで遡れるかに上限があり、そこで打ち切られる。数百件も遡ると
     * 「まだ古い投稿があるのに出てこない」状態になり、実際に取りこぼす。
     * since:/until: で期間を切ると窓ごとに別々に遡れるので、同じキーワードでも取れる数が増える。
     *
     * まず広い窓で試し、上限に当たった窓だけを半分に割って掘り直す。
     * 投稿の薄い時期に時間をかけず、密な時期だけ細かく見ることになる。
     */
    window: {
        enabled: true,
        /** 探す期間。省略時はイベントの 45 日前から 3 日後まで(告知はこの範囲に集中する) */
        from: null as string | null,
        to: null as string | null,
        /** 最初の窓の日数 */
        initialDays: 14,
        /** 暴走よけ。1 キーワードあたりの窓の総数 */
        maxWindowsPerQuery: 120,
    },

    /**
     * 采集时用的视口尺寸。故意做得很高。
     *
     * 实际窗口一屏只放得下 2-3 条推文, 而滚动是按视口高度走的 —— 视口小就意味着
     * 绝大部分轮次都在翻已经加载过的内容, 真正触到「加载下一页」阈值的时刻很少。
     * 把视口撑高之后, 到达底部所需的轮数掉一个数量级, 而请求频率不变(依然是每轮最多触发一次)。
     * 太高会让 X 一次渲染过多 DOM 反而变慢, 3000 前后比较稳。
     */
    viewport: { width: 1440, height: 3200 },

    /** 滚动间隔随机区间(ms)。低频率, 就是一个正常用户在正常浏览 */
    scrollDelayMs: [1500, 3500] as const,

    /**
     * 连续多少轮滚动没有新推文就停止。
     * X は次のページを返すまで数秒黙ることがあるので、少し辛抱強くしてある。
     */
    idleRoundsBeforeStop: 6,

    /** 是否自动滚动。设为 false 则脚本只静默捕获, 由你手动滚页面 */
    autoScroll: true,

    /** 只捕获这些 operation 的响应。按名字匹配, 不碰会轮换的 hash */
    operations: /^(SearchTimeline|UserTweets|UserMedia|TweetDetail|UserByScreenName)$/,
};

/** 抽角色名时要滤掉的通用 hashtag(小写比较) */
export const hashtagStoplist = new Set(
    [
        'c108', 'c108_cos', 'コミケ108', 'コミケ', 'コミックマーケット', 'comiket',
        'コスプレ', 'cosplay', 'cos', 'レイヤー', 'コスプレイヤー',
        '撮影', '撮影会', 'カメラ', 'ポートレート', 'photo',
        'お品書き', '品書き', '新刊', '既刊', '頒布', '通販', 'サークル', '同人誌',
        '初参加', '宣伝', 'RT希望', '拡散希望', 'イラスト', 'fanart',
        '東京ビッグサイト', 'ビッグサイト',
    ].map((s) => s.toLowerCase()),
);

/**
 * 复合噪声 hashtag 的模式。精确表挡不住 #C108コスプレ / #C108お品書き 这类拼接标签,
 * 所以再加一道模式过滤。角色名和作品名基本不会撞上这些词。
 */
export const hashtagNoisePattern =
    /(^c?108$|^c108|コミケ|comiket|コスプレ|cosplay|レイヤー|お品書き|品書き|新刊|既刊|頒布|通販|サークル|同人|撮影|拡散希望|rt希望|ビッグサイト)/i;

/** 社团类推文的信号词 */
export const circleSignals =
    /お品書き|品書き|品書|新刊|既刊|頒布|スペース|配置|サークル|委託|通販|コピー本|無料配布|setlist|スペNo/i;

/** cosplay 类推文的信号词 */
export const cosplaySignals = /コスプレ|コスプレイヤー|レイヤー|_cos\b|#cos\b|cosplay|撮影|更衣室|コスプレエリア|被写体/i;

/** cosplayer 的位置词表 —— 不是摊位号 */
export const cosplayLocations = [
    '屋上', 'エントランス', 'コスプレエリア', 'コスプレ広場',
    '東広場', '西広場', '南広場', '外周', '防災公園', 'ガレリア',
    '更衣室', '屋外', '屋内',
];
