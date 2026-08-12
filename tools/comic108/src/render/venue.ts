/**
 * C108 の会場レイアウト。公式配置図 (C108Map_all_B4.pdf) をそのまま写したもの。
 *
 * 会場を真上から見た並びをそのまま持つ:
 *   東1・2・3 が 1 棟(上段)、その下に 東7 と 西 が横に並び、いちばん下が 南。
 * 棟の中は
 *   - ホールの仕切り
 *   - 通路で分かれた島のまとまり
 *   - 島を横に切る通路(bands)。段数はブロックごとに違い、端の島ほど短い
 *     (東3 の ヨ は 54 スペース、隣の ユ は 66 スペース)
 *   - ブロック記号が入る段(letterAfter)
 *   - 外周をまわる壁サークル
 * まで写してある。並びは配置図と同じ左→右。
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
    /**
     * 段が上下に分かれるホールで、短いほうの段をどちら側に寄せるか。既定は左。
     * 西2 は下段 かおえうい が上段の さこけくき の真下に来る(西1 の左右反転)。
     */
    align?: 'left' | 'right';
    groups: Island[][];
}

/** 壁サークル。棟の外周をまわるが、地図ではホールの端に 1 本にまとめる */
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

/**
 * 企業ブースのホール。
 *
 * サークルのホールと作りが違う: ブロック記号が無く、4 桁(ガールズエリアだけ 3 桁)の
 * 番号だけで場所が決まる。番号自体が場所を表していて、
 *   1 桁目 1=西 / 2=南、2 桁目が島、3 桁目が列、4 桁目がその中の位置。
 * 島の形までは配置図から起こしていないので、番号のまとまりごとに並べるだけにしてある。
 */
export interface CompanyHall {
    hall: string;
    /** 通路で分かれたまとまり。番号は企業ブースパンフレットの地図の並びそのまま */
    groups: { label?: string; booths: number[] }[];
}

/** 1 棟。中の仕切りがホール。地図の絞り込みもこの単位 */
export interface Building {
    /** 絞り込みの鍵。チップの文字にもなる */
    id: string;
    area: Area;
    /** 左→右の並び */
    halls: Hall[];
    /** 企業ブースの棟。halls とはどちらか一方だけを持つ */
    companies?: CompanyHall[];
}

