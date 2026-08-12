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
    // --- 以下は実際に採集したツイートから起こしたケース ---
    {
        name: '実データ: ホールが先、番号が【】の中 南1ホール【L-12b】',
        input: '☀️夏コミお品書き☀️ #c108 南1ホール【L-12b】「可愛いっ子girls」にいます！',
        expect: { area: '南', hall: '1', block: 'L', number: 12, ab: 'b', confidence: 'high' },
        count: 1,
    },
    {
        name: '実データ: ホールが後ろに補足 西地区"か"ブロック-28a (西2ホール)',
        input: '日曜日 西地区 “か”ブロック－28a (西２ホール)',
        expect: { day: 2, area: '西', hall: '2', block: 'か', number: 28, ab: 'a' },
        count: 1,
    },
    {
        name: '実データ: 不可視文字(U+00AD)が挟まっていても読める',
        input: '🍀1日目(土) 西1ホール み­­-05b 🍀サークル：香月堂',
        expect: { day: 1, area: '西', hall: '1', block: 'み', number: 5, ab: 'b', confidence: 'high' },
        count: 1,
    },
    {
        name: '実データ: 「南館」は地区だけの低確度',
        input: '今回は南館の配置となっていますので空調も良く効いて涼しいハズ!',
        expect: { area: '南', block: null, hall: null, confidence: 'low' },
        count: 1,
    },
    {
        name: '別々の地区は畳まない(東の配置と南の企業ブース)',
        input: '1日目 東４ホール ア-12ab にて頒布。2日目 南1-2ホール の企業ブースにも顔を出します',
        expect: { day: 1, area: '東', hall: '4', block: 'ア', number: 12, ab: 'ab' },
        count: 2,
    },
    {
        name: '実データ: ブロックが番号の後ろ 東7 28b Jブロック',
        input: 'きょーね@C108(土)東7 28b Jブロック',
        expect: { day: 1, area: '東', hall: '7', block: 'J', number: 28, ab: 'b', confidence: 'high' },
        count: 1,
    },
    {
        name: '実データ: 表示名の中の 南1 T-17ab',
        input: '松本規之 C108 8/16「 南1 T-17ab 麒麟堂」新刊アリ',
        expect: { day: 2, area: '南', hall: '1', block: 'T', number: 17, ab: 'ab', confidence: 'high' },
        count: 1,
    },
    {
        name: 'ブロック語尾が無ければ番号後ろ形は拾わない(誤検出防止)',
        input: '新刊は 12b 500円です',
        expect: null,
        count: 0,
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
    // --- 実データで取りこぼした形。すべて 2026-08-12 の走査ログから ---
    {
        name: '隅付き括弧のブロック + 番号と ab の間の区切り 東【シ】11ｰb',
        input: 'perique@C108二日目東【シ】11ｰb',
        expect: { day: 2, area: '東', block: 'シ', number: 11, ab: 'b', confidence: 'high' },
    },
    {
        name: '括弧の中に全部入る形 【B28-b】',
        input: '銀鏡にと@C108土曜日【B28-b】',
        expect: { day: 1, block: 'B', number: 28, ab: 'b', confidence: 'high' },
    },
    {
        name: '地区+ホール+括弧ブロック 南2【b】13ab',
        input: 'ヒカベベ@C108 夏コミ日曜日 南2【b】13ab',
        expect: { day: 2, area: '南', hall: '2', block: 'b', number: 13, ab: 'ab', confidence: 'high' },
    },
    {
        name: '括弧の内側に空白 南2ホール【 h 38b】',
        input: '日曜日 Cosplay島 南2ホール【 h 38b】 えびとぴあ',
        expect: { day: 2, area: '南', hall: '2', block: 'h', number: 38, ab: 'b', confidence: 'high' },
    },
    {
        name: '片假名ブロックは空白区切りでも拾う キ 46a',
        input: 'アンブロシア@C108 1日目 キ 46a',
        expect: { day: 1, block: 'キ', number: 46, ab: 'a', confidence: 'high' },
    },
    {
        name: '区切りの前後に空白 南1 ホール / I - 18a',
        input: '8/16(日) 南1 ホール / I - 18a おさけカンパニー',
        expect: { day: 2, area: '南', hall: '1', block: 'I', number: 18, ab: 'a', confidence: 'high' },
    },
    {
        name: 'U+2212 のマイナスを区切りに使う 西２ホール あ−12a',
        input: 'コミックマーケット108 西２ホール あ−12a D-trick で参加します',
        expect: { area: '西', hall: '2', block: 'あ', number: 12, ab: 'a', confidence: 'high' },
    },
    {
        // 「土」1 文字は日程と見なさない(土産・郷土などがある)。配置は取れて日程だけ空、が正しい
        name: '片假名と字形が同じ漢字 東2二40a(二 は ニ)',
        input: '若月くまくま🧸C108土東2二40a🍋',
        expect: { day: null, area: '東', hall: '2', block: 'ニ', number: 40, ab: 'a', confidence: 'high' },
    },
    {
        name: '番号と ab の間に区切りがあっても助詞は拾わない',
        input: '新刊は 12 b 500円です',
        expect: null,
    },
    // --- 企業ブース。企業ブースパンフレット (2026 SUMMER) から ---
    {
        name: '企業ブース 西4-1933(番号のほうを信じる: 1933 は構成表では西3)',
        input: 'ぶりきやさん（仮）@コミケC108企業ブース西4-1933',
        expect: { kind: 'company', area: '西', hall: '3', number: 1933, block: null, confidence: 'high' },
    },
    {
        name: '企業ブース 南3ホール・2213',
        input: '山善は南3ホール・2213です。是非遊びに来て下さい #C108',
        expect: { kind: 'company', area: '南', hall: '3', number: 2213, confidence: 'high' },
    },
    {
        name: '企業ブース No. 付き 西3ホール No.1222',
        input: 'メロンブックス 西3ホール No.1222',
        expect: { kind: 'company', area: '西', hall: '3', number: 1222, confidence: 'high' },
    },
    {
        name: 'ガールズエリアの 3 桁番号 南3 914',
        input: 'ガールズエリア 南3 914 サクラフルーツパレット',
        expect: { kind: 'company', area: '南', hall: '3', number: 914, confidence: 'high' },
    },
    // 構成表に無い数字を配置と取り違えない。年号も値段もいくらでも出てくる
    { name: '年号を企業ブースと取り違えない', input: 'コミケ108は2026年開催です', expect: null },
    { name: '値段を企業ブースと取り違えない', input: '新刊1000円、既刊500円です', expect: null },
    { name: '地区が無い裸の番号は拾わない', input: 'いよいよ1222まで来ました', expect: null },
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
