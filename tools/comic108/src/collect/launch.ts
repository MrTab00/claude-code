/**
 * Chrome の自動起動。
 *
 * 手で --remote-debugging-port と --user-data-dir を打つのが初回の一番の詰まりどころなので、
 * 繋がらなければこちらで起動する。プロファイルはプロジェクト配下の専用ディレクトリを使う:
 * Chrome 136 以降は既定プロファイルでのリモートデバッグを拒否するため、これは必須。
 * ログイン状態はこのディレクトリに残るので、X にログインするのは初回の一度だけで済む。
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { paths } from '../../config';

/** 起動に使うプロファイル。ここに X のログインが残る */
export const PROFILE_DIR = process.env.C108_PROFILE_DIR || join(paths.root, '.chrome-profile');

function candidates(): string[] {
    const env = process.env.CHROME_PATH;
    const home = process.env.HOME ?? '';
    const localAppData = process.env.LOCALAPPDATA ?? '';
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';

    const byPlatform: Record<string, string[]> = {
        darwin: [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            `${home}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
            '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ],
        win32: [
            `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
            `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
            `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
            `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
            `${programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe`,
        ],
        linux: [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
            '/opt/pw-browsers/chromium',
        ],
    };

    return [env, ...(byPlatform[process.platform] ?? byPlatform.linux)].filter(Boolean) as string[];
}

/** インストール済みの Chrome を探す。見つからなければ null */
export function findChrome(): string | null {
    return candidates().find((p) => existsSync(p)) ?? null;
}

/** 手で起動したい人向けのコマンド文字列 */
export function manualCommand(port: number): string {
    const exe = findChrome() ?? 'google-chrome';
    const quoted = exe.includes(' ') ? `"${exe}"` : exe;
    return `${quoted} --remote-debugging-port=${port} --user-data-dir="${PROFILE_DIR}"`;
}

/** DevTools エンドポイントが応答するか */
export async function endpointAlive(endpoint: string): Promise<boolean> {
    const base = endpoint.replace('://localhost', '://127.0.0.1').replace(/\/+$/, '');
    try {
        return (await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(2000) })).ok;
    } catch {
        return false;
    }
}

export interface LaunchOptions {
    endpoint: string;
    /** 画面を出さずに起動する(ログイン済みプロファイルがある場合のみ実用的) */
    headless?: boolean;
    timeoutMs?: number;
}

/**
 * Chrome を起動して DevTools エンドポイントが立ち上がるまで待つ。
 * 起動したプロセスは終了時に殺さない —— 次回の実行がそのまま繋がるようにするため。
 */
export async function launchChrome({ endpoint, headless = false, timeoutMs = 30000 }: LaunchOptions): Promise<string> {
    const exe = findChrome();
    if (!exe) {
        throw new Error(
            'Chrome が見つかりませんでした。\n' +
                'Google Chrome をインストールするか、CHROME_PATH で実行ファイルを指定してください:\n' +
                '  CHROME_PATH="/path/to/chrome" bun run collect',
        );
    }

    const port = new URL(endpoint.replace('://localhost', '://127.0.0.1')).port || '9222';

    // 追加フラグの逃げ道。root のコンテナ内では --no-sandbox が要る等、環境固有の事情があるため。
    // 既定では付けない —— ユーザー自身のプロファイルのサンドボックスを勝手に外すべきではない。
    const extra = (process.env.C108_CHROME_ARGS ?? '').split(' ').filter(Boolean);

    const args = [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${PROFILE_DIR}`,
        '--no-first-run',
        '--no-default-browser-check',
        ...(headless ? ['--headless=new'] : []),
        ...extra,
        'about:blank',
    ];

    const proc = Bun.spawn([exe, ...args], { stdout: 'ignore', stderr: 'ignore' });
    proc.unref?.();

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await endpointAlive(endpoint)) return exe;
        await new Promise((r) => setTimeout(r, 300));
    }

    throw new Error(
        `Chrome は起動しましたが ${endpoint} が応答しません。\n` +
            '別の Chrome が同じプロファイルを使っている可能性があります。\n' +
            'すべての Chrome を終了してからもう一度実行するか、手動で起動してください:\n  ' +
            manualCommand(Number(port)),
    );
}
