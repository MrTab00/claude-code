/**
 * 极小的 Chrome DevTools Protocol 客户端。零依赖。
 *
 * 为什么不用 Playwright: 它打包的 WebSocket 客户端在 Bun 下连不上 CDP 端点(connectOverCDP 挂起),
 * 而 Bun 原生的 WebSocket 直接就能连。我们需要的功能只有「开标签页 / 导航 / 滚动 / 读响应体」这几件,
 * 直接说 CDP 反而更短, 也让整个工具不需要任何 npm 依赖。
 */

export type CdpParams = Record<string, unknown>;
export type CdpEventHandler = (params: CdpParams, sessionId?: string) => void;

export interface CdpConnection {
    send<T = CdpParams>(method: string, params?: CdpParams, sessionId?: string): Promise<T>;
    /** 注册事件监听, 返回取消函数 */
    on(method: string, handler: CdpEventHandler): () => void;
    close(): void;
}

interface Message {
    id?: number;
    method?: string;
    params?: CdpParams;
    sessionId?: string;
    result?: CdpParams;
    error?: { message: string };
}

/** http://127.0.0.1:9222 -> ws://.../devtools/browser/<uuid> */
async function resolveWebSocketUrl(endpoint: string): Promise<string> {
    if (endpoint.startsWith('ws://') || endpoint.startsWith('wss://')) return endpoint;

    // Chrome は Host ヘッダが localhost 以外だと拒否することがあるので 127.0.0.1 に寄せる
    const base = endpoint.replace('://localhost', '://127.0.0.1').replace(/\/+$/, '');
    const res = await fetch(`${base}/json/version`);
    if (!res.ok) throw new Error(`DevTools エンドポイントが応答しません: ${base}/json/version (${res.status})`);

    const info = (await res.json()) as { webSocketDebuggerUrl?: string };
    if (!info.webSocketDebuggerUrl) throw new Error(`webSocketDebuggerUrl が取得できません: ${base}`);
    return info.webSocketDebuggerUrl;
}

export async function connectCdp(endpoint: string, timeoutMs = 15000): Promise<CdpConnection> {
    const wsUrl = await resolveWebSocketUrl(endpoint);
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('WebSocket の接続がタイムアウトしました')), timeoutMs);
        ws.onopen = () => {
            clearTimeout(timer);
            resolve();
        };
        ws.onerror = () => {
            clearTimeout(timer);
            reject(new Error(`WebSocket に接続できません: ${wsUrl}`));
        };
    });

    let nextId = 0;
    const pending = new Map<number, { resolve: (v: CdpParams) => void; reject: (e: Error) => void }>();
    const handlers = new Map<string, Set<CdpEventHandler>>();

    ws.onmessage = (event) => {
        let msg: Message;
        try {
            msg = JSON.parse(String(event.data));
        } catch {
            return;
        }

        if (typeof msg.id === 'number') {
            const slot = pending.get(msg.id);
            if (!slot) return;
            pending.delete(msg.id);
            if (msg.error) slot.reject(new Error(`${msg.error.message}`));
            else slot.resolve(msg.result ?? {});
            return;
        }

        if (msg.method) {
            for (const h of handlers.get(msg.method) ?? []) h(msg.params ?? {}, msg.sessionId);
        }
    };

    ws.onclose = () => {
        for (const { reject } of pending.values()) reject(new Error('CDP 接続が閉じられました'));
        pending.clear();
    };

    return {
        send<T = CdpParams>(method: string, params: CdpParams = {}, sessionId?: string): Promise<T> {
            const id = ++nextId;
            return new Promise<T>((resolve, reject) => {
                pending.set(id, { resolve: resolve as (v: CdpParams) => void, reject });
                ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
            });
        },
        on(method: string, handler: CdpEventHandler) {
            if (!handlers.has(method)) handlers.set(method, new Set());
            handlers.get(method)!.add(handler);
            return () => handlers.get(method)?.delete(handler);
        },
        close() {
            ws.close();
        },
    };
}

export interface Viewport {
    width: number;
    height: number;
}

export interface CdpPage {
    targetId: string;
    sessionId: string;
    navigate(url: string): Promise<void>;
    evaluate<T = unknown>(expression: string): Promise<T>;
    url(): Promise<string>;
    /** 実ウィンドウとは無関係に描画上の視口サイズを決める。縦を大きく取ると走査が速い */
    setViewport(viewport: Viewport): Promise<void>;
    close(): Promise<void>;
}

/**
 * 在已连接的浏览器里开一个新标签页。
 * 用户自身のブラウザなので、その profile の Cookie(= X のログイン状態)をそのまま引き継ぐ。
 */
export async function openPage(conn: CdpConnection, viewport?: Viewport): Promise<CdpPage> {
    const { targetId } = await conn.send<{ targetId: string }>('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await conn.send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });

    await conn.send('Page.enable', {}, sessionId);
    await conn.send('Network.enable', {}, sessionId);
    await conn.send('Runtime.enable', {}, sessionId);

    if (viewport) {
        await conn.send(
            'Emulation.setDeviceMetricsOverride',
            { ...viewport, deviceScaleFactor: 1, mobile: false },
            sessionId,
        );
    }

    return {
        targetId,
        sessionId,

        async setViewport(v: Viewport) {
            await conn.send('Emulation.setDeviceMetricsOverride', { ...v, deviceScaleFactor: 1, mobile: false }, sessionId);
        },

        async navigate(url: string) {
            const loaded = new Promise<void>((resolve) => {
                const off = conn.on('Page.loadEventFired', (_p, sid) => {
                    if (sid === sessionId) {
                        off();
                        resolve();
                    }
                });
                // load が来ない場合もあるので上限を切る
                setTimeout(() => {
                    off();
                    resolve();
                }, 20000);
            });
            await conn.send('Page.navigate', { url }, sessionId);
            await loaded;
        },

        async evaluate<T>(expression: string): Promise<T> {
            const res = await conn.send<{ result?: { value?: T }; exceptionDetails?: { text: string } }>(
                'Runtime.evaluate',
                { expression, returnByValue: true, awaitPromise: true },
                sessionId,
            );
            if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
            return res.result?.value as T;
        },

        async url() {
            return this.evaluate<string>('location.href');
        },

        async close() {
            await conn.send('Target.closeTarget', { targetId }).catch(() => {});
        },
    };
}

/** 读取某个请求的响应体。base64 で返ってくることがあるので復号する */
export async function getResponseBody(conn: CdpConnection, requestId: string, sessionId: string): Promise<string | null> {
    try {
        const res = await conn.send<{ body: string; base64Encoded: boolean }>(
            'Network.getResponseBody',
            { requestId },
            sessionId,
        );
        if (!res.body) return null;
        return res.base64Encoded ? Buffer.from(res.body, 'base64').toString('utf8') : res.body;
    } catch {
        // 応答本体が既に破棄されている場合。黙って諦める
        return null;
    }
}
