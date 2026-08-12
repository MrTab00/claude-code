/**
 * dataset.json -> dist/c108.html
 *
 * 既定はホットリンク。産物は本当に 1 ファイルで済むが、X 側で消えたら見られなくなる。
 *   --save-media   dist/media/ に保存して相対パス参照。数百枚規模の実運用向け
 *   --embed-media  base64 で埋め込み。1 ファイルのまま持ち歩けるが巨大になる
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Dataset, Media } from '../types';
import { renderHtml } from './template';

const CONCURRENCY = 6;

function allPhotos(dataset: Dataset): Media[] {
    return [...dataset.circles, ...dataset.cosplayers]
        .flatMap((e) => e.media)
        .filter((m) => m.type === 'photo');
}

/** お品書きは配置番号を読む対象なので large を取る */
const sourceUrl = (url: string) => (url.includes('pbs.twimg.com') ? `${url}?name=large` : url);

/**
 * 各 URL を 1 回だけ取得しながら並列に処理する。
 *
 * 結果ではなく Promise をキャッシュするのが要点 —— 完了後に記録する作りだと、
 * 同じ画像を複数のワーカーが同時に掴んだときに二重取得になる。
 * 同じお品書きを何度も投稿するサークルは珍しくないので、実データでは普通に起きる。
 */
async function eachPhoto(
    photos: Media[],
    handle: (url: string) => Promise<string | null>,
    apply: (media: Media, value: string) => void,
): Promise<{ ok: number; failed: number }> {
    const inflight = new Map<string, Promise<string | null>>();
    let ok = 0;
    let failed = 0;
    let cursor = 0;

    const worker = async () => {
        while (cursor < photos.length) {
            const m = photos[cursor++];

            let pending = inflight.get(m.url);
            if (!pending) {
                pending = handle(m.url);
                inflight.set(m.url, pending);
            }

            const value = await pending;
            if (value) {
                apply(m, value);
                ok++;
            } else {
                failed++;
            }
            if ((ok + failed) % 25 === 0) process.stdout.write(`\r  ${ok + failed}/${photos.length}`);
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (photos.length) process.stdout.write(`\r  ${ok + failed}/${photos.length}\n`);
    return { ok, failed };
}

/** 画像を dist/media/ に保存し、HTML からは相対パスで参照する */
export async function saveMedia(dataset: Dataset, mediaDir: string): Promise<{ ok: number; failed: number }> {
    await mkdir(mediaDir, { recursive: true });

    return eachPhoto(
        allPhotos(dataset),
        async (url) => {
            // pbs.twimg.com のファイル名はそれ自体が一意なのでそのまま使える
            const name = (url.split('/').pop() ?? '').replace(/[^\w.-]/g, '') || `${Date.now()}.jpg`;
            try {
                const res = await fetch(sourceUrl(url));
                if (!res.ok) return null;
                await writeFile(join(mediaDir, name), Buffer.from(await res.arrayBuffer()));
                return `media/${name}`;
            } catch {
                return null;
            }
        },
        (m, path) => {
            m.local = path;
        },
    );
}

/** 画像を base64 で HTML に埋め込む。取得に失敗したものはホットリンクのまま残す */
export async function embedMedia(dataset: Dataset): Promise<{ ok: number; failed: number }> {
    return eachPhoto(
        allPhotos(dataset),
        async (url) => {
            try {
                const res = await fetch(url.includes('pbs.twimg.com') ? `${url}?name=small` : url);
                if (!res.ok) return null;
                const buf = Buffer.from(await res.arrayBuffer());
                return `data:${res.headers.get('content-type') ?? 'image/jpeg'};base64,${buf.toString('base64')}`;
            } catch {
                return null;
            }
        },
        (m, uri) => {
            m.dataUri = uri;
        },
    );
}

export { renderHtml };
