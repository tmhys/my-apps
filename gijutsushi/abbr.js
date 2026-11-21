'use strict';
/* 略語に正式名称を添える（技術士 勉強の全画面で共通）。
 *
 * カードや回答例のデータは書き換えず、表示する直前に Abbr.expand(text) を通す。
 * データ（穴埋めの語・用語の伏せ字）とは独立しているので、出題の仕組みを壊さない。
 *
 * 添え方（その文章で最初に出てきた1回だけ）:
 *   LCA            → LCA（Life Cycle Assessment：ライフサイクルアセスメント）
 *   AM（積層造形）  → AM（Additive Manufacturing：積層造形）      … 既にある和訳とまとめる
 *   保全（TBM）     → 保全（TBM：Time Based Maintenance）          … 括弧の中の略語には英語だけ
 *   PL：パフォーマンス… のように直後で説明しているものは何もしない
 * ISO・IEC・JIS（規格番号と並ぶので読みにくくなる）と CO2 は載せていない。
 */
(function () {
  // [略語, 英語の正式名称, 日本語（無ければ空）]
  var LIST = [
    ['AM', 'Additive Manufacturing', '積層造形'],
    ['LCA', 'Life Cycle Assessment', 'ライフサイクルアセスメント'],
    ['CAE', 'Computer Aided Engineering', 'コンピュータ支援エンジニアリング'],
    ['CAD', 'Computer Aided Design', 'コンピュータ支援設計'],
    ['DX', 'Digital Transformation', 'デジタルトランスフォーメーション'],
    ['GX', 'Green Transformation', 'グリーントランスフォーメーション'],
    ['FMEA', 'Failure Mode and Effects Analysis', '故障モード影響解析'],
    ['DFMEA', 'Design Failure Mode and Effects Analysis', '設計段階の故障モード影響解析'],
    ['PFMEA', 'Process Failure Mode and Effects Analysis', '工程の故障モード影響解析'],
    ['FTA', 'Fault Tree Analysis', '故障の木解析'],
    ['RPN', 'Risk Priority Number', '危険優先数'],
    ['AP', 'Action Priority', 'アクション優先度'],
    ['AIAG-VDA', 'Automotive Industry Action Group / Verband der Automobilindustrie', '米独の自動車業界団体による共同規格'],
    ['MBD', 'Model Based Development', 'モデルベース開発'],
    ['MILS', 'Model in the Loop Simulation', ''],
    ['SILS', 'Software in the Loop Simulation', ''],
    ['HILS', 'Hardware in the Loop Simulation', ''],
    ['DFM', 'Design for Manufacturing', '製造性考慮設計'],
    ['DFA', 'Design for Assembly', '組立性考慮設計'],
    ['DFMA', 'Design for Manufacturing and Assembly', '製造・組立性考慮設計'],
    ['DfD', 'Design for Disassembly', '分解容易性設計'],
    ['DFL', 'Design for Logistics', '物流考慮設計'],
    ['DR', 'Design Review', '設計審査'],
    ['DRBFM', 'Design Review Based on Failure Mode', '故障モードに着目した設計審査'],
    ['CFRP', 'Carbon Fiber Reinforced Plastics', '炭素繊維強化プラスチック'],
    ['V&V', 'Verification and Validation', '検証と妥当性確認'],
    ['SN比', 'Signal-to-Noise Ratio', '信号対雑音比'],
    ['S-N曲線', 'Stress - Number of cycles curve', '応力振幅と破断繰返し数の関係'],
    ['MTBF', 'Mean Time Between Failures', '平均故障間隔'],
    ['MTTF', 'Mean Time To Failure', '平均故障寿命'],
    ['MTTFd', 'Mean Time To dangerous Failure', '危険側故障までの平均時間'],
    ['MTTR', 'Mean Time To Repair', '平均修復時間'],
    ['CFD', 'Computational Fluid Dynamics', '数値流体力学'],
    ['RANS', 'Reynolds-Averaged Navier-Stokes', 'レイノルズ平均モデル'],
    ['LES', 'Large Eddy Simulation', 'ラージエディシミュレーション'],
    ['FEA', 'Finite Element Analysis', '有限要素解析'],
    ['FEM', 'Finite Element Method', '有限要素法'],
    ['PID', 'Proportional-Integral-Derivative', '比例・積分・微分'],
    ['CBM', 'Condition Based Maintenance', '状態基準保全'],
    ['TBM', 'Time Based Maintenance', '時間基準保全'],
    ['PLM', 'Product Lifecycle Management', '製品ライフサイクル管理'],
    ['NDT', 'Non-Destructive Testing', '非破壊試験'],
    ['UT', 'Ultrasonic Testing', '超音波探傷試験'],
    ['RT', 'Radiographic Testing', '放射線透過試験'],
    ['MT', 'Magnetic particle Testing', '磁粉探傷試験'],
    ['PT', 'Penetrant Testing', '浸透探傷試験'],
    ['ET', 'Eddy current Testing', '渦流探傷試験'],
    ['CT', 'Computed Tomography', 'コンピュータ断層撮影'],
    ['AE', 'Acoustic Emission', 'アコースティックエミッション'],
    ['SEM', 'Scanning Electron Microscope', '走査電子顕微鏡'],
    ['IoT', 'Internet of Things', 'モノのインターネット'],
    ['AI', 'Artificial Intelligence', '人工知能'],
    ['CPS', 'Cyber-Physical System', 'サイバーフィジカルシステム'],
    ['AR', 'Augmented Reality', '拡張現実'],
    ['DLC', 'Diamond-Like Carbon', 'ダイヤモンドライクカーボン'],
    ['L10', 'Basic rating life', '基本定格寿命（90％が到達する寿命）'],
    ['ISO/TS', 'ISO Technical Specification', 'ISO技術仕様書'],
    ['GD&T', 'Geometric Dimensioning and Tolerancing', '幾何公差方式'],
    ['Cpk', 'Process Capability Index', '工程能力指数'],
    ['LHS', 'Latin Hypercube Sampling', 'ラテン超方格法'],
    ['NSGA-II', 'Non-dominated Sorting Genetic Algorithm II', '多目的遺伝的アルゴリズム'],
    ['SIMP', 'Solid Isotropic Material with Penalization', ''],
    ['PL', 'Performance Level', 'パフォーマンスレベル'],
    ['PLr', 'Required Performance Level', '要求パフォーマンスレベル'],
    ['SIL', 'Safety Integrity Level', '安全度水準'],
    ['DC', 'Diagnostic Coverage', '診断範囲'],
    ['HIP', 'Hot Isostatic Pressing', '熱間等方圧加圧'],
    ['PBF', 'Powder Bed Fusion', '粉末床溶融結合'],
    ['DED', 'Directed Energy Deposition', '指向性エネルギー堆積'],
    ['QCD', 'Quality, Cost, Delivery', '品質・コスト・納期'],
    ['PDCA', 'Plan-Do-Check-Act', '計画・実行・評価・改善'],
    ['EVM', 'Earned Value Management', 'アーンドバリュー管理'],
    ['JIT', 'Just in Time', 'ジャストインタイム'],
    ['BTO', 'Build to Order', '受注生産'],
    ['BOM', 'Bill of Materials', '部品表'],
    ['EBOM', 'Engineering Bill of Materials', '設計部品表'],
    ['MBOM', 'Manufacturing Bill of Materials', '製造部品表'],
    ['EDI', 'Electronic Data Interchange', '電子データ交換'],
    ['BCP', 'Business Continuity Plan', '事業継続計画'],
    ['CIA', 'Confidentiality, Integrity, Availability', '機密性・完全性・可用性'],
    ['OJT', 'On-the-Job Training', '職場内訓練'],
    ['AHP', 'Analytic Hierarchy Process', '階層分析法'],
    ['GWP', 'Global Warming Potential', '地球温暖化係数'],
    ['APF', 'Annual Performance Factor', '通年エネルギー消費効率'],
    ['NPSH', 'Net Positive Suction Head', '有効吸込ヘッド'],
  ];
  var MAP = {};
  LIST.forEach(function (e) { MAP[e[0]] = { en: e[1], ja: e[2] }; });

  function escRe(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var keys = LIST.map(function (e) { return e[0]; }).sort(function (a, b) { return b.length - a.length; });
  // 英字の途中では拾わない（DFMEA の中の FMEA、PLr の中の PL など）。直後の短い括弧書きも一緒に拾う。
  var RE = new RegExp('(?<![A-Za-z0-9&-])(' + keys.map(escRe).join('|') + ')(?![A-Za-z0-9&])(（[^（）\\n]{1,80}）)?', 'g');

  /**
   * text の略語に正式名称を添える。
   * opts.avoid: 添えてはいけない語（出題中の答えなど）。名称にこれを含む略語は添えない。
   * opts.seen:  Set。既に添えた略語を共有したいとき（見出しと本文で二重に出さない）。
   */
  function expand(text, opts) {
    if (text == null) return '';
    opts = opts || {};
    var avoid = (opts.avoid || []).filter(Boolean);
    var seen = opts.seen || new Set();
    return String(text).replace(RE, function (m, abbr, paren, offset, whole) {
      var e = MAP[abbr];
      if (!e || seen.has(abbr)) return m;
      var label = e.ja ? e.en + '：' + e.ja : e.en;
      if (avoid.some(function (w) { return label.indexOf(w) >= 0; })) return m;
      var after = whole.charAt(offset + abbr.length);
      // 直後で名称を説明している（PL：パフォーマンスレベル）ものはそのまま。
      // 「UT：内部欠陥に強い」のように特徴を述べているだけなら添える。
      if (after === '：' || after === '＝' || after === ':') {
        var next = whole.substr(offset + abbr.length + 1, 40);
        if ((e.ja && next.indexOf(e.ja.split('（')[0]) === 0) || next.indexOf(e.en) === 0) return m;
      }
      seen.add(abbr);
      var before = whole.charAt(offset - 1);
      if (!paren && before === '（' && after === '）') return abbr + '：' + e.en; // 時間基準保全（TBM）
      if (paren) {
        var inner = paren.slice(1, -1);
        if (inner.indexOf(e.en) >= 0) return m;
        // 括弧の中が和訳そのもの（AM（積層造形））ならまとめる。
        // 例や規格番号（GD&T（真直度・平面度など）、LCA（ISO 14040））なら名称の後ろに並べる。
        var ja0 = e.ja.split('（')[0];
        if (ja0 && (inner.indexOf(ja0) >= 0 || ja0.indexOf(inner) >= 0)) return abbr + '（' + e.en + '：' + inner + '）';
        return abbr + '（' + label + '、' + inner + '）';
      }
      return abbr + '（' + label + '）';
    });
  }

  window.Abbr = { expand: expand, list: LIST };
})();
