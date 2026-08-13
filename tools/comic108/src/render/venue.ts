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
/** 企業ブース 1 つ。no が場所、name が出展社名 */
export interface CompanyBooth {
    no: number;
    name: string;
}

export interface CompanyHall {
    hall: string;
    /** 通路で分かれたまとまり。並びは企業ブースパンフレットの地図のまま */
    groups: { label?: string; booths: CompanyBooth[] }[];
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
        { booths: [
            { no: 1111, name: 'Yostar' },
            { no: 1121, name: 'TOYPLA' },
            { no: 1122, name: 'sprite×ゲーマーズ出張店' },
            { no: 1123, name: 'アリスソフト' },
            { no: 1124, name: 'でぼの巣製作所／Studio e・go！' },
            { no: 1125, name: 'ぱれっと with CLEARRAVE' },
            { no: 1131, name: 'ケロQ&枕' },
            { no: 1132, name: 'ネクストン' },
            { no: 1133, name: 'きゃらON！' },
            { no: 1134, name: 'キズナリンク' },
            { no: 1141, name: 'みるくふぁくとりー' },
            { no: 1142, name: '対魔忍' },
            { no: 1151, name: 'トリッカル・もちもちほっぺ大作戦' },
            { no: 1161, name: 'KADOKAWA' },
            { no: 1171, name: '戦姫絶唱シンフォギア' },
        ] },
        { booths: [
            { no: 1211, name: 'アズールプロミリア' },
            { no: 1221, name: 'テクロノス クロスドリィミア出張所／テクロス' },
            { no: 1222, name: 'メロンブックス' },
            { no: 1223, name: 'Whirlpool' },
            { no: 1224, name: 'Whirlpoolを送る会 by オルトロス' },
            { no: 1225, name: 'きゃべつそふと' },
            { no: 1226, name: 'まどそふと' },
            { no: 1231, name: 'コミケ消臭ゲート＜臭いのは君じゃない、服だ！＞' },
            { no: 1232, name: 'シーズナルプランツ' },
            { no: 1233, name: 'カーテン魂' },
            { no: 1241, name: 'FANZA夏の陣 FANZA同人VS FANZA動画' },
            { no: 1251, name: 'AMNIBUS' },
            { no: 1252, name: 'PikattoAnime／ピカットアニメ' },
        ] },
        { booths: [
            { no: 1311, name: 'ユーフォーテーブル' },
            { no: 1312, name: 'ライザのアトリエASMR' },
            { no: 1313, name: 'ガストショップ&KT SPOT出張所〜コーエーテクモゲームス〜' },
            { no: 1321, name: 'ぬいぐるみメーカー Gift&あみあみ' },
            { no: 1322, name: 'グッドスマイルカンパニー' },
            { no: 1323, name: 'DOLK' },
            { no: 1331, name: 'TERBIS' },
            { no: 1332, name: 'スタジオEMBERS' },
            { no: 1333, name: 'あいりすミスティリア！／オーガスト' },
            { no: 1341, name: 'アニクロ' },
            { no: 1342, name: 'ロックアイス®／小久保製氷冷蔵株式会社' },
            { no: 1343, name: 'フロンティアワークス' },
            { no: 1351, name: 'ピクシブ' },
        ] },
        { booths: [
            { no: 1911, name: 'あにぽん' },
            { no: 1912, name: '株式会社日創クリエイティブ' },
            { no: 1913, name: 'レカンザ' },
            { no: 1914, name: 'クロノア' },
            { no: 1921, name: 'ナンバーナイン' },
            { no: 1922, name: 'アニメスタイル' },
            { no: 1923, name: '株式会社ゴンゾ' },
            { no: 1931, name: 'BAKECO' },
            { no: 1932, name: 'ねこのて推し活部' },
            { no: 1933, name: 'ぶりきやさん（仮）' },
            { no: 1934, name: 'POSUTAYA×すのこタン。' },
            { no: 1941, name: 'M\'s marche' },
            { no: 1942, name: 'Chillweeb' },
            { no: 1943, name: 'きゃらめる -CharaMerci-' },
        ] },
    ],
};

const west4: CompanyHall = {
    hall: '4',
    groups: [
        { booths: [
            { no: 1411, name: 'アクアプラス' },
            { no: 1412, name: 'とらのあな' },
            { no: 1413, name: 'GRANTdesign' },
            { no: 1414, name: 'まんがタイムきららさまーふぇすてぃばる in MEDICOS 2026' },
            { no: 1421, name: 'ふもコレ' },
            { no: 1422, name: '中外鉱業' },
            { no: 1423, name: '郵便局ブース' },
            { no: 1424, name: 'firestorage' },
            { no: 1431, name: 'ボートレース多摩川' },
            { no: 1432, name: 'Aiming チームキャラバン' },
            { no: 1433, name: 'PSA Japan' },
            { no: 1441, name: 'サミー株式会社「スマスロ リコリス・リコイル」' },
            { no: 1442, name: '＃推し汗には金のファブリーズ' },
            { no: 1443, name: '5pb.Craft' },
            { no: 1451, name: 'IRIAM COOL COOL COOL' },
        ] },
    ],
};

