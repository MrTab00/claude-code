/**
 * 采集: 连接已登录的 Chrome, 把搜索结果页自己发出的 GraphQL 响应存下来。
 *
 *   bun run collect                       config.ts 里的全部关键词
 *   bun run collect "#C108 お品書き"       只跑指定关键词
 *   bun run collect --no-launch           Chrome を自動起動しない(自分で起動済みの場合)
 *   bun run collect --no-window           期間で切らず 1 キーワード 1 回だけ検索する(速いが取りこぼす)
 *   bun run collect --from=2026-07-01     探す期間の始め
 *   bun run collect --to=2026-08-18       探す期間の終わり
 *   bun run collect --max=200             1 回の検索の上限(試し撃ち用)
 */

import { collect as collectConfig, paths } from '../../config';
import { collectAll, defaultRange, splitRange } from '../collect/cdp';
import { PROFILE_DIR } from '../collect/launch';

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const queries = (args.length > 0 ? args : collectConfig.queries).map((q) => q.trim()).filter(Boolean);
const autoLaunch = !flags.includes('--no-launch');

/*
 * 壊れたキーワードで走り出さない。
 *
 * シェルは # をコメント開始として扱うことがあり、`bun run collect "#C108 お品書き"` の
 * 引用が外れると「#」だけが残る。そのまま走ると 1 時間かけて 0 件を採ってくる。
 * 記号だけ・1 文字だけのキーワードはここで止めて、何が起きたかを書く。
 */
const junk = queries.filter((q) => q.replace(/[#＃"'“”\s]/g, '').length < 2);
if (junk.length) {
    console.error(`
検索できないキーワードが混じっています: ${junk.map((q) => JSON.stringify(q)).join(', ')}

シェルが引用符を外して # 以降を落とした可能性が高いです。
キーワードに # は要りません —— X は本文の語もハッシュタグも同じ語として索引するので、
「C108 お品書き」で「#C108」の投稿も本文に書いただけの投稿も両方拾えます(こちらの方が広い)。

  bun run collect                    config.ts の全キーワード(これが一番確実)
  bun run collect 'C108 お品書き'     1 つだけ指定する場合
`);
    process.exit(1);
}

const useWindows = !flags.includes('--no-window') && collectConfig.window.enabled;
const from = flags.find((f) => f.startsWith('--from='))?.split('=')[1];
const to = flags.find((f) => f.startsWith('--to='))?.split('=')[1];

const range = { ...defaultRange() };
if (collectConfig.window.from) range.from = collectConfig.window.from;
if (collectConfig.window.to) range.to = collectConfig.window.to;
if (from) range.from = from;
if (to) range.to = to;

const maxFlag = flags.find((f) => f.startsWith('--max='))?.split('=')[1];
const maxTweets = maxFlag ? Number(maxFlag) : collectConfig.maxTweetsPerQuery;
if (Number.isNaN(maxTweets) || maxTweets < 1) {
    console.error('--max= には 1 以上の数値を指定してください');
    process.exit(1);
}

const windows = useWindows ? splitRange(range.from, range.to, collectConfig.window.initialDays).length : 1;

console.log(`
採集開始
  接続先     ${collectConfig.cdpEndpoint}${autoLaunch ? ' (必要なら Chrome を自動起動)' : ''}
  プロファイル ${PROFILE_DIR}
  キーワード  ${queries.length} 件
${queries.map((q) => `    ・ ${q}`).join('\n')}
  期間       ${
      useWindows
          ? `${range.from} 〜 ${range.to} を ${windows} 期間に分けて / 全 ${queries.length * windows} 回から開始`
          : '区切らない (--no-window)'
  }
  上限       1 回の検索あたり ${maxTweets} 件${useWindows ? '(達したらその期間を半分に割って掘り直す)' : ''}
  スクロール  ${collectConfig.autoScroll ? '自動' : '手動'}
${
    useWindows
        ? '\n  X の検索は 1 回でどこまで遡れるかに上限があります。期間を切って何度も引き、\n' +
          '  上限に当たった期間だけをさらに割って掘るので、時間はかかりますが取りこぼしが減ります。\n' +
          '  急ぐときは --no-window、範囲を狭めるときは --from= / --to= を使ってください。\n'
        : ''
}`);

try {
    const results = await collectAll(queries, { autoLaunch, maxTweets, useWindows, from, to });
    const tweets = results.reduce((n, r) => n + r.tweets, 0);
    const unique = results.reduce((n, r) => n + r.newTweets, 0);
    const captures = results.reduce((n, r) => n + r.captures, 0);
    const httpErrors = results.reduce((n, r) => n + r.httpErrors, 0);
    const rateLimited = results.some((r) => r.lastErrorStatus === 429);

    console.log(
        `\n採集完了: ${results.length} 回検索 / 応答 ${captures} 件 / 述べ ${tweets} 件 / 重複を除いて ${unique} 件` +
            `\n  -> ${paths.raw}\n`,
    );

    // レート制限で終わった検索は、その期間を採り終えていない
    const cutShort = results.filter((r) => r.rateLimited).length;
    if (cutShort) {
        console.log(
            `${cutShort} 回の検索がレート制限で切れています。X の検索は 15 分ごとの回数制限があり、\n` +
                'そこに当たると結果が返らなくなります(枯れたわけではありません)。\n' +
                '15 分ほど置いてから、同じ期間を --from= / --to= で指定して引き直してください。\n',
        );
    }

    // 上限で打ち切られたまま終わった検索が残っているなら、まだ奥がある
    const stillCapped = results.filter((r) => r.hitCap).length;
    if (stillCapped) {
        console.log(
            `${stillCapped} 回の検索が上限に達したまま終わっています。` +
                `config.ts の window.maxWindowsPerQuery を上げるか、--from= / --to= でその期間だけ掘り直せます。\n`,
        );
    }

    // 何も採れなかったキーワードは、理由まで書かないと調べようがない
    const empty = results.filter((r) => r.captures === 0);
    if (empty.length) {
        console.log('応答が 0 件だったキーワード:');
        for (const r of empty) {
            const why = r.httpErrors
                ? `HTTP ${r.lastErrorStatus ?? 'エラー'} が ${r.httpErrors} 件 —— ${r.lastErrorStatus === 429 ? 'レート制限(15 分待てば回復)' : 'サーバ側のエラー'}`
                : '該当するツイートが無かった可能性が高い';
            console.log(`  - ${r.query}: ${why}`);
        }
        console.log('');
    }

    if (rateLimited) {
        console.log(
            [
                'レート制限(429)を受けています。しばらく置いてから、',
                '残りのキーワードだけを指定して再実行してください:',
                "  bun run collect 'C108 コスプレ'",
                'data/raw は積み上がるので、あとから足しても parse がまとめて扱います。',
                '',
            ].join('\n'),
        );
    } else if (captures === 0) {
        console.log(
            [
                '応答を 1 件も捕獲できませんでした。考えられる原因:',
                '  - X にログインできていない (検索結果が表示されない)',
                '  - キーワードに該当するツイートが無い',
                '  - X 側の GraphQL operation 名が変わった',
                '    その場合は config.ts の collect.operations を見直してください。',
                '',
            ].join('\n'),
        );
    }

    if (captures > 0) console.log('次: bun run parse\n');
    if (httpErrors && !rateLimited) console.log(`※ HTTP エラー ${httpErrors} 件を無視しました\n`);
} catch (err) {
    console.error(`\n${(err as Error).message}\n`);
    process.exit(1);
}
