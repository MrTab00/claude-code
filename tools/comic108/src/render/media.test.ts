/**
 * 画像の保存・埋め込みの自測。ローカルにダミーの画像サーバを立てるので、
 * 外部ネットワークにも X にも触らない。
 *   bun run test:media
 */

import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildDataset } from '../parse/classify';
import { embedMedia, saveMedia } from './build-html';

const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
);

const failures: string[] = [];
let checks = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
    checks++;
    if (!cond) failures.push(`${name}${detail === undefined ? '' : `\n    ${JSON.stringify(detail)}`}`);
};

let fetched = 0;
const server = Bun.serve({
    port: 0,
    fetch(req) {
        if (new URL(req.url).pathname === '/media/gone.jpg') return new Response('nope', { status: 404 });
        fetched++;
        return new Response(PNG, { headers: { 'content-type': 'image/png' } });
    },
});
const origin = `http://127.0.0.1:${server.port}`;

const makeDataset = () =>
    buildDataset(
        [
            {
                id: '1',
                text: 'C108 2日目 東A-12b お品書きです',
                screenName: 'a',
                displayName: 'A',
                createdAt: '2026-08-10T00:00:00Z',
                hashtags: [],
                isRetweet: false,
                url: 'https://x.com/a/status/1',
                media: [
                    { url: `${origin}/media/ok1.jpg`, type: 'photo' as const },
                    { url: `${origin}/media/ok2.jpg`, type: 'photo' as const },
                    // 同じお品書きを繰り返し投稿するサークルは普通にいる
                    { url: `${origin}/media/ok1.jpg`, type: 'photo' as const },
                    { url: `${origin}/media/gone.jpg`, type: 'photo' as const },
                ],
            },
        ],
        {},
        1,
    );

const workDir = await mkdtemp(join(tmpdir(), 'c108-media-'));

try {
    // --- ローカル保存 ---
    const saved = makeDataset();
    const result = await saveMedia(saved, join(workDir, 'media'));
    check('取得できた 3 件を保存', result.ok === 3, result);
    check('404 の 1 件は失敗として数える', result.failed === 1, result);

    const files = (await readdir(join(workDir, 'media'))).sort();
    check('重複を除いて 2 ファイル', files.length === 2, files);
    check('中身が空でない', (await stat(join(workDir, 'media', files[0]))).size > 0);

    const paths = saved.circles[0].media.map((m) => m.local);
    check('相対パスが入る', paths[0] === 'media/ok1.jpg', paths);
    check('同じ URL は同じパスを指す', paths[0] === paths[2], paths);
    check('失敗した画像はホットリンクのまま', paths[3] === undefined, paths);

    // 結果ではなく Promise をキャッシュしないと、並列ワーカーが同じ画像を二重取得する
    check('重複 URL の取得は 1 回だけ', fetched === 2, { fetched });

    // --- base64 埋め込み ---
    fetched = 0;
    const embedded = makeDataset();
    const emb = await embedMedia(embedded);
    check('埋め込みも 3 件成功', emb.ok === 3, emb);
    check('data URI になっている', embedded.circles[0].media[0].dataUri?.startsWith('data:image/png;base64,') === true);
    check('埋め込みでも重複取得しない', fetched === 2, { fetched });
} finally {
    server.stop(true);
    await rm(workDir, { recursive: true, force: true });
}

console.log(`\n画像テスト: ${checks - failures.length}/${checks} passed\n`);
if (failures.length) {
    for (const f of failures) console.error(`  ✗ ${f}\n`);
    process.exit(1);
}
console.log('  ✓ 全部通过\n');
