/**
 * Comiket 摊位配置(スペース)解析。
 *
 * 配置的书写格式是 日程 + 地区 + ホール + ブロック + 番号 + ab, 但推文里的写法极不统一:
 *   東A-12b / 東地区"A"ブロック12b / 東4ホール ア-12ab / 日曜 東A12b / 2日目 西け21a
 * 地区与 ブロック 的字符集也不同: 東 用英字和片假名, 西/南 用平假名和片假名。
 *
 * 原则: 解析不出就标 null, 不猜。低置信度的结果在 HTML 里会被标记出来, 由 overrides.json 人工补。
 */

import type { AB, Area, Booth, Confidence, Day } from '../types';

/** 片假名 ア-ヺ */
const KATAKANA = '\\u30A1-\\u30FA';
/** 平假名 ぁ-ゖ */
const HIRAGANA = '\\u3041-\\u3096';
/** ブロック 记号: 英字 / 片假名 / 平假名, 单字符 */
const BLOCK = `[A-Za-z${KATAKANA}${HIRAGANA}]`;
/** ブロック 与番号之间的分隔符, 可省略 */
const SEP = '[\\-ー－‐‑–—ｰ_・]?\\s*';
/** 包住 ブロック 的各种引号 */
const QUOTE_L = '[「『"“”\'\'｢]?';
const QUOTE_R = '[」』"“”\'\'｣]?';

const AREAS: Area[] = ['東', '西', '南'];

/**
 * 归一化: 全角转半角(NFKC 处理数字/英字/括号/ｰ), 破折号统一成 '-', 压缩空白。
 *
 * 注意 ー(U+30FC) 不在替换范围内 —— 它既是「ホール」的长音符, 也可能是配置里的分隔符。
 * 全局替换会把 ホール 打成 ホ-ル, 所以只在 SEP 字符类里就地接受它。
 */
export function normalize(text: string): string {
    return (
        text
            // 実データで「み<U+AD><U+AD>-05b」のように不可視文字が挟まっている例があった。
            // コピペで紛れ込むもので、見た目には出ないのに解析だけ壊すので最初に落とす
            .replace(/[­​-‍⁠﻿]/g, '')
            .normalize('NFKC')
            .replace(/[‐‑–—]/g, '-')
            .replace(/[　\t]+/g, ' ')
    );
}

interface DayMarker {
    index: number;
    day: Day;
}

/** 扫出文本里所有日程标记及其位置 */
function findDayMarkers(text: string): DayMarker[] {
    const markers: DayMarker[] = [];
    const patterns: [RegExp, Day][] = [
        [/[1１一]日目|初日/g, 1],
        [/[2２二]日目|最終日/g, 2],
        [/土曜日?|[(（]土[)）]/g, 1],
        [/日曜日?|[(（]日[)）]/g, 2],
        [/8[\/月]15日?/g, 1],
        [/8[\/月]16日?/g, 2],
    ];
    for (const [re, day] of patterns) {
        re.lastIndex = 0;
        for (const m of text.matchAll(re)) {
            if (m.index !== undefined) markers.push({ index: m.index, day });
        }
    }
    return markers.sort((a, b) => a.index - b.index);
}

/**
 * 为某个位置的摊位匹配挑日程。
 * 优先取前方 40 字符内最近的日程标记(「2日目 東A-12b」这种就近修饰);
 * 找不到就看整条推文是否只提到唯一一个日程, 是则用它, 否则留空。
 */
function pickDay(markers: DayMarker[], at: number): Day | null {
    let best: DayMarker | null = null;
    for (const m of markers) {
        if (m.index <= at && at - m.index <= 40) {
            if (!best || m.index > best.index) best = m;
        }
    }
    if (best) return best.day;

    const distinct = new Set(markers.map((m) => m.day));
    return distinct.size === 1 ? [...distinct][0] : null;
}

