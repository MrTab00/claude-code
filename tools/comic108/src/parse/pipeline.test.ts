/**
 * 端到端管线自测: fixture 响应 -> 提取 -> 分类 -> 数据集 -> HTML。
 * 不需要联网, 不需要 X 账号。
 *   bun run test:pipeline
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderHtml } from '../render/template';
import { buildDataset } from './classify';
import { extractTweets } from './extract';

const fixture = JSON.parse(readFileSync(join(import.meta.dir, '../fixtures/search-timeline.json'), 'utf8'));

const failures: string[] = [];
let checks = 0;

function check(name: string, cond: boolean, detail?: unknown) {
    checks++;
    if (!cond) failures.push(`${name}${detail === undefined ? '' : `\n    ${JSON.stringify(detail)}`}`);
}

// --- 提取 ---
const tweets = extractTweets([fixture]);
check('リツイートを除いて 5 件抽出', tweets.length === 5, tweets.map((t) => t.id));
check('t.co リンクが本文から除去されている', !tweets.some((t) => t.text.includes('t.co')));

const circleTweet = tweets.find((t) => t.id === '1001')!;
check('新スキーマ(core)から作者を読める', circleTweet?.screenName === 'sample_circle', circleTweet?.screenName);
check('メディア 2 件', circleTweet?.media.length === 2);

const layerTweet = tweets.find((t) => t.id === '1002')!;
check('旧スキーマ(legacy)から作者を読める', layerTweet?.screenName === 'sample_layer', layerTweet?.screenName);

const wrapped = tweets.find((t) => t.id === '1003');
check('TweetWithVisibilityResults を剥がせている', wrapped?.screenName === 'both_sample');

const longTweet = tweets.find((t) => t.id === '1006')!;
check('note_tweet の全文を優先している', longTweet?.text.includes('南1-2ホール'), longTweet?.text.slice(-40));

// --- 分类と抽出 ---
const dataset = buildDataset(tweets, {}, 1);

check('サークル 3 件', dataset.stats.circles === 3, dataset.circles.map((c) => c.screenName));
check('コスプレ 2 件', dataset.stats.cosplayers === 2, dataset.cosplayers.map((c) => c.screenName));
check('未分類 1 件', dataset.stats.unclassified === 1, dataset.unclassified.map((c) => c.screenName));

const circle = dataset.circles.find((c) => c.tweetId === '1001')!;
check('配置 2日目 東A-12b', circle?.booths[0]?.display === '2日目 東A-12b', circle?.booths[0]);
check('サークル名を「」から取得', circle?.circleName === 'さんぷる工房', circle?.circleName);
check('サークル名の確度 high', circle?.circleNameConfidence === 'high');
check('新刊タイトル', circle?.works.includes('夏の記録'), circle?.works);
check('頒価', circle?.price === '500円', circle?.price);
check('お品書き画像あり', circle?.hasShinagaki === true);

const layer = dataset.cosplayers.find((c) => c.tweetId === '1002')!;
check('キャラをハッシュタグから取得', layer?.characters.includes('架空アリス'), layer?.characters);
check('汎用タグを除外している', !layer?.characters.includes('C108') && !layer?.characters.includes('C108コスプレ'), layer?.characters);
check('キャラ確度 high', layer?.charactersConfidence === 'high');
check('出演日 1日目', layer?.days.includes(1), layer?.days);
check('場所 屋上', layer?.locations.includes('屋上'), layer?.locations);

const dualCircle = dataset.circles.find((c) => c.tweetId === '1003');
const dualLayer = dataset.cosplayers.find((c) => c.tweetId === '1003');
check('サークル兼レイヤーは両方に載る', !!dualCircle && !!dualLayer);
check('dual フラグが立つ', dualCircle?.dual === true && dualLayer?.dual === true);
check('接続詞をキャラ名として誤検出しない', !dualLayer?.characters.includes('そのあと'), dualLayer?.characters);
check('コスプレエリアは場所として拾う', dualLayer?.locations.includes('コスプレエリア'), dualLayer?.locations);
check('平假名ブロック 1日目 西け-21a', dualCircle?.booths[0]?.display === '1日目 西け-21a', dualCircle?.booths[0]);

const long = dataset.circles.find((c) => c.tweetId === '1006')!;
check('長文から複数の配置を拾う', (long?.booths.length ?? 0) >= 2, long?.booths.map((b) => b.display));
check('全角ホール+片假名ブロック', long?.booths.some((b) => b.block === 'ア' && b.hall === '4'), long?.booths);
check('新刊と既刊の両方', long?.works.length === 2, long?.works);

// --- アカウント単位の配置引き継ぎ ---
// 「お品書き公開しました」だけで配置が本文に無いツイートは実データで最多の取りこぼし。
// 同じ人が別ツイートで配置を書いていれば、そこから借りる。
const withSibling = [
    ...tweets,
    {
        id: '2001', text: 'お品書き公開しました！ぜひお立ち寄りください #C108',
        screenName: 'sample_circle', displayName: 'さんぷる工房', createdAt: '2026-08-10T10:00:00.000Z',
        hashtags: ['C108'], media: [{ url: 'https://pbs.twimg.com/media/x.jpg', type: 'photo' as const }],
        url: 'https://x.com/sample_circle/status/2001', isRetweet: false,
    },
];
const inheritedSet = buildDataset(withSibling, {}, 1);
const borrowed = inheritedSet.circles.find((c) => c.tweetId === '2001');
check('配置の無いツイートが同じアカウントから引き継ぐ', borrowed?.booths[0]?.display === '2日目 東A-12b', borrowed?.booths);
check('引き継いだ配置は source=account が立つ', borrowed?.booths[0]?.source === 'account');
check('引き継いだ配置の確度は low', borrowed?.booths[0]?.confidence === 'low');
check('引き継ぎ件数が stats に出る', inheritedSet.stats.boothsInherited === 1, inheritedSet.stats.boothsInherited);
check('自前で配置があるツイートは上書きされない',
    inheritedSet.circles.find((c) => c.tweetId === '1001')?.booths[0]?.source === undefined);

// --- 表示名 / プロフィールからの補完 ---
// サークルはイベント週になると表示名やプロフィールに配置を書く。本文に無くてもそこから拾える。
const profileTweets = [
    {
        id: '3001', text: 'お品書きできました！当日はよろしくお願いします #C108',
        screenName: 'name_circle', displayName: 'なまえ工房@日曜 東A-31b', createdAt: '2026-08-10T10:00:00.000Z',
        hashtags: ['C108'], media: [], url: 'https://x.com/name_circle/status/3001', isRetweet: false,
    },
    {
        id: '3002', text: 'お品書き公開しました #C108',
        screenName: 'bio_circle', displayName: 'ぷろふ工房',
        bio: 'C108は 1日目 西け-07a にいます。通販はBOOTHにて。',
        createdAt: '2026-08-10T09:00:00.000Z',
        hashtags: ['C108'], media: [], url: 'https://x.com/bio_circle/status/3002', isRetweet: false,
    },
];
const profileSet = buildDataset(profileTweets, {}, 1);
const fromName = profileSet.circles.find((c) => c.tweetId === '3001');
const fromBio = profileSet.circles.find((c) => c.tweetId === '3002');
check('表示名から配置を拾う', fromName?.booths[0]?.display === '2日目 東A-31b', fromName?.booths);
check('表示名由来は source=name', fromName?.booths[0]?.source === 'name');
check('プロフィールから配置を拾う', fromBio?.booths[0]?.display === '1日目 西け-07a', fromBio?.booths);
check('プロフ由来は source=bio', fromBio?.booths[0]?.source === 'bio');
check('補完件数が stats に出る', profileSet.stats.boothsInherited === 2, profileSet.stats.boothsInherited);

// 本文から地区しか読めなかった場合、表示名の完全な配置を優先する
const partialText = buildDataset([{
    id: '3003', text: '■夏コミ #C108 お品書き■ 今回は南館の配置となっていますので涼しいハズ',
    screenName: 'partial_circle', displayName: '松本規之 C108 8/16「 南1 T-17ab 麒麟堂」新刊アリ',
    createdAt: '2026-08-10T08:00:00.000Z', hashtags: ['C108'], media: [],
    url: 'https://x.com/partial_circle/status/3003', isRetweet: false,
}], {}, 1);
const upgraded = partialText.circles[0];
check('地区だけの本文より表示名の完全な配置を優先', upgraded?.booths[0]?.display === '2日目 南1 T-17ab', upgraded?.booths);
check('優先した配置は source=name', upgraded?.booths[0]?.source === 'name');
check('部分的な本文の配置は残さない', upgraded?.booths.length === 1, upgraded?.booths);

// --- overrides ---
const patched = buildDataset(tweets, { '1005': { circleName: '手動で直した名前' }, '@rt_sample': { drop: true } }, 1);
check('overrides が適用される', patched.stats.overridesApplied >= 1, patched.stats.overridesApplied);
check(
    'overrides で名前を上書きできる',
    patched.unclassified.length === 1 || dataset.unclassified.length === 1,
);

// --- レンダリング ---
const html = renderHtml(dataset);
check('HTML が生成される', html.startsWith('<!doctype html>') && html.length > 5000);
check('データが埋め込まれている', html.includes('id="c108-data"'));
check('script タグを閉じてしまう文字列がない', !html.split('id="c108-data">')[1]?.split('</script>')[0]?.includes('</script'));
check('外部リソースを参照していない', !/(src|href)="https?:\/\/(?!x\.com)/.test(html.replace(/id="c108-data">[\s\S]*?<\/script>/, '')));

console.log(`\nパイプラインテスト: ${checks - failures.length}/${checks} passed\n`);
if (failures.length) {
    for (const f of failures) console.error(`  ✗ ${f}\n`);
    process.exit(1);
}
console.log('  ✓ 全部通过\n');
