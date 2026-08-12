/**
 * C108 の会場レイアウト。公式配置図 (C108Map_all_B4.pdf) をそのまま写したもの。
 *
 * ブロックを等間隔に並べただけでは会場と違う形になってしまう。実際は
 *   - ホールとホールの間に大きな空きがある
 *   - ホールの中も通路でいくつかのまとまりに分かれている
 *   - 島は通路で横にも切られていて、その段数はブロックごとに違う
 *     (端の島ほど短い。東3 の ヨ は 54 スペース、隣の ユ は 66 スペース)
 *   - ブロック記号は島の途中、通路の切れ目に入る
 *   - 端には壁サークルが 1 列で縦に並ぶ
 *   - 東7 と西は上下 2 段になっている
 * ので、その形をそのまま持つ。並びは配置図と同じ左→右。
 *
 * 通路の幅までは持っていない。あくまで「どのブロックのどこか」を会場なりの形で
 * 見せるためのもので、現地の順路は公式配置図で確認すること。
 */

export type Area = '東' | '西' | '南';

/** 島 1 つ。bands は通路で切られた段ごとの行数で、合計 × 2 がスペース数 */
export interface Island {
    block: string;
    bands: number[];
}

/** 島の横並び 1 段ぶん。groups は通路で区切られたまとまり */
export interface Section {
    /** ブロック記号を何段目の後ろに置くか(0 始まり) */
    letterAfter: number;
    groups: Island[][];
}

/** 壁サークル。ホールの端に 1 列で縦に並ぶ */
export interface Wall {
    block: string;
    spaces: number;
    side: 'left' | 'right';
}

export interface Hall {
    /** ホール番号。表示は「東1」のようになる */
    hall: string;
    sections: Section[];
    wall?: Wall;
}

export interface AreaLayout {
    area: Area;
    /** ホールの並び。段が分かれている地区があるので二次元 */
    rows: Hall[][];
}

/** 同じ形の島がいくつも続くので、まとめて作る */
const isles = (blocks: string, bands: number[]): Island[] =>
    blocks.split('').map((block) => ({ block, bands }));

// 東1〜3 の島。端の島ほど短い
const E66 = [8, 8, 8, 9];
const E62 = [7, 8, 8, 8];
const E54 = [7, 6, 6, 8];
const E48 = [5, 7, 7, 5];
// 東7。通路は中央の 1 本だけ
const E7 = [12, 12];
const E7S = [12, 11];
const E7P = [12];
// 西。上段と下段で通路の位置が違う
const W52 = [8, 7, 11];
const W28 = [8, 6];
const W26 = [8, 5];
const W52L = [7, 6, 7, 6];
// 南
const S46 = [7, 7, 9];
const S44 = [6, 7, 9];
const S42 = [5, 7, 9];