function toAB(s: string | undefined): AB | null {
    if (!s) return null;
    const v = s.toLowerCase();
    return v === 'ab' || v === 'a' || v === 'b' ? (v as AB) : null;
}

function formatDisplay(b: Omit<Booth, 'display'>): string {
    const parts: string[] = [];
    if (b.day) parts.push(`${b.day}日目`);

    let space = '';
    if (b.area) space += b.area;
    if (b.hall) space += b.hall;
    if (b.block) {
        // ホール番号がある時だけ区切る: 東A-12b / 東4 ア-12ab
        if (b.hall) space += ' ';
        space += b.block;
        if (b.number !== null) space += `-${String(b.number).padStart(2, '0')}`;
        if (b.ab) space += b.ab;
    } else if (b.hall) {
        space += 'ホール';
    } else if (b.area) {
        space += '地区';
    }
    if (space) parts.push(space);

    return parts.join(' ') || b.raw;
}

interface Span {
    start: number;
    end: number;
}

/**
 * 从一段文本里解析出所有摊位配置。
 *
 * 三档匹配:
 *   A. 地区 + (ホール) + ブロック + 番号 + (ab)  —— 最完整
 *   B. ブロック + 番号 + ab                      —— 无地区, 但 ab 后缀足以确认这是配置
 *   C. 地区 + ホール                             —— 只有大区, 低置信度
 */
export function parseBooths(input: string): Booth[] {
    const text = normalize(input);
    const markers = findDayMarkers(text);
    const booths: Booth[] = [];
    const spans: Span[] = [];

    const push = (b: Omit<Booth, 'display'>, span: Span) => {
        booths.push({ ...b, display: formatDisplay(b) });
        spans.push(span);
    };

    // A: 地区 + (ホール号) + (ホール|地区) + ブロック + (ブロック) + 番号 + (ab)
    const reA = new RegExp(
        `([東西南])\\s*` +
            `([0-9]{1,2}(?:\\s*[-~～]\\s*[0-9]{1,2})?)?\\s*` +
            `(?:ホール|地区)?\\s*` +
            `${QUOTE_L}(${BLOCK})${QUOTE_R}\\s*(?:ブロック)?\\s*` +
            `${SEP}([0-9]{1,2})\\s*(ab|AB|a|b|A|B)?`,
        'g',
    );
    for (const m of text.matchAll(reA)) {
        if (m.index === undefined) continue;
        const [raw, area, hall, block, num, ab] = m;
        push(
            {
                day: pickDay(markers, m.index),
                area: area as Area,
                hall: hall ? hall.replace(/\s/g, '') : null,
                block,
                number: Number(num),
                ab: toAB(ab),
                raw: raw.trim(),
                confidence: 'high',
            },
            { start: m.index, end: m.index + raw.length },
        );
    }

    // B: ブロック + 番号 + ab, 没有地区。要求 ab 后缀, 否则噪声太大
    const reB = new RegExp(`${QUOTE_L}(${BLOCK})${QUOTE_R}\\s*(?:ブロック)?\\s*${SEP}([0-9]{1,2})\\s*(ab|AB|a|b|A|B)\\b`, 'g');
    for (const m of text.matchAll(reB)) {
        if (m.index === undefined) continue;
        if (overlaps(spans, m.index, m.index + m[0].length)) continue;
        const [raw, block, num, ab] = m;
        push(
            {
                day: pickDay(markers, m.index),
                area: null,
                hall: null,
                block,
                number: Number(num),
                ab: toAB(ab),
                raw: raw.trim(),
                confidence: 'high',
            },
            { start: m.index, end: m.index + raw.length },
        );
    }

    // D: 「南館」のような棟の呼び方。ブロックは分からないが地区の絞り込みには使える
    const reD = /([東西南])館/g;
    for (const m of text.matchAll(reD)) {
        if (m.index === undefined) continue;
        if (overlaps(spans, m.index, m.index + m[0].length)) continue;
        push(
            {
                day: pickDay(markers, m.index),
                area: m[1] as Area,
                hall: null,
                block: null,
                number: null,
                ab: null,
                raw: m[0],
                confidence: 'low',
            },
            { start: m.index, end: m.index + m[0].length },
        );
    }

    // C: 只有 地区 + ホール, 没有具体 ブロック
    const reC = /([東西南])\s*([0-9]{1,2}(?:\s*[-~～ー]\s*[0-9]{1,2})?)?\s*ホール/g;
    for (const m of text.matchAll(reC)) {
        if (m.index === undefined) continue;
        if (overlaps(spans, m.index, m.index + m[0].length)) continue;
        const [raw, area, hall] = m;
        push(
            {
                day: pickDay(markers, m.index),
                area: area as Area,
                hall: hall ? hall.replace(/\s/g, '') : null,
                block: null,
                number: null,
                ab: null,
                raw: raw.trim(),
                confidence: 'low',
            },
            { start: m.index, end: m.index + raw.length },
        );
    }

    return mergeHallOnly(dedupe(booths));
}

