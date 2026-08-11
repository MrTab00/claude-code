/**
 * dataset.json -> dist/c108.html
 *
 * 默认热链 pbs.twimg.com, 产物是真正的单文件, 在线即可看图。
 * --embed-media 会把缩略图下载下来 base64 内联, 产出离线也能看的自包含版本(体积会大很多)。
 */

import type { Dataset, Media } from '../types';
import { renderHtml } from './template';

const CONCURRENCY = 6;

function allMedia(dataset: Dataset): Media[] {
    return [...dataset.circles, ...dataset.cosplayers, ...dataset.unclassified].flatMap((e) => e.media);
}

async function fetchAsDataUri(url: string): Promise<string | null> {
    try {
        const res = await fetch(url.includes('pbs.twimg.com') ? `${url}?name=small` : url);
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        const type = res.headers.get('content-type') ?? 'image/jpeg';
        return `data:${type};base64,${buf.toString('base64')}`;
    } catch {
        return null;
    }
}

/** 就地给每个 media 填上 dataUri。失败的保持热链, 不影响出图 */
export async function embedMedia(dataset: Dataset): Promise<{ ok: number; failed: number }> {
    const media = allMedia(dataset).filter((m) => m.type === 'photo');
    const cache = new Map<string, string | null>();
    let ok = 0;
    let failed = 0;
    let cursor = 0;

    const worker = async () => {
        while (cursor < media.length) {
            const m = media[cursor++];
            if (!cache.has(m.url)) cache.set(m.url, await fetchAsDataUri(m.url));
            const uri = cache.get(m.url);
            if (uri) {
                m.dataUri = uri;
                ok++;
            } else {
                failed++;
            }
            if ((ok + failed) % 25 === 0) process.stdout.write(`\r  画像取得 ${ok + failed}/${media.length}`);
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (media.length) process.stdout.write(`\r  画像取得 ${ok + failed}/${media.length}\n`);
    return { ok, failed };
}

export { renderHtml };
