/**
 * C108 の会場レイアウト。公式配置図 (C108Map_all_B4.pdf) から起こした。
 *
 * ブロックを等間隔に並べただけでは会場と違う形になってしまう。実際は
 *   - ホールとホールの間に大きな空きがある
 *   - ホールの中も通路でいくつかのまとまりに分かれている
 *   - 端には壁サークルが縦に並ぶ
 *   - 東7 や西は上下 2 段になっている
 * ので、その区切りをそのまま持つ。並びは配置図と同じ左→右。
 *
 * 通路の幅や島の細かな寸法までは持っていない。あくまで「どのブロックがどこにあるか」を
 * 会場の形なりに見せるためのもので、現地の順路は公式配置図で確認すること。
 */

export type Area = '東' | '西' | '南';

export interface Hall {
    /** ホール番号。表示は「東1」のようになる */
    hall: string;
    /** 1 ブロックあたりのスペース数の目安。実データがこれを超える場合は島を伸ばす */
    spaces: number;
    /** 段 → 通路で区切られたまとまり → ブロック。すべて配置図と同じ左→右の順 */
    rows: string[][][];
    /** 壁サークル。ホールの端に縦に置く */
    wall?: { block: string; side: 'left' | 'right' };
}

export interface AreaLayout {
    area: Area;
    /** ホールの並び。段が分かれている地区があるので二次元 */
    rows: Hall[][];
}

const chars = (s: string) => s.split('');

export const VENUE: AreaLayout[] = [
    {
        area: '東',
        rows: [
            [
                {
                    hall: '3',
                    spaces: 58,
                    rows: [[chars('ヨユヤモ'), chars('メムミマホヘフヒ')]],
                },
                {
                    hall: '2',
                    spaces: 58,
                    rows: [[chars('ハノネヌニ'), chars('ナトテツチタソ')]],
                },
                {
                    hall: '1',
                    spaces: 58,
                    rows: [[chars('セス'), chars('シサコケ'), chars('クキカオエウイ')]],
                    wall: { block: 'ア', side: 'right' },
                },
            ],
            [
                {
                    hall: '7',
                    spaces: 48,
                    // 上段 B〜M / 下段 N〜W。N・O は 2 日目には無い
                    rows: [[chars('MLKJIHGFEDCB')], [chars('WVUTSRQPON')]],
                    wall: { block: 'A', side: 'left' },
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
                    spaces: 52,
                    rows: [[chars('ふひはのねぬになとてつ')], [chars('むみまほへ')]],
                    wall: { block: 'め', side: 'left' },
                },
                {
                    hall: '2',
                    spaces: 52,
                    rows: [[chars('ちたそせすしさこけくき')], [chars('かおえうい')]],
                    wall: { block: 'あ', side: 'right' },
                },
            ],
        ],
    },
    {
        area: '南',
        rows: [
            [
                { hall: '1', spaces: 46, rows: [[chars('tsrqponmlkjih')]] },
                {
                    hall: '2',
                    spaces: 46,
                    rows: [[chars('gfedcb')]],
                    wall: { block: 'a', side: 'right' },
                },
            ],
        ],
    },
];

/** そのホールに属するブロックすべて(壁サークルを含む) */
export function hallBlocks(hall: Hall): string[] {
    const inner = hall.rows.flat(2);
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
