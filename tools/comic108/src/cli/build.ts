/**
 * data/dataset.json -> dist/c108.html
 *
 *   bun run build                 热链图片, 真正的单文件
 *   bun run build --save-media    图片下载到 dist/media/, HTML 用相对路径引用(推荐)
 *   bun run build --embed-media   缩略图 base64 内联, 单文件但体积大
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { paths } from '../../config';
import { embedMedia, renderHtml, saveMedia } from '../render/build-html';
import type { Dataset } from '../types';

if (!existsSync(paths.dataset)) {
    console.error(`dataset.json がありません: ${paths.dataset}\n先に bun run parse を実行してください。`);
    process.exit(1);
}

const dataset = JSON.parse(await readFile(paths.dataset, 'utf8')) as Dataset;

if (process.argv.includes('--save-media')) {
    console.log('画像を dist/media/ に保存します...');
    const { ok, failed } = await saveMedia(dataset, join(paths.dist, 'media'));
    console.log(`  保存 ${ok} 件${failed ? ` / 失敗 ${failed} 件(ホットリンクのまま)` : ''}`);
}

if (process.argv.includes('--embed-media')) {
    console.log('画像をダウンロードして埋め込みます...');
    const { ok, failed } = await embedMedia(dataset);
    console.log(`  埋め込み ${ok} 件${failed ? ` / 失敗 ${failed} 件(ホットリンクのまま)` : ''}`);
}

await mkdir(paths.dist, { recursive: true });
await writeFile(paths.html, renderHtml(dataset), 'utf8');

const { size } = await stat(paths.html);
console.log(`
出力完了: ${paths.html}
  ${(size / 1024).toFixed(0)} KB · サークル ${dataset.stats.circles} 件 / コスプレ ${dataset.stats.cosplayers} 件
`);