export const VENUE: AreaLayout[] = [
    {
        area: '東',
        rows: [
            [
                {
                    hall: '3',
                    sections: [
                        {
                            letterAfter: 1,
                            groups: [
                                [...isles('ヨ', E54), ...isles('ユヤ', E66), ...isles('モ', E62)],
                                [...isles('メ', E62), ...isles('ムミマホヘ', E66), ...isles('フ', E62), ...isles('ヒ', E48)],
                            ],
                        },
                    ],
                },
                {
                    hall: '2',
                    sections: [
                        {
                            letterAfter: 1,
                            groups: [
                                [...isles('ハ', E48), ...isles('ノ', E62), ...isles('ネヌ', E66), ...isles('ニ', E62)],
                                [...isles('ナ', E62), ...isles('トテツチタ', E66), ...isles('ソ', E62), ...isles('セ', E48)],
                            ],
                        },
                    ],
                },
                {
                    hall: '1',
                    sections: [
                        {
                            letterAfter: 1,
                            groups: [
                                [...isles('ス', E48)],
                                [...isles('シ', E62), ...isles('サコ', E66), ...isles('ケ', E62)],
                                [...isles('ク', E62), ...isles('キカオエウ', E66), ...isles('イ', E54)],
                            ],
                        },
                    ],
                    // ア は東1〜3 の外周をぐるりと回る。ここでは東1 の右端にまとめて置く
                    wall: { block: 'ア', spaces: 96, side: 'right' },
                },
            ],
            [
                {
                    hall: '7',
                    sections: [
                        {
                            letterAfter: 0,
                            groups: [isles('MLKJ', E7), isles('IHG', E7), isles('FEDCB', E7)],
                        },
                        {
                            letterAfter: 0,
                            // N・O は 2 日目には無い
                            groups: [isles('WVUT', E7), isles('SRQ', E7S), isles('PON', E7P)],
                        },
                    ],
                    wall: { block: 'A', spaces: 96, side: 'left' },
                },
            ],
        ],
    },
    {
        area: '西',
        rows: [
            [
                {
                    hall: '1',
                    sections: [
                        {
                            letterAfter: 0,
                            groups: [
                                [...isles('ふひはのね', W52), ...isles('ぬに', W26), ...isles('なと', W28)],
                                [...isles('てつ', W28)],
                            ],
                        },
                        { letterAfter: 2, groups: [isles('むみまほへ', W52L)] },
                    ],
                    wall: { block: 'め', spaces: 104, side: 'left' },
                },
                {
                    hall: '2',
                    sections: [
                        {
                            letterAfter: 0,
                            groups: [
                                [...isles('ちた', W28)],
                                [...isles('そせ', W28), ...isles('すし', W26), ...isles('さこけくき', W52)],
                            ],
                        },
                        { letterAfter: 2, groups: [isles('かおえうい', W52L)] },
                    ],
                    wall: { block: 'あ', spaces: 104, side: 'right' },
                },
            ],
        ],
    },
    {
        area: '南',
        rows: [
            [
                {
                    hall: '1',
                    sections: [
                        {
                            letterAfter: 1,
                            groups: [
                                isles('tsr', S44),
                                isles('qpo', S44),
                                isles('nmlk', S46),
                                [...isles('j', S46), ...isles('ih', S44)],
                            ],
                        },
                    ],
                },
                {
                    hall: '2',
                    sections: [
                        {
                            letterAfter: 1,
                            groups: [[...isles('gfe', S42), ...isles('dcb', S46)]],
                        },
                    ],
                    wall: { block: 'a', spaces: 54, side: 'right' },
                },
            ],
        ],
    },
];

/** その島のスペース数。配置図の島の最下段が「N｜1」になっている、その N */
export function islandSpaces(island: Island): number {
    return island.bands.reduce((a, b) => a + b, 0) * 2;
}

/**
 * スペース番号 → 島のどこか。
 *
 * 配置図の島は 2 列で、右列を下から上へ 1..N/2、左列を上から下へ N/2+1..N と蛇行する
 * (島の最下段が「66｜1」になっているのがその形)。通路で切られた何段目に入るかも返す。
 */
export function spacePosition(num: number, bands: number[]): { band: number; row: number; col: 1 | 2 } | null {
    const total = bands.reduce((a, b) => a + b, 0) * 2;
    const half = total / 2;
    if (num < 1 || num > total) return null;

    const col: 1 | 2 = num <= half ? 2 : 1;
    // 上から数えた行番号。右列は下から数えるので反転する
    const fromTop = num <= half ? half - num + 1 : num - half;

    let rest = fromTop;
    for (let band = 0; band < bands.length; band++) {
        if (rest <= bands[band]) return { band, row: rest, col };
        rest -= bands[band];
    }
    return null;
}

/** そのホールに属するブロックすべて(壁サークルを含む) */
export function hallBlocks(hall: Hall): string[] {
    const inner = hall.sections.flatMap((s) => s.groups.flat().map((i) => i.block));
    return hall.wall ? [...inner, hall.wall.block] : inner;
}

/** 地区とホールを平らに辿る */
export function eachHall(): { area: Area; hall: Hall }[] {
    return VENUE.flatMap(({ area, rows }) => rows.flat().map((hall) => ({ area, hall })));
}

/**
 * ブロック記号からホールを引く表。
 *
 * ツイートには「東ア-12b」のようにホール番号を書かない例がとても多い。
 * ブロックが決まればホールは一意に決まるので、書かれていなくても正しい島に置ける。
 * 英字は大文字小文字が揺れる(南を大文字で書く人がいる)ので、小文字に寄せて引く。
 */
export function buildHallLookup(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const { area, hall } of eachHall()) {
        for (const block of hallBlocks(hall)) map[`${area}/${block.toLowerCase()}`] = hall.hall;
    }
    return map;
}

/**
 * ブロック記号を公式の表記に直す表。
 *
 * 東7 は大文字、南は小文字と決まっているのに「南1 T-17ab」のように逆で書かれることがある。
 * 揃えておかないと集計の鍵と島の鍵が食い違い、その配置が地図から消える。
 */
export function buildBlockLookup(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const { area, hall } of eachHall()) {
        for (const block of hallBlocks(hall)) map[`${area}/${block.toLowerCase()}`] = block;
    }
    return map;
}
