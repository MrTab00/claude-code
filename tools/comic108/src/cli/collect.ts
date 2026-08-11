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

console.log(`
採集開始
  接続先     ${collectConfig.cdpEndpoint}${autoLaunch ? ' (必要なら Chrome を自動起動)' : ''}
  プロファイル ${PROFILE_DIR}
  キーワード  ${queries.length} 件
  上限       1 キーワードあたり ${collectConfig.maxTweetsPerQuery} 件
  スクロール  ${collectConfig.autoScroll ? '自動' : '手動'}
`);

try {
    const results = await collectAll(queries, autoLaunch);
    const tweets = results.reduce((n, r) => n + r.tweets, 0);
    const captures = results.reduce((n, r) => n + r.captures, 0);

    console.log(`\n採集完了: 応答 ${captures} 件 / 述べツイート ${tweets} 件\n  -> ${paths.raw}\n`);

    if (captures === 0) {
        // 黙って 0 件で終わるのが一番たちが悪いので、原因の候補を出す
        console.log(
            [
                '応答を 1 件も捕獲できませんでした。考えられる原因:',
                '  - X にログインできていない (検索結果が表示されない)',
                '  - キーワードに該当するツイートが無い',
                '  - X 側の GraphQL operation 名が変わった',
                `    その場合は config.ts の collect.operations を見直してください。`,
                '',
            ].join('\n'),
        );
    } else {
        console.log('次: bun run parse\n');
    }
} catch (err) {
    console.error(`\n${(err as Error).message}\n`);
    process.exit(1);
}