/** 棟の横並び 1 段。会場を真上から見たときの並びそのもの */
export interface FloorRow {
    buildings: Building[];
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

const east3: Hall = {
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
};

const east2: Hall = {
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
};

const east1: Hall = {
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
    // ア は東1〜3 の外周を三方から囲む。折り返しは描けないので東1 の右端にまとめる
    wall: { block: 'ア', spaces: 95, side: 'right' },
};

const east7: Hall = {
    hall: '7',
    sections: [
        { letterAfter: 0, groups: [isles('MLKJ', E7), isles('IHG', E7), isles('FEDCB', E7)] },
        // N・O は 2 日目には無い
        { letterAfter: 0, groups: [isles('WVUT', E7), isles('SRQ', E7S), isles('PON', E7P)] },
    ],
    wall: { block: 'A', spaces: 48, side: 'left' },
};

const west1: Hall = {
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
    wall: { block: 'め', spaces: 73, side: 'left' },
};

const west2: Hall = {
    hall: '2',
    sections: [
        {
            letterAfter: 0,
            groups: [
                [...isles('ちた', W28)],
                [...isles('そせ', W28), ...isles('すし', W26), ...isles('さこけくき', W52)],
            ],
        },
        { letterAfter: 2, align: 'right', groups: [isles('かおえうい', W52L)] },
    ],
    wall: { block: 'あ', spaces: 73, side: 'right' },
};

const south1: Hall = {
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
};

const south2: Hall = {
    hall: '2',
    sections: [{ letterAfter: 1, groups: [[...isles('gfe', S42), ...isles('dcb', S46)]] }],
    wall: { block: 'a', spaces: 54, side: 'right' },
};


/*
 * 企業ブース。企業ブースパンフレット (2026 SUMMER) の地図から起こした。
 * 西展示棟 3・4ホールと南展示棟 3・4ホールの 4F、122 社。
 * ガールズエリア(女性向け中心)は南3ホールの中の一区画で、そこだけ番号が 3 桁。
 *
 * 番号のまとまり(11xx / 12xx …)が島に当たる。島の細かな形までは起こしていない。
 */
const west3: CompanyHall = {
    hall: '3',
    groups: [
        { booths: [1111, 1121, 1122, 1123, 1124, 1125, 1131, 1132, 1133, 1134, 1141, 1142, 1151, 1161, 1171] },
        { booths: [1211, 1221, 1222, 1223, 1224, 1225, 1226, 1231, 1232, 1233, 1241, 1251, 1252] },
        { booths: [1311, 1312, 1313, 1321, 1322, 1323, 1331, 1332, 1333, 1341, 1342, 1343, 1351] },
        { booths: [1911, 1912, 1913, 1914, 1921, 1922, 1923, 1931, 1932, 1933, 1934, 1941, 1942, 1943] },
    ],
};

const west4: CompanyHall = {
    hall: '4',
    groups: [{ booths: [1411, 1412, 1413, 1414, 1421, 1422, 1423, 1424, 1431, 1432, 1433, 1441, 1442, 1443, 1451] }],
};

const south3: CompanyHall = {
    hall: '3',
    groups: [
        { label: 'ガールズエリア', booths: [111, 112, 121, 122, 911, 912, 913, 914] },
        { booths: [2141, 2142, 2143] },
        { booths: [2211, 2212, 2213, 2221, 2222, 2223, 2231, 2241] },
        { booths: [2311, 2321, 2322, 2323, 2324, 2331, 2341, 2342, 2343] },
        { booths: [2911, 2912, 2913, 2921, 2922] },
    ],
};

const south4: CompanyHall = {
    hall: '4',
    groups: [
        { booths: [2411, 2421, 2431, 2441, 2442, 2443, 2444, 2445, 2446] },
        { booths: [2511, 2521, 2522, 2531, 2532, 2533, 2534, 2541] },
        { booths: [2621, 2641] },
    ],
};

/**
 * 棟の並び。東1・2・3 が上段いっぱい、その下に 東7 と 西 が横並び、いちばん下が 南。
 * 企業ブースは西・南の 4F にあるので、サークルの棟とは別の段に置く。
 * 東1〜3 / 西1・2 / 南1・2 はそれぞれ地続きの 1 棟で、中の仕切りがホール。
 */
export const FLOOR: FloorRow[] = [
    { buildings: [{ id: '東123', area: '東', halls: [east3, east2, east1] }] },
    {
        buildings: [
            { id: '東7', area: '東', halls: [east7] },
            { id: '西', area: '西', halls: [west1, west2] },
        ],
    },
    { buildings: [{ id: '南', area: '南', halls: [south1, south2] }] },
    {
        buildings: [
            { id: '企業西', area: '西', halls: [], companies: [west3, west4] },
            { id: '企業南', area: '南', halls: [], companies: [south3, south4] },
        ],
    },
];

/** 企業ブースの番号 → どのホールか。番号が構成表に無ければ null */
export function companyHallOf(num: number): { area: Area; hall: string } | null {
    for (const row of FLOOR) {
        for (const b of row.buildings) {
            for (const h of b.companies ?? []) {
                if (h.groups.some((g) => g.booths.includes(num))) return { area: b.area, hall: h.hall };
            }
        }
    }
    return null;
}

/** 企業ブースの番号すべて。本文の数字を配置と取り違えないための照合に使う */
export function companyBooths(): number[] {
    return FLOOR.flatMap((row) =>
        row.buildings.flatMap((b) => (b.companies ?? []).flatMap((h) => h.groups.flatMap((g) => g.booths))),
    );
}

/** 地図の絞り込みチップに出す棟の並び */
export function buildingIds(): string[] {
    return FLOOR.flatMap((row) => row.buildings.map((b) => b.id));
}

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

/** 棟とホールを平らに辿る */
export function eachHall(): { area: Area; hall: Hall }[] {
    return FLOOR.flatMap((row) => row.buildings.flatMap((b) => b.halls.map((hall) => ({ area: b.area, hall }))));
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
