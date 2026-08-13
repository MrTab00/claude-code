/**
 * Cloudflare Pages へ公開する。
 *
 *   bun run deploy            # dist/site を組んで wrangler で上げる
 *   bun run deploy --dry-run  # dist/site を組むところまで(中身の確認用)
 *
 * dist/ には作業用の HTML(デモ・Artifact 版)も入っているので、そのまま公開すると
 * ダミーデータのページまで一緒に上がる。公開するものだけを dist/site に入れ直す。
 */

import { existsSync } from 'node:fs';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { event } from '../../config';

const root = join(import.meta.dir, '../..');
const built = join(root, 'dist/c108.html');
const site = join(root, 'dist/site');
const dry = process.argv.includes('--dry-run');

/** wrangler の Pages プロジェクト名。公開 URL は https://<これ>.pages.dev */
const PROJECT = process.env.C108_PAGES_PROJECT ?? 'c108-map';

/*
 * 本番として上げるブランチ名。
 *
 * --branch を渡さないと wrangler は git の現在のブランチ名を使う。それが
 * プロジェクトの production branch と違うと preview 扱いになり、上げたつもりでも
 * <プロジェクト>.pages.dev は「Nothing is here yet」のままになる。
 * ここで作業ブランチと切り離しておく。
 */
const BRANCH = process.env.C108_PAGES_BRANCH ?? 'main';

if (!existsSync(built)) {
    console.error('dist/c108.html が無い。先に bun run build を実行してください。');
    process.exit(1);
}

const html = await Bun.file(built).text();

/*
 * ダミーデータのまま公開する事故を止める。
 * 生成データのサークルは screen_name が circle_0 形式で、原文リンクも status/1 になる。
 * 一度公開してしまうと検索に拾われるので、上げる前にここで弾く。
 */
const fake = /"screenName":"circle_\d+"/.test(html) || /x\.com\/[^"]+\/status\/1"/.test(html);
if (fake && !process.argv.includes('--allow-test-data')) {
    console.error(
        'テスト用のダミーデータが入ったまま公開しようとしています。\n' +
        '  実データで bun run parse && bun run build をやり直してください。\n' +
        '  承知のうえで上げるなら --allow-test-data を付けてください。',
    );
    process.exit(1);
}

const circles = html.match(/"circles":(\d+)/)?.[1] ?? '?';
// html.length は UTF-16 の数。日本語は 1 文字 3 バイトなので、実際に転送される量とは違う
const size = (Bun.file(built).size / 1024 / 1024).toFixed(2);

await rm(site, { recursive: true, force: true });
await mkdir(site, { recursive: true });
await writeFile(join(site, 'index.html'), html);

/*
 * 中身は 1 ファイルに全部入っていて、更新するたび丸ごと変わる。
 * 長く持たせると当日の差し替えが届かないので、毎回確認させる(304 で実質的な転送は起きない)。
 */
await writeFile(join(site, '_headers'), [
    '/*',
    '  Cache-Control: public, max-age=0, must-revalidate',
    '  X-Content-Type-Options: nosniff',
    // お品書き画像は pbs.twimg.com への直リンク。no-referrer にすると、
    // 向こうが将来リファラを見るようになったときに画像だけ落ちる。既定と同じ強さに留める
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '',
].join('\n'));

await writeFile(join(site, 'robots.txt'), 'User-agent: *\nAllow: /\n');

/*
 * build --save-media で組むと、画像は dist/media/ に落ちて HTML からは相対パスで参照される。
 * index.html だけ上げると、そのぶんの画像が全部リンク切れになる。参照していれば一緒に運ぶ。
 */
if (/"media\//.test(html) || /src="media\//.test(html)) {
    const media = join(root, 'dist/media');
    if (!existsSync(media)) {
        console.error('HTML が media/ を参照しているのに dist/media/ がありません。build をやり直してください。');
        process.exit(1);
    }
    await cp(media, join(site, 'media'), { recursive: true });
    console.log('dist/media/ も一緒に公開します');
}

const gz = Bun.gzipSync(new TextEncoder().encode(html)).length;
console.log(`dist/site を組みました — ${size} MB (gzip ${(gz / 1024 / 1024).toFixed(2)} MB) / サークル ${circles} 件`);

if (dry) {
    console.log('--dry-run なのでここまで。中身を見てから deploy してください。');
    process.exit(0);
}

/*
 * wrangler は npx 経由で呼ぶ。初回は `npx wrangler login` でブラウザ認証が要る。
 * CI から回すときは CLOUDFLARE_API_TOKEN と CLOUDFLARE_ACCOUNT_ID を環境変数で渡す。
 */
console.log(`\nCloudflare Pages へ公開します (プロジェクト: ${PROJECT} / ブランチ: ${BRANCH})`);
const proc = Bun.spawn(
    ['npx', '--yes', 'wrangler@latest', 'pages', 'deploy', site,
     '--project-name', PROJECT, '--branch', BRANCH, '--commit-dirty=true'],
    { stdout: 'inherit', stderr: 'inherit', stdin: 'inherit', cwd: root },
);
const code = await proc.exited;
if (code !== 0) {
    console.error(
        '\n公開に失敗しました。よくある原因:\n' +
        '  1. 未ログイン        → npx wrangler login\n' +
        `  2. プロジェクトが無い → npx wrangler pages project create ${PROJECT} --production-branch ${BRANCH}\n` +
        '  3. Node が古い       → wrangler は Node 18 以上が要ります',
    );
    process.exit(code);
}
/*
 * 本番のブランチ名がプロジェクト側の設定と食い違うと、成功と表示されたまま preview に
 * 入る。<プロジェクト>.pages.dev を開いて「Nothing is here yet」が出るのがこの状態。
 */
console.log(`\n公開しました: https://${PROJECT}.pages.dev`);
console.log(`  本番として上げたブランチ: ${BRANCH}`);
console.log(`  反映されない場合は、プロジェクトの production branch がこの名前か確かめてください:`);
console.log(`    npx wrangler pages deployment list --project-name ${PROJECT}`);
console.log(`イベント: ${event.name}`);