const south3: CompanyHall = {
    hall: '3',
    groups: [
        { label: 'ガールズエリア', booths: [
            { no: 111, name: 'トロンプルイユ なりたいあの子になれるコスプレレンズ' },
            { no: 112, name: '株式会社タピオカ' },
            { no: 121, name: 'らぶカル' },
            { no: 122, name: 'BBSHOP' },
            { no: 911, name: 'しあわせの珈琲・紅茶 TEE HAUS MOZART' },
            { no: 912, name: 'KOS' },
            { no: 913, name: 'アイシングクッキー工房LEAP' },
            { no: 914, name: 'サクラフルーツパレット' },
        ] },
        { booths: [
            { no: 2141, name: 'わかさ生活' },
            { no: 2142, name: 'ハッピーハッピーメロンパン秘密基地' },
            { no: 2143, name: 'みつばちのーと' },
        ] },
        { booths: [
            { no: 2211, name: '秋田書店' },
            { no: 2212, name: 'TOブックス' },
            { no: 2213, name: '株式会社山善' },
            { no: 2221, name: '『俺だけレベルアップな件 展』' },
            { no: 2222, name: '株式会社ReStart' },
            { no: 2223, name: 'PACIFIC RACING TEAM×ウマ娘 プリティーダービーコラボブース' },
            { no: 2231, name: 'HRC ホンダ・レーシング' },
            { no: 2241, name: 'HONEY∞PARADE GAMES' },
        ] },
        { booths: [
            { no: 2311, name: 'バンドリ！・フロムトーキョーブース' },
            { no: 2321, name: '報知エンターテインメントマーケット' },
            { no: 2322, name: 'エンターグラム' },
            { no: 2323, name: 'アップランド' },
            { no: 2324, name: 'ハコネクト' },
            { no: 2331, name: 'Canva' },
            { no: 2341, name: 'バーチャル・ステーション（JR西日本グループ）' },
            { no: 2342, name: 'THEキャラ' },
            { no: 2343, name: '地獄のどこが悪い？ -What in “HELL” is bad？-' },
        ] },
        { booths: [
            { no: 2911, name: '焼き菓子ASHLEY' },
            { no: 2912, name: '群馬電機 呼び込み君' },
            { no: 2913, name: 'スポニチ' },
            { no: 2921, name: '知多娘。' },
            { no: 2922, name: '上関町公式VTuber「のんのちゃん」' },
        ] },
    ],
};

const south4: CompanyHall = {
    hall: '4',
    groups: [
        { booths: [
            { no: 2411, name: 'ホロライブプロダクション' },
            { no: 2421, name: 'アストラエ・オラティオ' },
            { no: 2431, name: 'ハムハムパンパン in 夏コミ' },
            { no: 2441, name: 'eeo Store × 竹書房STORE' },
            { no: 2442, name: 'aniplus' },
            { no: 2443, name: 'フォーカス' },
            { no: 2444, name: 'Pアニメストア' },
            { no: 2445, name: '京町セイカ@精華町' },
            { no: 2446, name: 'ナスペック「音」で休憩コーナー' },
        ] },
        { booths: [
            { no: 2511, name: 'HoYoverse' },
            { no: 2521, name: 'TYPE-MOON' },
            { no: 2522, name: 'アニプレックス' },
            { no: 2531, name: 'GEE!STORE' },
            { no: 2532, name: 'バーテックスフォース' },
            { no: 2533, name: 'アリス・ギア・アイギス' },
            { no: 2534, name: '二次元コスパ' },
            { no: 2541, name: '土屋工業（株）' },
        ] },
        { booths: [
            { no: 2621, name: '勝利の女神：NIKKE' },
            { no: 2641, name: 'ブラウンダスト2' },
        ] },
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
                if (h.groups.some((g) => g.booths.some((x) => x.no === num))) return { area: b.area, hall: h.hall };
            }
        }
    }
    return null;
}

/** 企業ブースすべて。本文の数字を配置と取り違えないための照合と、名前の表示に使う */
export function companyBooths(): CompanyBooth[] {
    return FLOOR.flatMap((row) =>
        row.buildings.flatMap((b) => (b.companies ?? []).flatMap((h) => h.groups.flatMap((g) => g.booths))),
    );
}

/** 番号 → 出展社名 */
export function companyNames(): Record<number, string> {
    return Object.fromEntries(companyBooths().map((b) => [b.no, b.name]));
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
