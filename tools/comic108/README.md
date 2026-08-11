# C108 サークル / コスプレイヤー 情報まとめツール

把散落在 X 上的 **コミックマーケット108（2026/8/15–16）** 情报抓下来、结构化、汇总成一个可筛选的单文件 HTML。

- **サークル**：摊位配置（`日曜 東A-12b`）、社团名、新刊、价格、お品書き图
- **コスプレイヤー**：角色、作品、出场日、位置、照片

零依赖，只需要 [Bun](https://bun.sh/) 和一个 Chrome。

---

## 为什么不用官方 X API

Free 档没有 search 权限，Basic 档 $200/月，为一次两天的活动不划算。

所以采集走 **CDP（Chrome DevTools Protocol）**：连接你**已经登录的 Chrome**，被动读取页面自己发出的 GraphQL 响应。思路来自 [MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) 的 CDP 模式——不逆向签名，直接复用现成登录态。

X 的场景比它更有利：X 网页前端本身就在调自己的内部 GraphQL 接口，响应里是完整推文 JSON（正文 / 媒体 / 作者 / hashtag 全有），比扒 DOM 干净得多。

**关键点：只被动读，不构造请求。** X 每 2–4 周就轮换一次 GraphQL 的 `doc_id` 和 `features` 参数，所有自己拼请求的爬虫都会周期性失效。页面前端永远知道怎么正确请求自己的接口，我们只是把响应抄一份，所以不受轮换影响。代码里按 **operation 名**（`SearchTimeline` 等）匹配，从不碰会变的 hash。

将来真拿到 API Key，`bun run collect:api` 就能用，解析和渲染一行都不用改。

---

## 快速开始

想先看看产物长什么样，不用采集也不用账号：

```bash
bun run demo     # -> dist/c108-demo.html
```

真正跑一遍——**不用手动开 Chrome，脚本会处理**：

```bash
bun run doctor    # 环境自检（可选，但建议第一次跑）
bun run all       # 采集 -> 解析 -> 出 HTML
```

第一次运行会自动拉起一个 Chrome 窗口。**在那个窗口里登录一次 X，回终端按 Enter**，采集就开始了。登录状态存在项目下的 `.chrome-profile/`，之后再跑就不用登录了。

---

## 关于 Chrome

脚本会自己找到 Chrome（macOS / Windows / Linux 的常见安装路径，也支持 Edge），用 `--remote-debugging-port` 加一个**专用 profile** 启动它。

用专用 profile 不是洁癖——**Chrome 136 之后禁止在默认 profile 上开远程调试**，这是硬性要求。好处是它跟你日常用的 Chrome 完全隔离，互不干扰。

如果你想自己控制：

```bash
bun run collect --no-launch    # 不自动启动，连接你已经开好的 Chrome
```

手动启动的命令 `bun run doctor` 会照着你的系统打印出来。

| 环境变量 | 作用 |
|----------|------|
| `C108_CDP` | 调试端口，默认 `http://127.0.0.1:9222` |
| `CHROME_PATH` | 指定 Chrome 可执行文件 |
| `C108_PROFILE_DIR` | 换一个 profile 目录 |
| `C108_CHROME_ARGS` | 追加启动参数（例如容器里需要 `--no-sandbox`） |

---

## 命令

| 命令 | 作用 |
|------|------|
| `bun run doctor` | 环境自检：Chrome、调试端口、X 登录状态 |
| `bun run collect` | CDP 采集，落 `data/raw/*.jsonl`（需要时自动启动 Chrome） |
| `bun run collect "#C108 お品書き"` | 只跑指定关键词 |
| `bun run collect --max=30` | 限制每个关键词的采集量，用来小样试跑 |
| `bun run collect:api` | 官方 API 采集（需要 `X_BEARER_TOKEN`） |
| `bun run parse` | 解析成 `data/dataset.json`，**纯离线，可反复重跑** |
| `bun run build` | 生成 `dist/c108.html` |
| `bun run build --embed-media` | 图片下载后 base64 内联，离线也能看 |
| `bun run demo` | 用内置样例数据出一份 HTML |
| `bun run test` | 全部自测（不需要联网和账号） |

原始响应落盘后，解析可以离线重跑任意次。**调正则不需要重新采集。**

---

## 人工修正

正则永远做不到 100%。`data/overrides.json` 里的修正优先级最高，重跑 `parse` 不会被冲掉：

```json
{
  "1234567890123456789": {
    "circleName": "正しいサークル名",
    "booths": [
      { "day": 2, "area": "東", "hall": null, "block": "A", "number": 12,
        "ab": "b", "raw": "手動", "display": "2日目 東 A-12b", "confidence": "high" }
    ]
  },
  "@some_account": { "characters": ["キャラ名"] },
  "9999999999999999999": { "drop": true }
}
```

key 可以是推文 id，也可以是 `@用户名`（对该作者全部条目生效）。`drop: true` 整条剔除。

采集漏掉的可以手写补录（`cp data/manual.example.txt data/manual.txt`）：

```
@circle_name https://x.com/circle_name/status/1234567890
C108 2日目 東A-12b で参加します
新刊「タイトル」500円
---
@layer_name
1日目 屋上でコスプレしてました #架空アリス
```

走的是完全相同的解析管线。

---

## 结构

```
config.ts              关键词、日程、CDP 端口、限速、词表
src/
  types.ts             数据结构
  collect/
    cdp-client.ts      极小的 CDP 客户端（零依赖）
    cdp.ts             采集逻辑：挂监听、滚动、落盘
    xapi.ts            官方 API 适配器（预留）
    manual.ts          手动补录
  parse/
    extract.ts         GraphQL JSON -> 推文（递归找 Tweet 节点，不硬编码深路径）
    booth.ts           摊位号解析 ★核心
    classify.ts        分类路由 + 数据集组装 + overrides 合并
    circle.ts          社团字段
    cosplay.ts         角色 / 作品 / 位置
  render/
    template.ts        单文件 HTML 模板
    build-html.ts      图片内联
data/
  raw/*.jsonl          原始响应（可重复解析）
  dataset.json         结构化结果
  overrides.json       人工修正
dist/c108.html         成品
```

三层解耦：采集方式换了，解析和渲染都不用动。

---

## 摊位号解析

推文里的写法极不统一，覆盖这些形式（`src/parse/booth.test.ts` 有全部用例）：

| 写法 | 解析结果 |
|------|---------|
| `東A-12b` | 東 / A / 12 / b |
| `東地区"A"ブロック12b` | 同上 |
| `東４ホール ア-12ab` | 東 / 4ホール / ア / 12 / ab |
| `日曜 東A12b` | 2日目 + 東A-12b |
| `2日目 西け21a` | 2日目 / 西 / け（平假名 block）/ 21 / a |
| `1日目 南1-2ホール` | 只有大区 → 低置信度，标「要確認」 |
| `東Ａ－１２ｂ` | 全角自动归一化 |

日程从 `1日目` / `初日` / `土曜` / `8/15` 等标记推断，就近修饰优先。

**解析不出就标 null，不猜。** 低置信度的结果在 HTML 里有「要確認」「推定」标记，方便你人工过一遍。

---

## 边界，说清楚

- **ToS**：自动化访问 X 违反其服务条款。本工具用你自己的账号、低频率（滚动间隔 1.5–3.5 秒随机）、只读公开内容、不构造 API 请求、**不做任何反检测 / 指纹伪装 / 验证码绕过**。风险不为零（账号可能被限速或限制），是否接受由你决定。想更稳就把 `config.ts` 里的 `autoScroll` 设成 `false`，改成你手动滚、脚本静默捕获。
- **覆盖率不会是 100%**。只能采到搜索结果里出现的推文，X 的搜索本身就有召回限制。这是补充工具，不是权威名录——权威的社团配置数据在官方 Web カタログ。
- **角色名抽取是模糊匹配**。日文自由文本没有稳定结构：hashtag 靠谱，正文靠猜。低置信度会被标出来，`overrides.json` 是补救路径。
- **品书图只做预览展示**，不做 OCR，不调用任何付费 API。

---

## 自测

```bash
bun run test
```

- `test:booth` — 摊位号的全部写法变体
- `test:pipeline` — fixture 响应 → 提取 → 分类 → 数据集 → HTML 全链路
- `test:collect` — 本地起假的 X 前端，带调试端口拉起真 Chrome，走真实 CDP 验证捕获与落盘

都不需要联网，也不需要 X 账号。`test:collect` 找不到 Chrome 时会自动跳过浏览器部分（可用 `CHROME_PATH` 指定）。