/**
 * ホールだけの記述を、同じスペースを指す完全な配置に畳み込む。
 *
 * 実データでは配置とホールを別々に書くのが普通:
 *   「南1ホール【L-12b】」            —— ホールが先、番号が括弧の中
 *   「西地区 "か"ブロック-28a (西2ホール)」—— ホールが後ろに補足で付く
 * これを 2 件として出すと、同じサークルが 2 箇所にいるように見えてしまう。
 *
 * 地区が一致するもの同士を畳み、地区が読めていない配置は
 * ホール記述が 1 つだけの時に限ってそこから地区を引き継ぐ。
 */
function mergeHallOnly(booths: Booth[]): Booth[] {
    const full = booths.filter((b) => b.block !== null);
    const hallOnly = booths.filter((b) => b.block === null);
    if (full.length === 0 || hallOnly.length === 0) return booths;

    const consumed = new Set<Booth>();

    for (const f of full) {
        let source = hallOnly.find((h) => h.area && f.area && h.area === f.area && !consumed.has(h));
        if (!source && !f.area && hallOnly.length === 1) source = hallOnly[0];
        if (!source) continue;

        if (!f.area) f.area = source.area;
        if (!f.hall) f.hall = source.hall;
        if (f.day === null) f.day = source.day;
        f.display = formatDisplay(f);
        consumed.add(source);
    }

    return booths.filter((b) => !consumed.has(b));
}

function overlaps(spans: Span[], start: number, end: number): boolean {
    return spans.some((s) => start < s.end && end > s.start);
}

/** 同一条推文里重复写同一个配置很常见, 按 display 去重, 保留置信度高的 */
function dedupe(booths: Booth[]): Booth[] {
    const byKey = new Map<string, Booth>();
    for (const b of booths) {
        const existing = byKey.get(b.display);
        if (!existing || (existing.confidence === 'low' && b.confidence === 'high')) {
            byKey.set(b.display, b);
        }
    }
    return [...byKey.values()];
}

/** 文本里是否出现了任何看起来像配置的东西 —— classify 用它当社团信号 */
export function hasBooth(text: string): boolean {
    return parseBooths(text).some((b) => b.confidence === 'high');
}

/** 从一组摊位里收集出场日程 */
export function boothDays(booths: Booth[]): Day[] {
    const days = new Set<Day>();
    for (const b of booths) if (b.day) days.add(b.day);
    return [...days].sort();
}

/** 直接从文本里读日程标记 —— cosplayer 没有摊位号, 只能靠这个判断出场日 */
export function parseDays(input: string): Day[] {
    const days = new Set<Day>();
    for (const m of findDayMarkers(normalize(input))) days.add(m.day);
    return [...days].sort();
}

export const _internals = { findDayMarkers, pickDay, formatDisplay, AREAS };
export type { Booth, Confidence };
