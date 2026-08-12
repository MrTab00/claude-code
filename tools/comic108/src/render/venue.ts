/**
 * C108 の会場ブロック構成。公式配置図 (C108Map_all_B4.pdf) から起こした。
 *
 * ここに入れてよいのは「どのホールにどのブロックがあるか」と「その並び順」だけ。
 * 通路幅やスペースの物理的な位置は入れていない —— それらしい平面図を描くと
 * 現地で迷わせるので、あくまでブロック単位の索引に留める。
 *
 * 地区ごとに使う文字種が違うのが Comiket の決まり:
 *   東1-3 片仮名 ア〜ヨ / 東7 英字 A〜W / 西1-2 平仮名 あ〜め / 南1-2 英小字 a〜t
 */

export interface Hall {
    /** ホール番号。表示は「東1」のようになる */
    hall: string;
    /** そのホールのブロック。配置図で左→右に並んでいる順ではなく、五十音・アルファベット順 */
    blocks: string[];
    /**
     * 1 ブロックあたりのスペース数。配置図から読んだおおよその上限。
     * 島は 2 列で、右列を下から上へ 1..N/2、左列を上から下へ N/2+1..N と蛇行する。
     */
    spaces: number;
}

export type Area = '東' | '西' | '南';

const seq = (from: string, to: string): string[] => {
    const out: string[] = [];
    for (let c = from.codePointAt(0)!; c <= to.codePointAt(0)!; c++) out.push(String.fromCodePoint(c));
    return out;
};

/** 五十音のブロック記号。濁点・小書きは使われないので、実際に使う文字だけ並べる */
const KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨ'.split('');
const HIRAGANA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめ'.split('');

/** 会場の並び。配置図の全体図(東7 / 東3東2東1 / 西1西2 / 南1南2)に合わせる */
export const VENUE: { area: Area; halls: Hall[] }[] = [
    {
        area: '東',
        halls: [
            { hall: '7', blocks: seq('A', 'W'), spaces: 48 },
            { hall: '3', blocks: KATAKANA.slice(26), spaces: 52 }, // ヒ〜ヨ
            { hall: '2', blocks: KATAKANA.slice(14, 26), spaces: 52 }, // ソ〜ハ
            { hall: '1', blocks: KATAKANA.slice(0, 14), spaces: 52 }, // ア〜セ
        ],
    },
    {
        area: '西',
        halls: [
            { hall: '1', blocks: HIRAGANA.slice(17), spaces: 52 }, // つ〜め
            { hall: '2', blocks: HIRAGANA.slice(0, 17), spaces: 52 }, // あ〜ち
        ],
    },
    {
        area: '南',
        halls: [
            { hall: '1', blocks: seq('h', 't'), spaces: 46 },
            { hall: '2', blocks: seq('a', 'g'), spaces: 46 },
        ],
    },
];

/**
 * ブロック記号からホールを引く表。
 *
 * ツイートには「東ア-12b」のようにホール番号を書かない例がとても多い。
 * ブロックが決まればホールは一意に決まるので、書かれていなくても正しい箱に入れられる。
 * 英字は大文字小文字が揺れる(南を大文字で書く人がいる)ので、地区と合わせて判定する。
 */
export function buildHallLookup(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const { area, halls } of VENUE) {
        for (const { hall, blocks } of halls) {
            for (const block of blocks) map[`${area}/${block.toLowerCase()}`] = hall;
        }
    }
    return map;
}

/**
 * ブロック記号を公式の表記に直す表。
 *
 * 東7 は大文字、南は小文字と決まっているのに、ツイートでは「南1 T-17ab」のように
 * 逆で書かれることがある。表記を揃えておかないと、集計の鍵とマスの鍵が食い違って
 * その配置が地図から消える。
 */
export function buildBlockLookup(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const { area, halls } of VENUE) {
        for (const { blocks } of halls) {
            for (const block of blocks) map[`${area}/${block.toLowerCase()}`] = block;
        }
    }
    return map;
}
