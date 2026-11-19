(function () {
  var mount = document.getElementById("ch-100tb-cas-flow");
  if (!mount) return;

  function boot() {
    if (window.d3) {
      init(window.d3);
      return;
    }
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js";
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onload = function () {
      if (window.d3) init(window.d3);
    };
    s.onerror = function () {
      mount.innerHTML = '<p style="padding:1rem;border:1px solid var(--pn-border,#30363d);border-radius:8px;">Unable to load D3.js visualization from CDN.</p>';
    };
    document.head.appendChild(s);
  }

  function init(d3) {
    var C = {
      hot:    "#f97316",
      coord:  "#10b981",
      cas:    "#a855f7",
      read:   "#38bdf8",
      danger: "#ef4444",
      dim:    "#64748b"
    };

    var RETENTION_MODELS = {
      "7d": {
        label: "7-Day Retention",
        poolSize: "46.1 TB",
        casCost: "$1,059/mo",
        nonCas10x: "$10,592/mo",
        nonCas3x: "$3,178/mo",
        computeEbs: "$3,645/mo",
        chTotal: "$4,704/mo",
        unitCost: "$0.0015/GB (0.15¢/GB)",
        savings10x: "$9,533/mo ($114k/yr)",
        note: "1× CAS cold pool (46.1 TB in S3 Standard) + 1× OD writer-0 (backup coord) + 9× *gd Spot writers + 6× *gd Spot readers + 3× Keepers."
      },
      "33d": {
        label: "33-Day Retention (S3 Standard)",
        poolSize: "217.1 TB",
        casCost: "$4,993/mo",
        nonCas10x: "$49,934/mo",
        nonCas3x: "$14,980/mo",
        computeEbs: "$3,645/mo",
        chTotal: "$8,638/mo",
        unitCost: "$0.0028/GB (0.28¢/GB)",
        savings10x: "$44,941/mo ($539k/yr)",
        note: "1× CAS cold pool (217.1 TB kept in S3 Standard to avoid Standard-IA's 30-day minimum early-deletion fee) saves $44,941/mo vs. 10× non-CAS."
      }
    };

    var SECTIONS = {
      all: {
        title: "All Live Cluster Roles — 100 TB/day Continuous Parallel Pipeline",
        color: "#e2e8f0",
        body: "All four color-coded roles run continuously: writer-0 stays On-Demand (coordinates 02:00 UTC backup-wake, orphan/dead-replica GC, and autoscale) while writer-1..9 and reader-0..5 run 100% Spot (reclaimable at any time). Writers ingest 100 TB/day onto free local NVMe hot disks (~3 GB/s, zero %iowait stalls) and replicate :9010; Keepers + DynamoDB coordinate Raft and Spot leases; Purple CAS stores each cold XXH3-128 blob ONCE (1×) and relinks in ~2.4s; Spot Readers serve queries from RAM and local NVMe cas_cache.",
        kv: [
          ["Ingest Scale", "100 TB/day (3.04 PB/month)"],
          ["Compressed Growth", "6.58 TB/day (15.2× ZSTD)"],
          ["Writers Fleet", "1× OD (w0) + 9× *gd Spot (NVMe)"],
          ["Readers Fleet", "6× 4-vCPU *gd Spot (NVMe Cache)"]
        ],
        facts: [
          {c:C.hot,   t:"1. Writers + NVMe Hot (Orange)", v:"writer-0 OD + 9× *gd Spot ($2,290/mo)", s:"writer-0 starts backup-0 · NVMe hot (~3 GB/s)"},
          {c:C.coord, t:"2. Quorum, Leases & Backup (Emerald)", v:"3× OD Keepers · $162/mo", s:"writer-0 wakes backup-0 @ 02:00 UTC · DDB leases"},
          {c:C.cas,   t:"3. CAS Cold Pool (Purple)", v:"1× XXH3-128 S3 · $1,059–$4,993/mo", s:"Zero-byte relink · Free S3 Gateway"},
          {c:C.read,  t:"4. NVMe Readers (Sky Blue)", v:"6× *gd Spot ($0 NVMe cache) · $330/mo", s:"$0.0015/GB @ 7d · $0.0028/GB @ 33d"}
        ]
      },
      hot: {
        title: "1. Writers Fleet · writer-0 On-Demand + writer-1..9 Spot & NVMe Hot (Orange)",
        color: C.hot,
        body: "Ingest producers push 100 TB/day (~590k rows/sec) over TLS through Writers NLB (:8443) to ten 16-vCPU / 64 GiB *gd writers. writer-0 is pinned On-Demand (on_demand_base_capacity=1) because it triggers nightly backup-wake for backup-0 plus GC/autoscale; writer-1..9 run 100% Spot (reclaimable anytime). Bundled local NVMe SSDs (~950 GB, $0 EBS) on the hot path deliver ~2–4× gp3 sequential bandwidth—eliminating >65% %iowait stalls during 15.2× ZSTD ~1 GiB merges while :9010 syncs committed parts intra-AZ ($0/GB).",
        kv: [
          ["Writers (1× OD + 9× Spot)", "~$2,290/mo (w0 OD · w1..9 Spot)"],
          ["NVMe Hot + Meta Disk", "$0 NVMe (~3 GB/s) + $102/mo 128G gp3"],
          ["Compression Ratio", "15.2× ZSTD (6.58 TB/day net)"],
          ["Backup Coordinator", "On-Demand writer-0 → backup-wake"]
        ],
        facts: [
          {c:C.hot, t:"Why writer-0 Stays On-Demand", v:"Triggers 02:00 UTC backup-wake + GC", s:"on_demand_base_capacity = 1 in Writers ASG"},
          {c:C.hot, t:"Why NVMe on Hot Path", v:"Eliminates gp3 %iowait merge stalls", s:"Multi-GB/s sequential I/O for 1 GiB merges"},
          {c:C.hot, t:"Spot Writer-1..9 Safety", v:"NLB drains + :9010 sync + 1× CAS", s:"Zero data loss when writer-1..9 reclaimed"},
          {c:C.cas, t:"Zero Orphan EBS", v:"NVMe vanishes cleanly with Spot VM", s:"Small 128G gp3 catalog delete_on_term=true"}
        ]
      },
      coord: {
        title: "2. Coordination, Spot Identity & Backup (Emerald)",
        color: C.coord,
        body: "Three On-Demand 2-vCPU / 8 GiB Keeper nodes form a Raft quorum (:9181) tracking ReplicatedMergeTree part logs—CAS never stores blob locks in Keeper. A DynamoDB node-claims table assigns stable ordinal slots (writer-N, reader-N) and deterministic server UUIDs so Spot replacements attach cleanly. On-Demand writer-0 runs `chinit backup-wake` at 02:00 UTC to wake backup-0, which syncs metadata, uploads snapshots, and self-stops.",
        kv: [
          ["Keeper Quorum (3× OD)", "~$162/mo (dedicated gp3 Raft disk)"],
          ["Lease Table", "DynamoDB ch-node-claims (<$5/mo)"],
          ["Backup Trigger", "OD writer-0 wakes backup-0 @ 02:00 UTC"],
          ["Nightly Backup", "On-demand snapshot → isolated bucket"]
        ],
        facts: [
          {c:C.coord, t:"writer-0 → backup-0 Wake", v:"OD writer-0 never Spot-reclaimed", s:"Runs backup-wake, dead-replica-gc & orphan-gc"},
          {c:C.coord, t:"Why Keepers Stay On-Demand", v:"Raft quorum loss halts all writes", s:"3 nodes survive 1 rolling replacement"},
          {c:C.coord, t:"Deterministic CAS UUID", v:"1 conditional DynamoDB write per slot", s:"Prevents CAS owner-fence errors"},
          {c:C.coord, t:"NLB Health Gate", v:"HTTP :8123/replicas_status (200 OK)", s:"30s deregistration on Spot notice"}
        ]
      },
      cas: {
        title: "3. CAS Cold Pool & TTL Lifecycle (Purple) — 1× S3 + Zero-Byte Relink",
        color: C.cas,
        body: "Aged hot parts hash into XXH3-128 content-addressed blobs and upload ONCE (1×) to an unversioned S3 CAS pool through the free VPC S3 Gateway Endpoint ($0/GB, saving $18k+/mo vs. NAT). Replicas share the same prefix (no {replica} segment) and attach cold parts in ~2–3s via CA_RELINK_COOKIE metadata with 0 bytes copied. CAS GC folds ref-logs every 300s. For 7d–33d TTLs, objects stay in S3 Standard (avoiding Standard-IA's 30-day minimum early-deletion fee; IA only pays off at ≥60d retention).",
        kv: [
          ["7-Day Cold Pool (1×)", "46.1 TB · $1,059/mo (vs $10.6k 10×)"],
          ["33-Day Cold Pool (1×)", "217.1 TB · $4,993/mo (vs $49.9k 10×)"],
          ["S3 Gateway Endpoint", "$0.00/GB transfer (saves $18k+/mo)"],
          ["S3 API Spend", "~$580/mo (GC interval = 300s)"]
        ],
        facts: [
          {c:C.cas, t:"1.00× Cold Storage", v:"1 shared S3 copy across all 16+ replicas", s:"Saves $44,941/mo @ 33d vs 10× non-CAS"},
          {c:C.cas, t:"Zero-Byte Relink", v:"CA_RELINK_COOKIE + S3 HEAD verify", s:"~2.4s cold hydrate on Spot scale-out"},
          {c:C.cas, t:"Unversioned CAS Bucket", v:"Versioning & Object Lock MUST be OFF", s:"Required for S3 If-Match GC safety"},
          {c:C.cas, t:"No 30d IA Early-Delete Trap", v:"Keep <=47d TTLs in S3 Standard", s:"Standard-IA 30d min fits >=60d TTLs only"}
        ]
      },
      read: {
        title: "4. Readers Fleet · 100% Spot Replicas & NVMe Instance-Store Cache (Sky Blue)",
        color: C.read,
        body: "Query traffic enters query.clickhouse.example:8443 via an ACM-terminated NLB gated by /replicas_status. Six 4-vCPU / 16 GiB Graviton NVMe Spot readers (~$330/mo) handle reads in complete write isolation. Cold CAS relinks copy 0 bytes onto NVMe; each reader's local NVMe SSD (measured 1.8 GB/s direct-IO vs 131 MB/s baseline gp3, 3.4× larger at $0 extra EBS) acts as a lazy SLRU cache only for cold byte-ranges scanned by SELECTs.",
        kv: [
          ["Spot NVMe Readers (6×)", "~$330/mo + $31/mo small gp3 meta"],
          ["NVMe cas_cache", "217 GiB NVMe (4×48.65G SLRU · $0 EBS)"],
          ["RAM Caches", "5 GiB Mark + 8 GiB Uncompressed"],
          ["Measured Direct-IO", "1.8 GB/s NVMe vs 131 MB/s gp3 (13.7×)"]
        ],
        facts: [
          {c:C.read, t:"NVMe Instance-Store Win", v:"1.8 GB/s read vs 131 MB/s gp3 cache", s:"Zero EBS cache cost + 3.4× larger SLRU"},
          {c:C.read, t:"No Eager Cold Pull", v:"Relink = 0B; NVMe warms lazily on SELECT", s:"Hot parts (<TTL) stay on hot disk, not NVMe"},
          {c:C.read, t:"Zero-Copy Cold Scale-Out", v:"New Spot readers relink in ~2–3s", s:"Multi-AZ *gd pool stops single-AZ pinches"},
          {c:C.read, t:"Strict Read Isolation", v:"Read-only users + strict query quotas", s:"Ingest spikes never starve queries"}
        ]
      }
    };

    var ZONES = [
      {id:"hot",    x:14,   y:34,  w:652, h:398, color:C.hot,    title:"1. Writers Fleet · writer-0 (On-Demand) + writer-1..9 (Spot) & NVMe Hot"},
      {id:"coord",  x:14,   y:446, w:652, h:194, color:C.coord,  title:"2. Keeper Raft Quorum, Spot Leases & Backup"},
      {id:"cas",    x:678,  y:34,  w:260, h:606, color:C.cas,    title:"3. CAS Cold Pool (1× S3 · 46–217 TB)"},
      {id:"read",   x:1004, y:34,  w:302, h:606, color:C.read,   title:"4. Readers Fleet · 100% Spot & NVMe Cache"},
      {id:"clock",  x:14,   y:652, w:1292,h:78,  color:"#64748b",title:"100 TB/day ClickHouse Transit, Tiering & Unit Cost Clock (15.2× ZSTD · 6.58 TB/day Compressed)"}
    ];

    var NODES = {
      ingest_src:{zone:"hot", x:28,  y:66,  w:244, h:92,  title:"Ingest Producers", sub:"HTTP :8443 / Native :9440", pill:"100 TB/DAY", stat:"rate: ~590k rows/s · 100 TB/d",
                 desc:"Client applications and producers stream batched inserts (100 TB/day raw) directly into ClickHouse over TLS."},
      wnlb:     {zone:"hot",  x:28,  y:202, w:244, h:92,  title:"Writers NLB", sub:"ingest.clickhouse.example:8443", pill:"ACM TLS", stat:"Health: :8123/replicas_status",
                 desc:"Network Load Balancer terminating ACM TLS; drains traffic in 30s if any Spot writer receives a 2-min reclaim notice."},

      wr0:      {zone:"hot",  x:332, y:58,  w:318, h:132, title:"writer-0 (On-Demand)", sub:"16-vCPU *gd OD · Backup Coord", pill:"OD · BACKUP", stat:"On-Demand · wakes backup-0 · :9010",
                 desc:"Pinned On-Demand (never Spot, on_demand_base_capacity=1). Starts nightly backup-0 via chinit backup-wake (02:00 UTC) and coordinates GC/autoscale."},
      wr1:      {zone:"hot",  x:332, y:214, w:318, h:132, title:"writer-1..9", sub:"9× *gd NVMe Spot (ASG 1..9)", pill:"9× SPOT POOL", stat:"1× OD + 9× Spot $2,290/mo · $0 NVMe",
                 desc:"Nine peer Spot writers across 3 *gd Graviton families (reclaimable anytime). Ephemeral NVMe vanishes cleanly; committed parts sync via :9010 & CAS."},
      hot_note: {zone:"hot",  x:28,  y:362, w:622, h:58,  title:"NVMe Hot Path & Spillover Policy (tiered_cas)", sub:"NVMe hot/merge (~3 GB/s, $0 EBS) → 1 GiB wide parts → CAS cold", pill:"NVME HOT", stat:"Eliminates gp3 %iowait stalls · write-through cache · no S3 wait",
                 desc:"NVMe absorbs 100 TB/day inserts, 3 rollup MVs & ~1 GiB ZSTD merges without EBS %iowait bottlenecks; write-through NVMe serves recent hot reads off S3."},

      keeper:   {zone:"coord",  x:28,  y:474, w:240, h:148, title:"Keeper Quorum", sub:"keeper-0, keeper-1, keeper-2", pill:"3× 2vCPU OD", stat:":9181 Raft · ~$162/mo OD",
                 desc:"Three On-Demand 2-vCPU Keeper nodes in dedicated Raft quorum. Coordinates part logs and cluster state (never CAS blob locks)."},
      ddb:      {zone:"coord",  x:282, y:474, w:188, h:148, title:"DDB Claims", sub:"ch-node-claims", pill:"SPOT LEASE", stat:"writer-N / reader-N UUIDs",
                 desc:"Conditional DynamoDB writes grant ephemeral Spot replacements stable ordinal identities, DNS records, and CAS server UUIDs."},
      backup:   {zone:"coord",  x:484, y:474, w:168, h:148, title:"backup-0", sub:"woken by writer-0 (OD)", pill:"02:00 UTC", stat:"Isolated versioned bucket",
                 desc:"Woken nightly at 02:00 UTC by On-Demand writer-0 (chinit backup-wake), syncs metadata, writes tar backups to an isolated bucket, then self-stops."},

      gw:       {zone:"cas",    x:690, y:58,  w:236, h:64,  title:"S3 Gateway Endpoint", sub:"VPC Route · $0.00/GB", pill:"SAVES $18K", stat:"No NAT Gateway ($0.045/GB)",
                 desc:"Keeps 100% of cluster↔S3 writes, relinks, reads, and GC inside AWS at $0/GB instead of $0.045/GB through NAT."},
      cas_pool: {zone:"cas",    x:690, y:138, w:236, h:130, title:"Shared CAS Pool", sub:"s3://…-cas/cas/{default,tiered}/", pill:"1× XXH3-128", stat:"46.1 TB (7d) · 217.1 TB (33d)",
                 desc:"Unversioned S3 pool storing each content-hashed XXH3-128 blob ONCE across all 16+ replicas ($1,059/mo @ 7d; $4,993/mo @ 33d)."},
      relink:   {zone:"cas",    x:690, y:304, w:236, h:88,  title:"Zero-Byte Relink", sub:"CA_RELINK_COOKIE", pill:"0B COPY", stat:"HEAD verify → ~2.4s attach",
                 desc:"Spot readers and peer writers exchange a manifest pointer cookie and relink cold parts directly on S3 with zero bytes copied."},
      cas_gc:   {zone:"cas",    x:690, y:408, w:236, h:96,  title:"CAS GC Leader", sub:"cas_gc_interval_sec = 300", pill:"IF-MATCH", stat:"S3 API ~$580/mo total",
                 desc:"Elected mount folds pool ref-logs every 300s using S3 conditional writes, freeing blobs only when zero replicas reference them."},
      s3_ia:    {zone:"cas",    x:690, y:520, w:236, h:102, title:"S3 Std & TTL Drop", sub:"S3 Std (IA only @ >=60d TTL)", pill:"TTL 33D", stat:"No 30d IA early-delete fee",
                 desc:"For 7d–33d TTLs, cold objects stay in S3 Standard (avoiding Standard-IA's 30-day minimum early-deletion fee) until whole-part TTL drop."},

      qclient:  {zone:"read",   x:1016,y:58,  w:278, h:64,  title:"Query Clients", sub:"Dashboards / API · SELECT", pill:"READ-ONLY", stat:"query.clickhouse.example:8443",
                 desc:"Analytical dashboards and query APIs connect via TLS to Readers NLB with strict read-only ClickHouse credentials."},
      rnlb:     {zone:"read",   x:1016,y:138, w:278, h:62,  title:"Readers NLB", sub:"HTTP :8123/replicas_status", pill:"HEALTH GATE", stat:"30s dereg · ACM TLS",
                 desc:"Health-checked target group ensures new Spot readers finish CAS relinking before receiving query traffic."},
      rd0:      {zone:"read",   x:1016,y:214, w:278, h:124, title:"reader-0", sub:"4-vCPU Graviton NVMe Spot", pill:"NVME SPOT", stat:"5G Mk / 8G Unc · NVMe cache",
                 desc:"Spot NVMe reader (4 vCPU / 16 GiB). Local NVMe instance store caches cold CAS segments at ~2× gp3 speed for $0 extra EBS."},
      rd1:      {zone:"read",   x:1016,y:352, w:278, h:124, title:"reader-1..5", sub:"5× NVMe Spot Pool (ASG 2..10)", pill:"NVME POOL", stat:"6× Spot NVMe ~$330/mo total",
                 desc:"Autoscaled NVMe Spot readers. On scale-out or reclaim, cold history relinks via CAS in ~2.4s and NVMe warms lazily on reads."},
      read_split:{zone:"read",  x:1016,y:492, w:278, h:130, title:"Hot vs. Cold Read Split", sub:"RAM + NVMe cas_cache ($0 EBS)", pill:"CACHE-FIRST", stat:"Miss → S3 Gateway → warm NVMe",
                 desc:"Hot queries hit RAM/NVMe caches (~95%+ hit rate). Only cache misses stream ranges via S3 Gateway and populate local NVMe."}
    };

    var FLOWS = [
      {id:"f_src_wnlb", from:"ingest_src", to:"wnlb", zone:"hot", color:C.hot, rate:1.5, speed:0.86, label:"100 TB/d INSERT", lpos:0.5, d:"M 150 158 L 150 202"},
      {id:"f_wnlb_wr0", from:"wnlb", to:"wr0",      zone:"hot", color:C.hot, rate:1.25, speed:0.74, label:":8123 / :9000", lpos:0.5, d:"M 272 228 C 302 228, 302 124, 332 124"},
      {id:"f_wnlb_wr1", from:"wnlb", to:"wr1",      zone:"hot", color:C.hot, rate:1.35, speed:0.84, label:"", lpos:0.5, d:"M 272 272 L 332 272"},
      {id:"f_wr_rep",   from:"wr0",  to:"wr1",      zone:"hot", color:C.hot, rate:1.4, speed:0.9, bidir:true, label:":9010 sync", lpos:0.5, d:"M 491 190 L 491 214"},
      {id:"f_wr1_hot",  from:"wr1",  to:"hot_note", zone:"hot", color:C.hot, rate:0.95, speed:0.85, label:"15.2× ZSTD", lpos:0.5, d:"M 491 346 L 491 362"},

      {id:"f_wr_keep",  from:"wr1",    to:"keeper", zone:"coord", color:C.coord, rate:1.05, speed:0.56, label:"part log :9181", lpos:0.65, d:"M 650 326 L 660 326 L 660 436 L 240 436 L 240 474"},
      {id:"f_ddb_wr",   from:"ddb",    to:"wr1",    zone:"coord", color:C.coord, rate:0.45, speed:0.6,  label:"lease", lpos:0.42, d:"M 376 474 L 376 444 L 656 444 L 656 336 L 650 336"},
      {id:"f_ddb_rd",   from:"ddb",    to:"rd1",    zone:"coord", color:C.coord, rate:0.4,  speed:0.42, label:"reader-N claim", lpos:0.45, d:"M 436 622 L 436 635 L 986 635 L 986 446 L 1016 446"},
      {id:"f_wr_bk",    from:"wr0",    to:"backup", zone:"coord", color:C.coord, rate:0.35, speed:0.55, label:"backup-wake", lpos:0.84, d:"M 650 174 L 664 174 L 664 454 L 594 454 L 594 474"},
      {id:"f_keep_rd",  from:"keeper", to:"rd0",    zone:"coord", color:C.coord, rate:0.8,  speed:0.4,  label:"watch :9181", lpos:0.16, d:"M 268 598 L 668 598 L 668 286 L 1016 286"},

      {id:"f_wr_rd0",   from:"wr0", to:"rd0", zone:"hot", color:C.hot, rate:1.15, speed:0.54, label:":9010 hot fetch", lpos:0.89, d:"M 650 158 L 668 158 L 668 286 L 1016 286"},
      {id:"f_wr_rd1",   from:"wr1", to:"rd1", zone:"hot", color:C.hot, rate:1.05, speed:0.52, label:"", lpos:0.5, d:"M 650 286 L 1016 286 L 1016 390"},

      {id:"f_wr0_gw",     from:"wr0",      to:"gw",       zone:"cas", color:C.cas, rate:1.1, speed:0.85, label:"PUT 1×", lpos:0.5, d:"M 650 86 L 690 86"},
      {id:"f_wr1_gw",     from:"wr1",      to:"gw",       zone:"cas", color:C.cas, rate:0.95,speed:0.65, label:"", lpos:0.5, d:"M 650 236 L 668 236 L 668 104 L 690 104"},
      {id:"f_gw_pool",    from:"gw",       to:"cas_pool", zone:"cas", color:C.cas, rate:1.35,speed:0.9,  label:"XXH3-128", lpos:0.5, d:"M 808 122 L 808 138"},
      {id:"f_pool_relink",from:"cas_pool", to:"relink",   zone:"cas", color:C.cas, rate:1.05,speed:0.85, label:"manifest", lpos:0.5, d:"M 808 268 L 808 304"},
      {id:"f_relink_rd0", from:"relink",   to:"rd0",      zone:"cas", color:C.cas, rate:0.95,speed:0.8,  label:"relink ~2s", lpos:0.5, d:"M 926 314 L 1016 314"},
      {id:"f_relink_rd1", from:"relink",   to:"rd1",      zone:"cas", color:C.cas, rate:0.95,speed:0.78, label:"0B copy", lpos:0.5, d:"M 926 364 L 1016 364"},
      {id:"f_relink_gc",  from:"relink",   to:"cas_gc",   zone:"cas", color:C.cas, rate:0.65,speed:0.85, label:"ref-log", lpos:0.5, d:"M 808 392 L 808 408"},
      {id:"f_gc_ia",      from:"cas_gc",   to:"s3_ia",    zone:"cas", color:C.cas, rate:0.5, speed:0.8,  label:"S3 Std · 33d", lpos:0.5, d:"M 808 504 L 808 520"},

      {id:"f_qc_rnlb",   from:"qclient",  to:"rnlb",       zone:"read", color:C.read, rate:1.5, speed:0.9,  label:"SELECT", lpos:0.5, d:"M 1155 122 L 1155 138"},
      {id:"f_rnlb_rd0",  from:"rnlb",     to:"rd0",        zone:"read", color:C.read, rate:1.35,speed:0.9,  label:":8123", lpos:0.5, d:"M 1110 200 L 1110 214"},
      {id:"f_rnlb_rd1",  from:"rnlb",     to:"rd1",        zone:"read", color:C.read, rate:1.25,speed:0.65, label:":8123", lpos:0.35, d:"M 1272 200 L 1272 342 L 1228 342 L 1228 352"},
      {id:"f_rd_split",  from:"rd1",      to:"read_split", zone:"read", color:C.read, rate:1.4, speed:0.9,  label:"NVMe hit", lpos:0.5, d:"M 1155 476 L 1155 492"},
      {id:"f_rd0_split", from:"rd0",      to:"read_split", zone:"read", color:C.read, rate:1.15,speed:0.55, label:"hot RAM", lpos:0.75, d:"M 1032 338 L 1032 492"},
      {id:"f_cas_rd0",   from:"cas_pool", to:"rd0",        zone:"read", color:C.read, rate:0.85,speed:0.75, label:"NVMe miss GET", lpos:0.5, d:"M 926 226 L 1016 226"},
      {id:"f_cas_rd1",   from:"cas_pool", to:"rd1",        zone:"read", color:C.read, rate:0.75,speed:0.58, label:"", lpos:0.5, d:"M 926 250 L 966 250 L 966 418 L 1016 418"}
    ];

    // Inject scoped styles so the embed works cleanly inside Jekyll light & dark themes
    if (!document.getElementById("ch-100tb-style")) {
      var st = document.createElement("style");
      st.id = "ch-100tb-style";
      st.textContent =
        "body:has(#ch-100tb-cas-flow) .wrapper,.wrapper:has(#ch-100tb-cas-flow){max-width:min(1440px,96vw)!important}" +
        ".chf-shell{margin:1.5rem 0 2rem;border:1px solid var(--pn-border,#30363d);border-radius:12px;background:#0b0f17;color:#e6edf3;padding:16px;font-family:ui-sans-serif,-apple-system,\"Segoe UI\",Roboto,sans-serif;box-shadow:var(--pn-shadow,0 4px 18px rgba(0,0,0,.22))}" +
        ".chf-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:10px;padding-bottom:10px;border-bottom:1px solid #263248}" +
        ".chf-title{margin:0;font-size:17px;font-weight:700;color:#f8fafc}" +
        ".chf-sub{font-size:12px;color:#94a3b8;margin-top:3px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}" +
        ".chf-badges{display:flex;flex-wrap:wrap;gap:6px}" +
        ".chf-badge{font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid #263248;background:#121824;color:#94a3b8;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}" +
        ".chf-badge b{color:#f8fafc}" +
        ".chf-bar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #263248}" +
        ".chf-tabs,.chf-acts{display:flex;flex-wrap:wrap;gap:6px;align-items:center}" +
        ".chf-tab{display:inline-flex;align-items:center;gap:6px;background:#121824;border:1px solid #263248;color:#94a3b8;padding:5px 10px;border-radius:7px;font-size:11.5px;font-weight:600;cursor:pointer}" +
        ".chf-tab:hover{color:#f8fafc;border-color:#475569}" +
        ".chf-tab.active{color:#f8fafc;background:#182132;box-shadow:0 0 0 1px currentColor inset}" +
        ".chf-dot{width:8px;height:8px;border-radius:50%;display:inline-block}" +
        ".chf-btn{background:#121824;border:1px solid #263248;color:#e2e8f0;padding:5px 9px;border-radius:7px;font-size:11.5px;font-weight:600;cursor:pointer}" +
        ".chf-btn:hover{background:#182132;border-color:#475569}" +
        ".chf-btn.is-on{border-color:#38bdf8;color:#38bdf8}" +
        ".chf-btn.warn{border-color:rgba(239,68,68,.55);color:#fca5a5;background:rgba(239,68,68,.12)}" +
        ".chf-btn.warn:hover{background:rgba(239,68,68,.22)}" +
        ".chf-costbar{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:10px 0;border-bottom:1px solid #263248}" +
        "@media(max-width:980px){.chf-costbar{grid-template-columns:repeat(auto-fit,minmax(175px,1fr))}}" +
        ".chf-cstat{background:#121824;border:1px solid #263248;border-radius:8px;padding:7px 10px}" +
        ".chf-cstat.save{border-color:rgba(168,85,247,.55);background:rgba(168,85,247,.08)}" +
        ".chf-ck{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8}" +
        ".chf-cv{font-size:13.5px;font-weight:700;color:#f8fafc;margin-top:2px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}" +
        ".chf-cstat.save .chf-cv{color:#d8b4fe}" +
        ".chf-legend{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;font-size:11.5px;color:#94a3b8}" +
        ".chf-litems{display:flex;flex-wrap:wrap;gap:12px}" +
        ".chf-litem{display:inline-flex;align-items:center;gap:5px}" +
        ".chf-sw{width:10px;height:10px;border-radius:3px;display:inline-block}" +
        ".chf-status{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:#e2e8f0;background:#121824;border:1px solid #263248;padding:4px 9px;border-radius:6px}" +
        ".chf-svgwrap{background:#0f1520;border:1px solid #263248;border-radius:10px;padding:6px;overflow-x:auto}" +
        ".chf-svg{display:block;width:100%;height:auto}" +
        "@media(max-width:900px){.chf-svg{min-width:920px}}" +
        ".chf-insp{display:grid;grid-template-columns:1.15fr 1.65fr;gap:10px;margin-top:10px}" +
        "@media(max-width:900px){.chf-insp{grid-template-columns:1fr}}" +
        ".chf-box{background:#121824;border:1px solid #263248;border-radius:9px;padding:10px 12px}" +
        ".chf-box h3{margin:0 0 5px;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8}" +
        ".chf-dtitle{font-size:14px;font-weight:700;margin-bottom:4px}" +
        ".chf-dbody{font-size:12px;color:#cbd5e1;margin-bottom:8px;line-height:1.45}" +
        ".chf-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}" +
        ".chf-kvi{background:#182132;border:1px solid #263248;border-radius:6px;padding:6px 8px}" +
        ".chf-kvik{font-size:10px;text-transform:uppercase;color:#94a3b8}" +
        ".chf-kviv{font-size:11.5px;font-weight:600;color:#f8fafc;margin-top:1px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}" +
        ".chf-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:7px}" +
        ".chf-card{background:#182132;border:1px solid #263248;border-left-width:3px;border-radius:6px;padding:7px 9px}" +
        ".chf-card-t{font-size:11px;font-weight:700;color:#f8fafc}" +
        ".chf-card-v{font-size:11.5px;color:#cbd5e1;margin-top:2px}" +
        ".chf-card-s{font-size:10px;color:#94a3b8;margin-top:3px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}";
      document.head.appendChild(st);
    }

    mount.innerHTML =
      '<div class="chf-shell">' +
        '<div class="chf-head">' +
          '<div>' +
            '<div class="chf-title">Interactive Data Flow: 100 TB/day ClickHouse on AWS (OD writer-0 · Spot Writers/Readers · NVMe · 1× CAS)</div>' +
            '<div class="chf-sub">Single-AZ Regional VPC · S3 Gateway Endpoint ($0/GB) · 15.2× ZSTD (6.58 TB/day compressed) · tiered_cas policy</div>' +
          '</div>' +
          '<div class="chf-badges">' +
            '<span class="chf-badge">Writers: <b>1× OD (w0) + 9× *gd Spot</b></span>' +
            '<span class="chf-badge">Readers: <b>6× 4-vCPU *gd Spot</b></span>' +
            '<span class="chf-badge">Keepers: <b>3× 2-vCPU OD</b></span>' +
          '</div>' +
        '</div>' +
        '<div class="chf-bar">' +
          '<div class="chf-tabs">' +
            '<button type="button" class="chf-tab active" data-focus="all"><span class="chf-dot" style="background:#e2e8f0"></span>All Live Flows</button>' +
            '<button type="button" class="chf-tab" data-focus="hot"><span class="chf-dot" style="background:' + C.hot + '"></span>1. Writers (OD+Spot) &amp; NVMe</button>' +
            '<button type="button" class="chf-tab" data-focus="coord"><span class="chf-dot" style="background:' + C.coord + '"></span>2. Keeper &amp; Leases</button>' +
            '<button type="button" class="chf-tab" data-focus="cas"><span class="chf-dot" style="background:' + C.cas + '"></span>3. CAS Cold Pool</button>' +
            '<button type="button" class="chf-tab" data-focus="read"><span class="chf-dot" style="background:' + C.read + '"></span>4. NVMe Spot Readers</button>' +
          '</div>' +
          '<div class="chf-acts">' +
            '<button type="button" class="chf-btn is-on" data-ret="7d">7d Ret</button>' +
            '<button type="button" class="chf-btn" data-ret="33d">33d Ret</button>' +
            '<button type="button" class="chf-btn" id="chf-play">⏸ Pause</button>' +
            '<button type="button" class="chf-btn" data-spd="0.5">0.5×</button>' +
            '<button type="button" class="chf-btn is-on" data-spd="1">1×</button>' +
            '<button type="button" class="chf-btn" data-spd="2">2×</button>' +
            '<button type="button" class="chf-btn warn" id="chf-reclaim">⚡ Reclaim Spot Writer</button>' +
            '<button type="button" class="chf-btn warn" id="chf-reclaim-rd">⚡ Reclaim Spot Reader</button>' +
          '</div>' +
        '</div>' +
        '<div class="chf-costbar" id="chf-costbar"></div>' +
        '<div class="chf-legend">' +
          '<div class="chf-litems">' +
            '<span class="chf-litem"><span class="chf-sw" style="background:' + C.hot + '"></span>Writers (OD w0 + Spot w1..9) &amp; NVMe</span>' +
            '<span class="chf-litem"><span class="chf-sw" style="background:' + C.coord + '"></span>Keeper Raft, DDB Leases &amp; Backup</span>' +
            '<span class="chf-litem"><span class="chf-sw" style="background:' + C.cas + '"></span>CAS Cold Pool (1× + Relink + GC)</span>' +
            '<span class="chf-litem"><span class="chf-sw" style="background:' + C.read + '"></span>NVMe Spot Readers &amp; Cache</span>' +
          '</div>' +
          '<div class="chf-status" id="chf-status">LIVE @ 100 TB/day: writer-0 OD (backup coord) + Spot w1..9 &amp; r0..5 streaming</div>' +
        '</div>' +
        '<div class="chf-svgwrap"><svg class="chf-svg" id="chf-board" viewBox="0 0 1320 744" preserveAspectRatio="xMidYMid meet"></svg></div>' +
        '<div class="chf-insp">' +
          '<div class="chf-box">' +
            '<h3>Selected Section / Role</h3>' +
            '<div class="chf-dtitle" id="chf-dtitle"></div>' +
            '<div class="chf-dbody" id="chf-dbody"></div>' +
            '<div class="chf-kv" id="chf-dkv"></div>' +
          '</div>' +
          '<div class="chf-box">' +
            '<h3>100 TB/day Architecture &amp; Cost Facts</h3>' +
            '<div class="chf-cards" id="chf-cards"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    var svg = d3.select("#chf-board");
    var defs = svg.append("defs");
    Object.keys(C).forEach(function (name) {
      defs.append("marker")
        .attr("id", "chf-arr-" + name)
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 8.5).attr("refY", 5)
        .attr("markerWidth", 5.5).attr("markerHeight", 5.5)
        .attr("orient", "auto-start-reverse")
        .append("path").attr("d", "M 0 1 L 9 5 L 0 9 z").attr("fill", C[name]);
    });

    var gZones = svg.append("g");
    var gEdges = svg.append("g");
    var gNodes = svg.append("g");
    var gPkts  = svg.append("g");
    var gClock = svg.append("g");

    function hexRgba(hex, a) {
      var m = hex.replace("#", "");
      var r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
      return "rgba(" + r + "," + g + "," + b + "," + a + ")";
    }

    var zoneEls = {};
    ZONES.forEach(function (z) {
      var g = gZones.append("g");
      var rect = g.append("rect")
        .attr("x", z.x).attr("y", z.y).attr("width", z.w).attr("height", z.h).attr("rx", 10)
        .attr("fill", hexRgba(z.color, 0.06))
        .attr("stroke", hexRgba(z.color, 0.45))
        .attr("stroke-width", 1.3);
      var lbl = g.append("text")
        .attr("x", z.x + 12).attr("y", z.y + 18)
        .attr("fill", z.color)
        .attr("font-size", 11).attr("font-weight", 700).attr("letter-spacing", 0.6)
        .text(z.title.toUpperCase());
      zoneEls[z.id] = {g: g, rect: rect, lbl: lbl, data: z};
    });

    (function drawClock() {
      var milestones = [
        {x:36,   t:"t = 0",         d:"Batched INSERT → Writers NLB (100 TB/d)", c:C.hot},
        {x:310,  t:"t + 1–5 s",     d:"NVMe hot commit + MVs (0 %iowait)", c:C.hot},
        {x:580,  t:"t + 10–30 s",   d:"Keeper + :9010 sync (Spot-safe)", c:C.coord},
        {x:845,  t:"t + 1–7 d",     d:"CAS Pool (1×) + 2.4s relink", c:C.cas},
        {x:1110, t:"t + 33 d",      d:"S3 Std → TTL drop (no IA penalty)", c:C.read}
      ];
      gClock.append("line").attr("x1", 36).attr("y1", 704).attr("x2", 1275).attr("y2", 704)
        .attr("stroke", "#334155").attr("stroke-width", 2).attr("stroke-dasharray", "4,4");
      milestones.forEach(function (m) {
        gClock.append("circle").attr("cx", m.x).attr("cy", 704).attr("r", 5).attr("fill", m.c);
        gClock.append("text").attr("x", m.x + 10).attr("y", 694).attr("fill", m.c)
          .attr("font-size", 10.5).attr("font-weight", 700).attr("font-family", "ui-monospace,monospace").text(m.t);
        gClock.append("text").attr("x", m.x + 10).attr("y", 711).attr("fill", "#94a3b8")
          .attr("font-size", 10).text(m.d);
      });
    })();

    var colorKey = function (hex) {
      var keys = Object.keys(C);
      for (var i = 0; i < keys.length; i++) if (C[keys[i]] === hex) return keys[i];
      return "dim";
    };

    var edgeEls = {};
    FLOWS.forEach(function (f) {
      var mk = "url(#chf-arr-" + colorKey(f.color) + ")";
      var path = gEdges.append("path")
        .attr("d", f.d).attr("fill", "none").attr("stroke-linecap", "round")
        .attr("stroke", f.color).attr("stroke-width", 2).attr("opacity", 0.55)
        .attr("marker-end", mk);
      if (f.bidir) path.attr("marker-start", mk);

      var lbl = null;
      if (f.label) {
        var node = path.node();
        var pt = node.getPointAtLength(node.getTotalLength() * (f.lpos != null ? f.lpos : 0.5));
        lbl = gEdges.append("text")
          .attr("x", pt.x).attr("y", pt.y - 4)
          .attr("text-anchor", "middle").attr("fill", f.color)
          .attr("font-size", 9.5).attr("font-weight", 600)
          .attr("font-family", "ui-monospace,SFMono-Regular,Menlo,monospace")
          .attr("paint-order", "stroke").attr("stroke", "#0b0f17").attr("stroke-width", 4).attr("stroke-linejoin", "round")
          .text(f.label);
      }
      edgeEls[f.id] = {path: path, lbl: lbl, node: path.node(), len: path.node().getTotalLength(), flow: f};
    });

    var nodeEls = {};
    Object.keys(NODES).forEach(function (id) {
      var n = NODES[id];
      var zc = ZONES.filter(function (z) { return z.id === n.zone; })[0].color;
      var g = gNodes.append("g").style("cursor", "pointer");

      var box = g.append("rect")
        .attr("x", n.x).attr("y", n.y).attr("width", n.w).attr("height", n.h).attr("rx", 8)
        .attr("fill", "#131b29").attr("stroke", hexRgba(zc, 0.7)).attr("stroke-width", 1.4);

      g.append("rect")
        .attr("x", n.x).attr("y", n.y).attr("width", n.w).attr("height", 4).attr("rx", 2)
        .attr("fill", zc);

      g.append("text").attr("x", n.x + 10).attr("y", n.y + 21)
        .attr("fill", "#f8fafc").attr("font-size", 12).attr("font-weight", 700).text(n.title);
      g.append("text").attr("x", n.x + 10).attr("y", n.y + 36)
        .attr("fill", "#94a3b8").attr("font-size", 10.2).attr("font-family", "ui-monospace,SFMono-Regular,Menlo,monospace").text(n.sub);

      var pw = Math.min(104, n.pill.length * 6.2 + 12);
      var pillBg = g.append("rect")
        .attr("x", n.x + n.w - pw - 8).attr("y", n.y + 10).attr("width", pw).attr("height", 16).attr("rx", 4)
        .attr("fill", hexRgba(zc, 0.16)).attr("stroke", hexRgba(zc, 0.5));
      var pillTxt = g.append("text")
        .attr("x", n.x + n.w - pw / 2 - 8).attr("y", n.y + 21)
        .attr("text-anchor", "middle").attr("fill", zc)
        .attr("font-size", 9.5).attr("font-weight", 700).attr("font-family", "ui-monospace,SFMono-Regular,Menlo,monospace")
        .text(n.pill);

      var statTxt = g.append("text")
        .attr("x", n.x + 10).attr("y", n.y + n.h - 9)
        .attr("fill", "#cbd5e1").attr("font-size", 10).attr("font-family", "ui-monospace,SFMono-Regular,Menlo,monospace")
        .text(n.stat);

      if (id === "wr0" || id === "wr1" || id === "rd0" || id === "rd1") {
        var isW = id.indexOf("wr") === 0;
        var y0 = n.y + 48;
        var hw = (n.w - 26) / 2;
        g.append("rect").attr("x", n.x + 10).attr("y", y0).attr("width", hw).attr("height", 42).attr("rx", 5)
          .attr("fill", hexRgba(isW ? C.hot : C.read, 0.12)).attr("stroke", hexRgba(isW ? C.hot : C.read, 0.45));
        g.append("text").attr("x", n.x + 15).attr("y", y0 + 15).attr("fill", isW ? C.hot : C.read)
          .attr("font-size", 9.5).attr("font-weight", 700).text(isW ? "NVMe Hot Disk" : "RAM Cache");
        g.append("text").attr("x", n.x + 15).attr("y", y0 + 30).attr("fill", "#cbd5e1")
          .attr("font-size", 9).attr("font-family", "ui-monospace,monospace").text(isW ? "~3 GB/s · $0 EBS" : "5G Mk / 8G Unc");

        g.append("rect").attr("x", n.x + 16 + hw).attr("y", y0).attr("width", hw).attr("height", 42).attr("rx", 5)
          .attr("fill", hexRgba(C.cas, 0.14)).attr("stroke", hexRgba(C.cas, 0.5));
        g.append("text").attr("x", n.x + 21 + hw).attr("y", y0 + 15).attr("fill", C.cas)
          .attr("font-size", 9.5).attr("font-weight", 700).text(isW ? "cas_cache + Meta" : "cas_cache");
        g.append("text").attr("x", n.x + 21 + hw).attr("y", y0 + 30).attr("fill", "#cbd5e1")
          .attr("font-size", 9).attr("font-family", "ui-monospace,monospace").text(isW ? "NVMe + 128G gp3" : "NVMe local SSD");
      }

      g.on("click", function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); inspectNode(n, zc); });
      nodeEls[id] = {g: g, box: box, pillBg: pillBg, pillTxt: pillTxt, statTxt: statTxt, data: n, zc: zc};
    });

    // Prevent theme SVG lightbox from intercepting clicks inside this interactive diagram
    svg.on("click", function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); });
    document.querySelectorAll(".wrapper").forEach(function (w) {
      w.style.maxWidth = "min(1440px, 96vw)";
    });

    var focus = "all";
    var retMode = "7d";
    var playing = true;
    var speedMul = 1;
    var reclaimState = {active: false, target: null, phase: 0};
    var particles = [];
    var accum = {};
    FLOWS.forEach(function (f) { accum[f.id] = Math.random() * 0.8; });

    function isFlowVisible(f) { return focus === "all" || f.zone === focus; }
    function isZoneVisible(zId) { return focus === "all" || zId === "clock" || zId === focus; }

    function applyFocus() {
      Object.keys(zoneEls).forEach(function (id) {
        var vis = isZoneVisible(id);
        zoneEls[id].rect.attr("opacity", vis ? 1 : 0.25);
        zoneEls[id].lbl.attr("opacity", vis ? 1 : 0.35);
      });
      Object.keys(nodeEls).forEach(function (id) {
        nodeEls[id].g.style("opacity", isZoneVisible(nodeEls[id].data.zone) ? 1 : 0.25);
      });
      Object.keys(edgeEls).forEach(function (id) {
        var e = edgeEls[id];
        var vis = isFlowVisible(e.flow);
        e.path.attr("opacity", vis ? 0.84 : 0.12).attr("stroke-width", vis ? 2.3 : 1.2);
        if (e.lbl) e.lbl.attr("opacity", vis ? 1 : 0.15);
      });
    }

    var lastT = 0;
    d3.timer(function (now) {
      var dt = Math.min((now - lastT) / 1000, 0.08);
      lastT = now;
      if (!playing) return;

      FLOWS.forEach(function (f) {
        if (!isFlowVisible(f) && focus !== "all") return;
        if (reclaimState.active && (f.from === reclaimState.target || f.to === reclaimState.target) && reclaimState.phase < 2) return;

        accum[f.id] += dt * f.rate * speedMul;
        if (accum[f.id] >= 1) {
          accum[f.id] -= 1;
          var e = edgeEls[f.id];
          var dot = gPkts.append("circle")
            .attr("r", focus === "all" ? 4.2 : 5)
            .attr("fill", f.color)
            .attr("stroke", "#0b0f17")
            .attr("stroke-width", 1.2);
          var dir = (f.bidir && Math.random() > 0.5) ? -1 : 1;
          particles.push({dot: dot, edge: e, flow: f, t: dir === 1 ? 0 : 1, dir: dir, spd: f.speed});
        }
      });

      var next = [];
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.t += p.dir * p.spd * dt * speedMul;
        if (p.t < 0 || p.t > 1 || (!isFlowVisible(p.flow) && focus !== "all")) {
          p.dot.remove();
          continue;
        }
        var pt = p.edge.node.getPointAtLength(p.t * p.edge.len);
        p.dot.attr("cx", pt.x).attr("cy", pt.y);
        next.push(p);
      }
      particles = next;
    });

    var tickCount = 0;
    setInterval(function () {
      if (!playing || reclaimState.active) return;
      tickCount++;
      nodeEls.ingest_src.statTxt.text("rate: ~" + (585 + (tickCount % 11)) + "k rows/s · 100 TB/d");
      nodeEls.wnlb.statTxt.text("TLS :8443 · 1 OD + 9 Spot writers 200 OK");
      nodeEls.wr0.statTxt.text("OD · backup-wake · NVMe " + (38 + (tickCount % 7)) + "% · 0% iowait");
      nodeEls.wr1.statTxt.text("9× *gd Spot + 1× OD ($2,290/mo) · lag 0s");
      nodeEls.cas_pool.statTxt.text("1× pool · " + RETENTION_MODELS[retMode].poolSize + " · " + RETENTION_MODELS[retMode].casCost);
      nodeEls.rd0.statTxt.text("NVMe hit: " + (95 + (tickCount % 4)) + "% · 0s lag");
      nodeEls.rd1.statTxt.text("6× *gd NVMe Spot · $330/mo · 200 OK");
    }, 1400);

    function renderCostBar() {
      var m = RETENTION_MODELS[retMode];
      document.getElementById("chf-costbar").innerHTML =
        '<div class="chf-cstat"><div class="chf-ck">1× CAS Cold Pool (' + m.label + ')</div><div class="chf-cv">' + m.poolSize + ' · ' + m.casCost + '</div></div>' +
        '<div class="chf-cstat"><div class="chf-ck">Without CAS (10× Copies)</div><div class="chf-cv">' + m.nonCas10x + '</div></div>' +
        '<div class="chf-cstat"><div class="chf-ck">Compute + Meta EBS + API</div><div class="chf-cv">' + m.computeEbs + '</div></div>' +
        '<div class="chf-cstat"><div class="chf-ck">Total Cluster Cost (100 TB/d)</div><div class="chf-cv">' + m.chTotal + ' (' + m.unitCost + ')</div></div>' +
        '<div class="chf-cstat save"><div class="chf-ck">CAS S3 Savings vs. 10×</div><div class="chf-cv">' + m.savings10x + '</div></div>';
    }

    function runSpotReclaim(target) {
      if (reclaimState.active) return;
      if (!playing) {
        playing = true;
        var playBtn = document.getElementById("chf-play");
        if (playBtn) playBtn.textContent = "⏸ Pause";
      }
      var wrBtn = document.getElementById("chf-reclaim");
      var rdBtn = document.getElementById("chf-reclaim-rd");
      var isWriter = target === "wr1";
      var roleLabel = isWriter ? "Spot Writer" : "Spot Reader";
      var ne = nodeEls[target];
      var origPill = ne.data.pill;
      var origStat = ne.data.stat;
      var affectedEdges = Object.keys(edgeEls).filter(function (id) {
        var f = edgeEls[id].flow;
        return f.from === target || f.to === target;
      });
      reclaimState = {active: true, target: target, phase: 0};
      wrBtn.disabled = true;
      rdBtn.disabled = true;
      (isWriter ? wrBtn : rdBtn).textContent = "⚡ Reclaiming " + target + "…";

      var statusEl = document.getElementById("chf-status");
      statusEl.style.borderColor = C.danger;
      statusEl.innerHTML = isWriter
        ? '<b style="color:' + C.danger + '">⚡ SPOT WRITER RECLAIM (' + target + ')</b>: 2-min notice → NLB /replicas_status drains to surviving Spot writers (committed parts safe on :9010 &amp; CAS)...'
        : '<b style="color:' + C.danger + '">⚡ SPOT READER RECLAIM (' + target + ')</b>: 2-min notice → NLB /replicas_status drains queries to surviving Spot readers...';
      ne.box.attr("stroke", C.danger).attr("stroke-width", 2.4).attr("fill", "#231218");
      ne.pillTxt.text("RECLAIMING").attr("fill", C.danger);
      ne.statTxt.text("NLB /replicas_status → 503 drain");
      affectedEdges.forEach(function (id) {
        edgeEls[id].path.attr("opacity", 0.16).attr("stroke-dasharray", "5,5");
      });

      setTimeout(function () {
        reclaimState.phase = 1;
        statusEl.style.borderColor = C.coord;
        statusEl.innerHTML = isWriter
          ? '<b style="color:' + C.coord + '">↻ SPOT WRITER BOOT (' + target + ')</b>: Old NVMe terminated ($0 orphan EBS) · Replacement *gd Spot claims writer-N in DynamoDB &amp; formats fresh NVMe hot disk...'
          : '<b style="color:' + C.coord + '">↻ SPOT READER BOOT (' + target + ')</b>: Replacement *gd Spot claims reader-N in DynamoDB &amp; formats fresh NVMe cas_cache...';
        ne.box.attr("stroke", C.coord).attr("fill", "#10211c");
        ne.pillTxt.text("BOOT + DDB").attr("fill", C.coord);
        ne.statTxt.text(isWriter ? "chinit: writer-N lease · format NVMe hot" : "chinit: reader-N lease · format NVMe");
      }, 1800);

      setTimeout(function () {
        reclaimState.phase = 2;
        statusEl.style.borderColor = C.cas;
        statusEl.innerHTML = isWriter
          ? '<b style="color:' + C.cas + '">⚡ CAS RELINK + :9010 DELTA (' + target + ')</b>: CA_RELINK_COOKIE attaches 1× CAS (~2.4s, 0 B copy) + :9010 syncs recent hot parts onto NVMe!'
          : '<b style="color:' + C.cas + '">⚡ CAS ZERO-BYTE RELINK (' + target + ')</b>: CA_RELINK_COOKIE attaches cold history in ~2.4s (0 B copied) · NVMe warms lazily!';
        ne.box.attr("stroke", C.cas).attr("fill", "#1b1429");
        ne.pillTxt.text("CAS RELINK").attr("fill", C.cas);
        ne.statTxt.text(isWriter ? "CAS 0 B relink + :9010 hot delta" : "Cold relink: 0 B S3 copy (~2.4s)");
        affectedEdges.forEach(function (id) {
          var isRelink = id.indexOf("relink") !== -1 || id.indexOf("cas") !== -1 || (isWriter && id === "f_wr_rep");
          edgeEls[id].path.attr("stroke-dasharray", null).attr("opacity", isRelink ? 1 : 0.65).attr("stroke-width", isRelink ? 3.2 : 2.1);
        });
      }, 3800);

      setTimeout(function () {
        reclaimState = {active: false, target: null, phase: 0};
        ne.box.attr("stroke", hexRgba(ne.zc, 0.7)).attr("stroke-width", 1.4).attr("fill", "#131b29");
        ne.pillTxt.text(origPill).attr("fill", ne.zc);
        ne.statTxt.text(origStat);
        affectedEdges.forEach(function (id) {
          edgeEls[id].path.attr("stroke-dasharray", null);
        });
        applyFocus();
        wrBtn.disabled = false;
        rdBtn.disabled = false;
        wrBtn.textContent = "⚡ Reclaim Spot Writer";
        rdBtn.textContent = "⚡ Reclaim Spot Reader";
        statusEl.style.borderColor = "#263248";
        statusEl.innerHTML = "LIVE @ 100 TB/day: <b>" + roleLabel + " (" + target + ")</b> recovered via DynamoDB lease + CAS relink + NVMe (0 data loss)";
      }, 6200);
    }

    document.getElementById("chf-reclaim").onclick = function () { runSpotReclaim("wr1"); };
    document.getElementById("chf-reclaim-rd").onclick = function () { runSpotReclaim("rd1"); };

    function renderInspector(secKey) {
      var s = SECTIONS[secKey] || SECTIONS.all;
      var t = document.getElementById("chf-dtitle");
      t.textContent = s.title;
      t.style.color = s.color;
      document.getElementById("chf-dbody").textContent = s.body;
      document.getElementById("chf-dkv").innerHTML = s.kv.map(function (pair) {
        return '<div class="chf-kvi"><div class="chf-kvik">' + pair[0] + '</div><div class="chf-kviv">' + pair[1] + '</div></div>';
      }).join("");
      document.getElementById("chf-cards").innerHTML = s.facts.map(function (f) {
        return '<div class="chf-card" style="border-left-color:' + f.c + '"><div class="chf-card-t">' + f.t + '</div><div class="chf-card-v">' + f.v + '</div><div class="chf-card-s">' + f.s + '</div></div>';
      }).join("");
    }

    function inspectNode(n, color) {
      var t = document.getElementById("chf-dtitle");
      t.textContent = n.title + " (" + n.pill + ")";
      t.style.color = color;
      document.getElementById("chf-dbody").textContent = n.desc;
      document.getElementById("chf-dkv").innerHTML = [
        ["Role / Node", n.title],
        ["Sizing / Spec", n.sub],
        ["100 TB/day Metric", n.stat],
        ["Section", n.zone.toUpperCase()]
      ].map(function (pair) {
        return '<div class="chf-kvi"><div class="chf-kvik">' + pair[0] + '</div><div class="chf-kviv">' + pair[1] + '</div></div>';
      }).join("");
    }

    mount.querySelectorAll(".chf-tab").forEach(function (btn) {
      btn.onclick = function () {
        mount.querySelectorAll(".chf-tab").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        focus = btn.getAttribute("data-focus");
        applyFocus();
        renderInspector(focus);
      };
    });

    mount.querySelectorAll("button[data-ret]").forEach(function (btn) {
      btn.onclick = function () {
        mount.querySelectorAll("button[data-ret]").forEach(function (b) { b.classList.remove("is-on"); });
        btn.classList.add("is-on");
        retMode = btn.getAttribute("data-ret");
        renderCostBar();
      };
    });

    document.getElementById("chf-play").onclick = function (ev) {
      playing = !playing;
      ev.currentTarget.textContent = playing ? "⏸ Pause" : "▶ Play";
    };

    mount.querySelectorAll("button[data-spd]").forEach(function (btn) {
      btn.onclick = function () {
        mount.querySelectorAll("button[data-spd]").forEach(function (b) { b.classList.remove("is-on"); });
        btn.classList.add("is-on");
        speedMul = parseFloat(btn.getAttribute("data-spd"));
      };
    });

    applyFocus();
    renderCostBar();
    renderInspector("all");
  }

  boot();
})();
