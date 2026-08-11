/**
 * 摊位号解析的离线自测。不需要联网, 不需要 X 账号。
 *   bun run test:booth
 */

import { parseBooths } from './booth';
import type { Booth } from '../types';

interface Case {
    name: string;
    input: string;
    /** 期望的第一个高置信度摊位(部分字段匹配即可) */
    expect: Partial<Booth> | null;
    /** 期望解析出的摊位总数 */
    count?: number;
}

const cases: Case[] = [
    {
        name: '基本形 東A-12b',
        input: 'C108 東A-12b で参加します',
        expect: { area: '東', block: 'A', number: 12, ab: 'b', confidence: 'high' },
    },
    {
        name: '地区+引号+ブロック 東地区"A"ブロック12b',
        input: '東地区"A"ブロック12b',
        expect: { area: '東', block: 'A', number: 12, ab: 'b', confidence: 'high' },
    },
    {
        name: '全角ホール+片假名ブロック 東４ホール ア-12ab',
        input: '東４ホール ア-12ab',
        expect: { area: '東', hall: '4', block: 'ア', number: 12, ab: 'ab', confidence: 'high' },
    },
    {
        name: '曜日で日程 日曜 東A12b',
        input: '日曜 東A12b にいます',
        expect: { day: 2, area: '東', block: 'A', number: 12, ab: 'b' },
    },
    {
        name: '日目+平假名ブロック 2日目 西け21a',
        input: '2日目 西け21a',
        expect: { day: 2, area: '西', block: 'け', number: 21, ab: 'a' },
    },
    {
        name: 'ホールのみ 1日目 南1-2ホール',
        input: '1日目 南1-2ホール',
        expect: { day: 1, area: '南', hall: '1-2', block: null, confidence: 'low' },
    },
    {
        name: '全角英数 東Ａ－１２ｂ',
        input: '東Ａ－１２ｂ',
        expect: { area: '東', block: 'A', number: 12, ab: 'b', confidence: 'high' },
    },
    {
        name: '日付で日程 8/16 東ア-05a',
        input: '8/16 東ア-05a です',
        expect: { day: 2, area: '東', block: 'ア', number: 5, ab: 'a' },
    },
    {
        name: '初日 → 1日目',
        input: '初日 西あ-31b',
        expect: { day: 1, area: '西', block: 'あ', number: 31, ab: 'b' },
    },
    {
        name: '地区なし ab付き ア-12ab',
        input: 'スペースは ア-12ab です',
        expect: { area: null, block: 'ア', number: 12, ab: 'ab', confidence: 'high' },
    },
    {
        name: '両日 2 件を別々に拾う',
        input: '1日目 東A-12b / 2日目 西け21a',
        expect: { day: 1, area: '東', block: 'A', number: 12 },
        count: 2,
    },
    {
        name: '同じ配置の重複は 1 件に畳む',
        input: '東A-12b です。東A-12b でお待ちしてます',
        expect: { area: '東', block: 'A', number: 12, ab: 'b' },
        count: 1,
    },
    {
        name: '配置を含まない文は 0 件',
        input: '明日はコミケです！よろしくお願いします',
        expect: null,
        count: 0,
    },
    {
        name: '日付だけの文で誤検出しない',
        input: '2026年8月15日に開催されます',
        expect: null,
        count: 0,
    },
];

let passed = 0;
const failures: string[] = [];

for (const c of cases) {
    const got = parseBooths(c.input);

    if (c.count !== undefined && got.length !== c.count) {
        failures.push(`${c.name}\n    件数 期待 ${c.count} / 実際 ${got.length}\n    ${JSON.stringify(got)}`);
        continue;
    }

    if (c.expect === null) {
        if (got.length === 0) passed++;
        else failures.push(`${c.name}\n    0 件のはずが ${JSON.stringify(got)}`);
        continue;
    }

    const first = got[0];
    if (!first) {
        failures.push(`${c.name}\n    1 件も取れなかった`);
        continue;
    }

    const bad: string[] = [];
    for (const [key, want] of Object.entries(c.expect)) {
        const actual = (first as Record<string, unknown>)[key];
        if (actual !== want) bad.push(`${key}: 期待 ${JSON.stringify(want)} / 実際 ${JSON.stringify(actual)}`);
    }

    if (bad.length) failures.push(`${c.name}\n    ${bad.join('\n    ')}\n    → ${JSON.stringify(first)}`);
    else passed++;
}

console.log(`\n配置解析テスト: ${passed}/${cases.length} passed\n`);

if (failures.length) {
    for (const f of failures) console.error(`  ✗ ${f}\n`);
    process.exit(1);
}
console.log('  ✓ 全部通过\n');
