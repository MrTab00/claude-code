/**
 * 采集: 连接已登录的 Chrome, 把搜索结果页自己发出的 GraphQL 响应存下来。
 *
 *   bun run collect                    config.ts 里的全部关键词
 *   bun run collect "#C108 お品書き"    只跑指定关键词
 *   bun run collect --no-launch        Chrome を自動起動しない(自分で起動済みの場合)
 */

import { collect as collectConfig, paths } from '../../config';
import { collectAll } from '../collect/cdp';
import { PROFILE_DIR } from '../collect/launch';

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const queries = args.length > 0 ? args : collectConfig.queries;
const autoLaunch = !flags.includes('--no-launch');

const maxFlag = flags.find((f) => f.startsWith('--max='))?.split('=')[1];
const maxTweets = maxFlag ? Number(maxFlag) : collectConfig.maxTweetsPerQuery;
if (Number.isNaN(maxTweets) || maxTweets < 1) {
    console.error('--max= には 1 以上の数値を指定してください');
    process.exit(1);
}

console.log(`
採集開始
  接続先     ${collectConfig.cdpEndpoint}${autoLaunch ? ' (必要なら Chrome を自動起動)' : ''}
  プロファイル ${PROFILE_DIR}
  キーワード  ${queries.length} 件
  上限       1 キーワードあたり ${maxTweets} 件
  スクロール  ${collectConfig.autoScroll ? '自動' : '手動'}
`);

try {
    const results = await collectAll(queries, { autoLaunch, maxTweets });
    const tweets = results.reduce((n, r) => n + r.tweets, 0);
    const captures = results.reduce((n, r) => n + r.captures, 0);
    const httpErrors = results.reduce((n, r) => n + r.httpErrors, 0);
    const rateLimited = results.some((r) => r.lastErrorStatus === 429);

    console.log(`\n採集完了: 応答 ${captures} 件 / 述べツイート ${tweets} 件\n  -> ${paths.raw}\n`);

    // 何も採れなかったキーワードは、理由まで書かないと調べようがない
    const empty = results.filter((r) => r.captures === 0);
    if (empty.length) {
        console.log('応答が 0 件だったキーワード:');
        for (const r of empty) {
            const why = r.httpErrors
                ? `HTTP ${r.lastErrorStatus ?? 'エラー'} が ${r.httpErrors} 件 —— レート制限の可能性`
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
                '  bun run collect "#C108 コスプレ"',
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
