/**
 * 采集: 连接已登录的 Chrome, 把搜索结果页自己发出的 GraphQL 响应存下来。
 *
 *   bun run collect                    config.ts 里的全部关键词
 *   bun run collect "#C108 お品書き"    只跑指定关键词
 */

import { collect as collectConfig, paths } from '../../config';
import { collectAll } from '../collect/cdp';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const queries = args.length > 0 ? args : collectConfig.queries;

console.log(`
採集開始
  接続先   ${collectConfig.cdpEndpoint}
  キーワード ${queries.length} 件
  上限     1 キーワードあたり ${collectConfig.maxTweetsPerQuery} 件
  スクロール ${collectConfig.autoScroll ? '自動' : '手動'}
`);

try {
    const results = await collectAll(queries);
    const tweets = results.reduce((n, r) => n + r.tweets, 0);
    const captures = results.reduce((n, r) => n + r.captures, 0);

    console.log(`
採集完了: 応答 ${captures} 件 / 述べツイート ${tweets} 件
  -> ${paths.raw}

次: bun run parse
`);
} catch (err) {
    console.error(`\n${(err as Error).message}\n`);
    process.exit(1);
}
