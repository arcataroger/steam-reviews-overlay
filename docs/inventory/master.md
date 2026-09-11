# Steam game-card inventory (master set)

Generated 2026-09-11 from 99 pages, 38 kinds, 2608 cards. Regenerate with `npm run inventory` (see .claude/skills/steam-inventory).

| id | name | master key | pages | cards | sizes | features | our treatment | coverage |
|---|---|---|---|---|---|---|---|---|
| K01 | React expanded capsule with info panel (Popular Titles, 920×340) | `div.+3h|.Panel|app,art` | 70 | 840 | 920x340 ×840 | price? date? native? | card ×795/null ×45 · none ×708/sro-inline sro-beside-native ×87 | **covered** |
| K02 | React grid capsule tile (Popular Titles / Top Demos / Popular Discounted rails) | `div.+1h|.ItemCount_N.center_row_trgt|app,art,carousel,art≥50%` | 69 | 768 | 380x220 ×459, 600x320 ×184 | price? carousel | row ×426/card ×184 · sro-inline ×768 | **covered** |
| K03 | Carousel slide: event/news tile (Recent & Upcoming Events) and small capsule variants | `div.carousel__slide.slide___3-Nqo+2h` | 74 | 329 | 300x240 ×268, 360x340 ×18 | news-link price? date? carousel | panel ×309/null ×13 · sro-corner ×301/sro-inline ×23 | **partial** — 5/329 without a label although Steam shows no summary |
| K04 | Sale capsule (home Discounts & Events small art tile) | `a.sale_capsule` | 3 | 123 | 240x160 ×75, 340x200 ×24 | price carousel | card ×117/null ×6 · sro-corner ×123 | **covered** |
| K05 | Charts table row (Top Sellers / Most Played) | `tr._6-rISlJoUe0-` | 1 | 100 | 1140x60 ×100 | price? date? | card ×95/null ×5 · sro-corner ×89/sro-inline sro-beside-title ×10 | **partial** — 1/100 unclaimed |
| K06 | News hub post row | `div.+1h|.Panel|news,art` | 1 | 73 | 1080x280 ×72, 1080x300 | news-link date? native? | panel ×69/null ×4 · sro-corner ×73 | **covered** |
| K07 | Category hero spotlight capsule (1200×540) | `div.+1h|#SaleSection_N|app,art,carousel,art≥50%` | 72 | 72 | 1200x540 ×72 | price? date native? carousel | card ×71/null · sro-inline ×67/none ×3 | **covered** |
| K08 | Home hero broadcast capsule (Featured & Recommended) | `a.broadcast_capsule+1h` | 3 | 36 | 1200x480 ×30, 760x440 ×6 | price? native carousel | card ×30/row ×6 · none ×23/sro-inline sro-beside-native ×13 | **covered** |
| K09 | Classless React tile (Most Wanted Upcoming, Popular Game Demos, app-page content rows) | `div.` | 5 | 33 | 380x220 ×18, 560x300 ×6 | news-link price? date? | row ×13/null ×11 · sro-inline ×25/sro-corner ×6 | **partial** — 2/33 unclaimed |
| K10 | Tab row (explore/new Popular New Releases list) | `a.tab_item` | 2 | 32 | 800x60 ×31, 820x60 | price? date? platforms | row ×16/null ×16 · sro-corner ×32 | **covered** |
| K11 | Home tab row item (Trending Free etc.) | `a.tab_row_item` | 3 | 30 | 840x80 ×30 | price date | row ×30 · sro-corner ×30 | **covered** |
| K12 | React demo row with info panel (Popular Game Demos, 940×160) | `div.+1h|.Panel|app,art` | 2 | 24 | 940x160 ×24 | price? date native? | row ×17/null ×7 · none ×17/sro-inline ×7 | **covered** |
| K13 | Specials small capsule (Under $10 / Under $5) | `a.special.special_img_ctn` | 1 | 24 | 200x100 ×24 | price | row ×21/null ×3 · sro-corner ×24 | **covered** |
| K14 | Store capsule (Released This Month, Popular wishlisted) | `a.store_capsule` | 2 | 18 | 240x140 ×18 | price? carousel | card ×10/null ×8 · sro-corner ×18 | **covered** |
| K15 | Daily deal capsule (TODAY'S DEAL tag) | `a.daily_deal.sale_capsule.store_capsule` | 3 | 18 | 340x200 ×18 | price carousel | card ×18 · sro-corner ×18 | **covered** |
| K16 | Community recommendation review card | `div#AppN.appeared.has_microtrailer.reviewed_app` | 1 | 15 | 1160x340 ×15 | price native | card ×15 · sro-corner ×15 | **covered** |
| K17 | Home spotlight (Discounts & Events, 340×440; sale/event spotlights have no app link) | `div.+1h|.carousel_items|app,art,carousel,art≥50%` | 3 | 15 | 340x440 ×15 | price carousel | null ×9/card ×6 · null ×9/sro-corner ×6 | **partial** — 9/15 unclaimed |
| K18 | Tag browse game tile | `div.browse_tag_game` | 1 | 9 | 300x180 ×9 | price? | card ×9 · sro-corner ×9 | **covered** |
| K19 | Charts overview rank link (text only) | `a.S0OGjWAy4Co-` | 1 | 8 | 540x40 ×8 |  | null ×8 · null ×8 | **text-link** — 8/8 unclaimed |
| K20 | Labs experiment capsule (not a game) | `div.capsule` | 1 | 7 | 680x460 ×2, 680x400 ×2 | news-link date? | null ×7 · none ×6/null | **partial** — 1/7 unclaimed; 6/7 without a label although Steam shows no summary |
| K21 | Community recommendation review card (variant) | `div#AppN.appeared.has_microtrailer.reviewed_app+1h` | 1 | 5 | 1160x340 ×5 | price native | card ×5 · sro-corner ×5 | **covered** |
| K22 | Home takeover banner (1380×460) | `a.+1h|.has_takeover.mobile_sizer_set.mobile_static_set|app,art` | 3 | 3 | 1380x460 ×3 |  | card ×3 · sro-corner ×3 | **covered** |
| K23 | Home takeunder banner (hidden fallback anchor, no art) | `div.home_page_content.takeunder` | 3 | 3 | 1200x200 ×3 |  | null ×3 · none ×3 | **partial** — 3/3 without a label although Steam shows no summary |
| K24 | App-page breadcrumbs (not a card) | `div.breadcrumbs` | 2 | 2 | 1200x40 ×2 |  | null ×2 · null ×2 | **text-link** — 2/2 unclaimed |
| K25 | App-page DLC row / cart form | `form.` | 2 | 2 | 780x120, 780x20 | price? | row/null · sro-inline/null | **partial** — 1/2 unclaimed |
| K26 | Panel holding a news link (app-page events widget, news hub) | `div.Panel+1h` | 2 | 2 | 1200x40 ×2 | news-link | null ×2 · null ×2 | **text-link** — 2/2 unclaimed |
| K27 | Charts overview top-3 tile (art + stat) | `div.xjiY68vUbWQ-` | 1 | 2 | 540x380 ×2 |  | card ×2 · sro-corner ×2 | **covered** |
| K28 | Community recommendation review card (no microtrailer) | `div#AppN.appeared.reviewed_app+1h` | 1 | 2 | 1160x340 ×2 | price native | card ×2 · sro-corner ×2 | **covered** |
| K29 | New Releases page capsule (600×340) | `a.+1h|.page_content|app,art,art≥50%` | 1 | 2 | 600x340 ×2 | price | card ×2 · sro-corner ×2 | **covered** |
| K30 | Upcoming Releases bucket capsule (600×340) | `a.+1h|.bucket_contents|app,art,art≥50%` | 1 | 2 | 600x340 ×2 | price? | null ×2 · sro-corner ×2 | **covered** |
| K31 | News hub post tile (row style, Warframe-type single posts) | `div.+4h|.Panel|news,art` | 1 | 2 | 340x120 ×2 | news-link | row ×2 · sro-corner ×2 | **covered** |
| K32 | Category hero capsule, larger variant (1200×560) | `div.Panel+3h` | 1 | 1 | 1200x560 | price date carousel | null · sro-inline | **covered** |
| K33 | Community recommendation review card (no microtrailer, no hashed class) | `div#AppN.appeared.reviewed_app` | 1 | 1 | 1160x340 | price native | card · sro-corner | **covered** |
| K34 | Great on Deck 'Ignored' banner panel | `div.Panel+4h` | 1 | 1 | 1200x240 |  | null · none | **partial** — 1/1 without a label although Steam shows no summary |
| K35 | Labs experiment banner fragment (not a game) | `div.capsule-banner` | 1 | 1 | 680x300 |  | null · null | **gap** — 1/1 unclaimed |
| K36 | Labs experiment text blurb (not a game) | `div.exp_text_ctn` | 1 | 1 | 680x160 | news-link date | null · none | **partial** — 1/1 without a label although Steam shows no summary |
| K37 | Plain text link on a package page (not a card) | `a.` | 1 | 1 | 100x20 |  | null · null | **text-link** — 1/1 unclaimed |
| K38 | BBCode list on a package page (not a card) | `ul.bb_ul` | 1 | 1 | 580x20 |  | null · null | **text-link** — 1/1 unclaimed |

## Kinds in detail

### K01 React expanded capsule with info panel (Popular Titles, 920×340)

- Master key: `div.+3h|.Panel|app,art`; exact signatures: `div.LibraryAssetExpandedDisplay.PZY_7wH_NY7OgzH9MBiB8._2hhNOdcC6yLwL_rugP3YLf`
- Seen on: category_action ×12, category_action_fps ×12, category_action_run_jump ×12, category_action_tps ×12, category_adventure ×12, category_adventure_rpg ×12 (+64)
- Under headings: Popular Titles ×768 / Co-op ×12 / Shared / Split Screen ×12 / Ignored ×12; section: .Panel ×840
- Ancestors: div._1ujNYGRQ8beCcurOxXJxGS < div._21kblrCh3VR0BAgfqxyMRA < div. < div._18byEIHFiivSklOwKqIx2b ×840
- Variants: img=true,price=true,date=true,nativeSummary=true,title=true,platforms=false,carousel=false ×592; img=true,price=false,date=true,nativeSummary=true,title=true,platforms=false,carousel=false ×198; img=true,price=true,date=true,nativeSummary=false,title=true,platforms=false,carousel=false ×39; img=true,price=false,date=true,nativeSummary=false,title=true,platforms=false,carousel=false ×1; img=true,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=false ×1; img=true,price=true,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×5; img=true,price=true,date=true,nativeSummary=true,title=false,platforms=false,carousel=false ×4
- Our treatment: same|shape=card|badge=none ×708 ; same|shape=card|badge=sro-badge sro-inline sro-beside-native ×87 ; same|shape=null|badge=sro-badge sro-inline ×44 ; same|shape=null|badge=sro-badge sro-corner
- Coverage: **covered** 
- Example (category_action, appid 1867240 "Tags", 920x340): card {"position":"relative","display":"flex","overflow":"visible","borderRadius":"0px 5px 0px 0px","backgroundImage":"linear-gradient(rgba(0, 0, 0, 0.43) 5%, rgb(0, 0, 0) 95%)"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"_2s-O5T3qJJYR2AUq4b9jIN StoreSalePriceWidgetContainer _2xCT1pUf2c9TICHoMcQE0d","position":"relative","display":"flex","textAlign":"start"}; native {"cls":"_6ctF1zf2MKZRofZdWQXqG ReviewScore","text":"Mostly Positive(17,280 English Reviews)"}

### K02 React grid capsule tile (Popular Titles / Top Demos / Popular Discounted rails)

- Master key: `div.+1h|.ItemCount_N.center_row_trgt|app,art,carousel,art≥50%`; exact signatures: `div._3r4Ny9tQdQZc50XDM5B2q2`
- Seen on: category_casual ×20, category_hidden_object ×15, category_metroidvania ×15, category_multiplayer ×15, category_multiplayer_lan ×15, category_multiplayer_local_party ×15 (+63)
- Under headings: Popular Titles ×343 / Top Demos ×295 / Popular Discounted ×110 / Controller-Friendly ×5; section: .ItemCount_3.center_row_trgt ×459 / .ItemCount_2.center_row_trgt ×304
- Ancestors: div.ItemCount_3.SaleSectionContainer.W9_WAYXgEe-t-7aqqC4Jp._3gb3JeV_1IMaIeODzBSrP3.center_row_trgt < div.HlkukqE4fB5si76sBJzKX < div.Panel < div.carousel__inner-slide.slideInner___2mfX9 ×459
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×392; img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×376
- Our treatment: same|shape=row|badge=sro-badge sro-inline ×426 ; same|shape=card|badge=sro-badge sro-inline ×184 ; same|shape=null|badge=sro-badge sro-inline ×158
- Coverage: **covered** 
- Example (category_action, appid 578080 "", 600x320): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"grid","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"16px"}

### K03 Carousel slide: event/news tile (Recent & Upcoming Events) and small capsule variants

- Master key: `div.carousel__slide.slide___3-Nqo+2h`; exact signatures: `div._3Cc2bMRML2lEkSyi2IAZ9G.carousel__slide.slideHorizontal___1NzNV.slide___3-Nqo`
- Seen on: news ×27, greatondeck ×11, vr ×8, app_1675200_Steam_Deck ×4, app_1867240_WARDOGS ×4, app_730_CounterStrike_2 ×4 (+68)
- Under headings: Recent & Upcoming Events ×268 / Yesterday ×15 / Steam Deck Top Played Games ×8 / System Requirements ×8; section: .carousel__slider.vt-scrollable ×329
- Ancestors: div._2VUpHDtxN8lR1LDahY_cI2._3J8-bW87K3pb8EpRNYq0JG.carousel__slider-tray.carousel__slider-tray--horizontal.sliderTray___-vHFQ < div.carousel__slider-tray-wrap--horizontal.carousel__slider-tray-wrapper < div.carousel__slider.carousel__slider--horizontal.horizontalSlider___281Ls.touchDisabled___2qs4y.vt-scrollable < div.SliderBody._2M3SnYGvMvplWUC8yGhowo ×329
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×15; img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×18; link=news,img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=true ×259; link=news,img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×36; img=true,price=true,date=true,nativeSummary=false,title=false,platforms=false,carousel=true ×1
- Our treatment: same|shape=panel|badge=sro-badge sro-corner ×298 ; same|shape=null|badge=sro-badge sro-inline ×10 ; same|shape=row|badge=sro-badge sro-inline ×7 ; same|shape=panel|badge=sro-badge sro-inline ×6
- Coverage: **partial** 5/329 without a label although Steam shows no summary
- Example (app_1675200_Steam_Deck, appid 3527290 "", 260x300): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K04 Sale capsule (home Discounts & Events small art tile)

- Master key: `a.sale_capsule`; exact signatures: `a.sale_capsule`
- Seen on: explore_next_0 ×41, explore_next_3 ×41, home ×41
- Under headings: Under $10 ×75 / Discounts & Events ×24 / Featured tag ×24; section: .carousel_items ×75 / .capsules_col.spotlight_col ×24
- Ancestors: div. < div.carousel_items.store_capsule_container < div.carousel_container.paging_capsules < div#sale_underN_area.home_pagecontent_ctn.sale_capsule_carousel ×75
- Variants: img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×99; img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×24
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×117 ; same|shape=null|badge=sro-badge sro-corner ×6
- Coverage: **covered** 
- Example (explore_next_0, appid 1850570 "", 340x200): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"5%"}; price {"cls":"discount_pct","position":"static","display":"flex","textAlign":"start"}

### K05 Charts table row (Top Sellers / Most Played)

- Master key: `tr._6-rISlJoUe0-`; exact signatures: `tr._6-rISlJoUe0-`
- Seen on: charts_topselling ×100
- Under headings: Top Sellers ×100; section: .cCE5WXLdwQ4- ×100
- Ancestors: tbody. < table.cCE5WXLdwQ4- < div.Panel.y8ScxjY4mi8- < div.Panel.Y4tvTqCXrtc- ×100
- Variants: img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×67; img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×21; img=true,price=true,date=false,nativeSummary=false,title=true,platforms=false,carousel=false ×7; img=true,price=false,date=false,nativeSummary=false,title=true,platforms=false,carousel=false ×3; img=false,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×1; img=true,price=true,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×1
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×85 ; same|shape=card|badge=sro-badge sro-inline sro-beside-title ×10 ; same|shape=null|badge=sro-badge sro-corner ×4 ; unclaimed|shape=null|badge=null
- Coverage: **partial** 1/100 unclaimed
- Example (charts_topselling, appid 1867240 "", 1140x60): card {"position":"relative","display":"table-row","overflow":"visible","borderRadius":"0px","backgroundImage":"linear-gradient(90deg, rgba(86, 92, 103, 0.3), rgba(90, 98, 108, 0.3))"}; parent {"display":"table-row-group","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"RzIG00X1Jf8- StoreSalePriceWidgetContainer","position":"relative","display":"flex","textAlign":"right"}

### K06 News hub post row

- Master key: `div.+1h|.Panel|news,art`; exact signatures: `div._398u23KF15gxmeH741ZSyL`
- Seen on: news ×73
- Under headings: Yesterday ×25 / Wednesday ×23 / Tuesday ×17 / Today ×8; section: .Panel ×73
- Ancestors: div._1U2BW9tpHKOVi_TG0XvjT._3FpvGiwJqnukNOcrsKd_sN < div.Panel._1_BP6N2tGh4484bcmYnZeX < div.r3Dia2Yw2X-goqFn-_UPT < div._3yqpPRFLwr6ETVDgLGT37s ×42
- Variants: link=news,img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×62; link=news,img=true,price=false,date=false,nativeSummary=true,title=false,platforms=false,carousel=false ×8; link=news,img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×3
- Our treatment: same|shape=panel|badge=sro-badge sro-corner ×69 ; same|shape=null|badge=sro-badge sro-corner ×4
- Coverage: **covered** 
- Example (news, appid 3669870 "", 1080x280): card {"position":"relative","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"normal"}

### K07 Category hero spotlight capsule (1200×540)

- Master key: `div.+1h|#SaleSection_N|app,art,carousel,art≥50%`; exact signatures: `div._3olpRSXr66ohyQFxmzqokI`
- Seen on: category_action, category_action_fps, category_action_run_jump, category_action_tps, category_adventure, category_adventure_rpg (+66)
- Under headings: Action / First-Person Shooter / Platformers & Runners / Third-Person Shooter; section: #SaleSection_N ×72
- Ancestors: div#SaleSection_N.Panel.SaleSectionCtn.contenthubmaincarousel.expanded.i2PTzRNXOK1OXvXb9-wzd < div.SaleSectionTabListContainer._2VZtqrDRVSIicZZHPUY9SY < div.Panel < div.Panel.SaleOuterContainer._150kddWk8JgylTvh_eC20b ×72
- Variants: img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=true ×14; img=true,price=true,date=true,nativeSummary=false,title=false,platforms=false,carousel=true ×54; img=true,price=true,date=true,nativeSummary=true,title=false,platforms=false,carousel=true ×2; img=true,price=false,date=true,nativeSummary=true,title=false,platforms=false,carousel=true ×2
- Our treatment: same|shape=card|badge=sro-badge sro-inline ×66 ; same|shape=card|badge=none ×3 ; same|shape=card|badge=sro-badge sro-corner ; same|shape=card|badge=sro-badge sro-inline sro-beside-native
- Coverage: **covered** 
- Example (category_action, appid 359550 "", 1200x540): card {"position":"relative","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"hidden auto","overflowX":"hidden","gap":"normal"}

### K08 Home hero broadcast capsule (Featured & Recommended)

- Master key: `a.broadcast_capsule+1h`; exact signatures: `a.broadcast_capsule.store_main_capsule`
- Seen on: explore_next_0 ×12, explore_next_3 ×12, home ×12
- Under headings: Featured & Recommended ×36; section: .carousel_items ×36
- Ancestors: div.carousel_items.store_capsule_container < div.carousel_container.maincap < div.home_cluster_ctn.home_pagecontent_ctn.v2 < div#home_maincap_vN.carousel_wide_mode ×36
- Variants: img=true,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=true ×25; img=true,price=false,date=false,nativeSummary=true,title=true,platforms=false,carousel=true ×10; img=false,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=true ×1
- Our treatment: same|shape=card|badge=none ×19 ; same|shape=card|badge=sro-badge sro-inline sro-beside-native ×11 ; same|shape=row|badge=none ×4 ; same|shape=row|badge=sro-badge sro-inline sro-beside-native ×2
- Coverage: **covered** 
- Example (explore_next_0, appid 1867240 "WARDOGS", 760x440): card {"position":"absolute","display":"grid","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"discount_final_price","position":"static","display":"block","textAlign":"right"}; native {"cls":"review_summary","text":"Mostly Positive (17,280 Reviews)"}

### K09 Classless React tile (Most Wanted Upcoming, Popular Game Demos, app-page content rows)

- Master key: `div.`; exact signatures: `div.`
- Seen on: greatondeck ×17, dlcforyou ×8, demos ×6, app_1867240_WARDOGS, app_730_CounterStrike_2
- Under headings: Popular Titles ×17 / Most Wanted Upcoming ×8 / Popular Game Demos ×6 / Content For This GameBrowse all (1) ×2; section: .ItemCount_3.center_row_trgt ×21 / .ItemCount_2.center_row_trgt ×6
- Ancestors: div.ItemCount_3.SaleSectionContainer.W9_WAYXgEe-t-7aqqC4Jp._3gb3JeV_1IMaIeODzBSrP3.center_row_trgt < div.Panel < div.Panel.SaleSectionForCustomCSS._1cOoCFwafBlSkwllIMf3XM._39HWXhhjsbML7K9sme9ItV < div#SaleSection_N.Panel.SaleSectionCtn.expanded.i2PTzRNXOK1OXvXb9-wzd.items ×15
- Variants: link=news,img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×2; img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×7; img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×5; img=true,price=true,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×3; img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×16
- Our treatment: same|shape=row|badge=sro-badge sro-inline ×13 ; same|shape=null|badge=sro-badge sro-inline ×7 ; same|shape=card|badge=sro-badge sro-inline ×5 ; same|shape=card|badge=sro-badge sro-corner ×4
- Coverage: **partial** 2/33 unclaimed
- Example (app_1867240_WARDOGS, appid 1867240 "", 780x380): card {"position":"static","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K10 Tab row (explore/new Popular New Releases list)

- Master key: `a.tab_item`; exact signatures: `a.tab_item`
- Seen on: explore_new ×16, explore_upcoming ×16
- Under headings: Popular New Releases ×16 / Popular wishlisted games ×16; section: .tab_content_items ×16 / #tab_popular_comingsoon_content ×16
- Ancestors: div.tab_content_items < div#tab_newreleases_content.tab_content < div.home_tabs_content < div.home_leftcol.home_tab_col ×16
- Variants: img=true,price=true,date=false,nativeSummary=false,title=true,platforms=true,carousel=false ×16; img=true,price=false,date=true,nativeSummary=false,title=true,platforms=true,carousel=false ×13; img=true,price=true,date=true,nativeSummary=false,title=true,platforms=true,carousel=false ×3
- Our treatment: same|shape=row|badge=sro-badge sro-corner ×16 ; same|shape=null|badge=sro-badge sro-corner ×16
- Coverage: **covered** 
- Example (explore_new, appid 1465470 "The Crust", 800x60): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"discount_pct","position":"static","display":"flex","textAlign":"right"}

### K11 Home tab row item (Trending Free etc.)

- Master key: `a.tab_row_item`; exact signatures: `a.tab_row_item`
- Seen on: explore_next_0 ×10, explore_next_3 ×10, home ×10
- Under headings: Trending Free ×30; section: .tab_content_items ×30
- Ancestors: div.tab_content_items < div#tab_newreleases_content.home_tab_content < div#home_tabs_row.home_tabs_sections.row_list_view < div.home_tabs_columns ×30
- Variants: img=true,price=true,date=true,nativeSummary=false,title=true,platforms=false,carousel=false ×30
- Our treatment: same|shape=row|badge=sro-badge sro-corner ×30
- Coverage: **covered** 
- Example (explore_next_0, appid 1465470 "The Crust", 840x80): card {"position":"relative","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"10px"}; price {"cls":"discount_pct","position":"static","display":"flex","textAlign":"start"}

### K12 React demo row with info panel (Popular Game Demos, 940×160)

- Master key: `div.+1h|.Panel|app,art`; exact signatures: `div.gASJ2lL_xmVNuZkWGvrWg`
- Seen on: demos ×12, greatondeck ×12
- Under headings: Popular Game Demos ×12 / Popular Titles ×12; section: .Panel ×24
- Ancestors: div._1ujNYGRQ8beCcurOxXJxGS < div._21kblrCh3VR0BAgfqxyMRA < div. < div._18byEIHFiivSklOwKqIx2b ×24
- Variants: img=true,price=false,date=true,nativeSummary=false,title=true,platforms=false,carousel=false ×7; img=true,price=false,date=true,nativeSummary=true,title=true,platforms=false,carousel=false ×5; img=true,price=true,date=true,nativeSummary=true,title=true,platforms=false,carousel=false ×12
- Our treatment: same|shape=row|badge=none ×17 ; same|shape=null|badge=sro-badge sro-inline ×7
- Coverage: **covered** 
- Example (demos, appid 4232490 "捉迷藏 Demo", 940x160): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K13 Specials small capsule (Under $10 / Under $5)

- Master key: `a.special.special_img_ctn`; exact signatures: `a.special.special_img_ctn`
- Seen on: explore_new ×24
- Under headings: Under $10 ×12 / Under $5 ×12; section: .home_specials_ctn.sidebar_wide.underten ×12 / .home_specials_ctn.underfive.underten ×12
- Ancestors: div.home_specials_grid < div.home_specials_ctn.sidebar_wide.underten < div.home_rightcol < div.page_content ×12
- Variants: img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×24
- Our treatment: same|shape=row|badge=sro-badge sro-corner ×21 ; same|shape=null|badge=sro-badge sro-corner ×3
- Coverage: **covered** 
- Example (explore_new, appid 4001890 "", 200x100): card {"position":"relative","display":"flex","overflow":"hidden","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"4px"}; price {"cls":"discount_final_price","position":"static","display":"block","textAlign":"start"}

### K14 Store capsule (Released This Month, Popular wishlisted)

- Master key: `a.store_capsule`; exact signatures: `a.store_capsule`
- Seen on: explore_new ×10, explore_upcoming ×8
- Under headings: Released This Month ×10 / Popular wishlisted games ×8; section: .bucket_contents.peeking_carousel ×10 / .bucket_contents ×8
- Ancestors: div.bucket_contents.peeking_carousel.store_capsule_container_scrolling.store_horizontal_autoslider < div.store_horizontal_autoslider_ctn < div.bucket < div.newonsteam_buckets.page_content ×10
- Variants: img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×13; img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×5
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×10 ; same|shape=null|badge=sro-badge sro-corner ×8
- Coverage: **covered** 
- Example (explore_new, appid 1867240 "", 240x140): card {"position":"relative","display":"inline-block","overflow":"visible","borderRadius":"0px","backgroundImage":"radial-gradient(62.67% 62.67% at 62.67% 100%, rgb(61, 72, 86) 0%, rgb(40, 54, 69) 100%)"}; parent {"display":"block","flexDirection":"row","overflow":"scroll hidden","overflowX":"scroll","gap":"normal"}; price {"cls":"discount_final_price","position":"static","display":"block","textAlign":"right"}

### K15 Daily deal capsule (TODAY'S DEAL tag)

- Master key: `a.daily_deal.sale_capsule.store_capsule`; exact signatures: `a.daily_deal.sale_capsule.store_capsule`
- Seen on: explore_next_0 ×6, explore_next_3 ×6, home ×6
- Under headings: Discounts & Events ×18; section: .capsules_col.spotlight_col ×18
- Ancestors: div.capsules_col.spotlight_col < div.home_special_offers_group.spotlight_double_column < div.carousel_items < div#spotlight_carousel.carousel_container.spotlight.v2 ×12
- Variants: img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×18
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×18
- Coverage: **covered** 
- Example (explore_next_0, appid 237850 "", 340x200): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"5%"}; price {"cls":"discount_pct","position":"static","display":"flex","textAlign":"right"}

### K16 Community recommendation review card

- Master key: `div#AppN.appeared.has_microtrailer.reviewed_app`; exact signatures: `div#AppN.appeared.has_microtrailer.reviewed_app`
- Seen on: communityrecommendations ×15
- Under headings: There are no reviews that match the filters set above ×15; section: #reviewed_apps ×15
- Ancestors: div#reviewed_apps.trending_reviews_content < div.page_content < div.page_content_ctn < div#responsive_page_template_content.responsive_page_template_content ×15
- Variants: img=true,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=false ×15
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×15
- Coverage: **covered** 
- Example (communityrecommendations, appid 2536520 "Bearsonal", 1160x340): card {"position":"relative","display":"flex","overflow":"hidden","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"discount_pct","position":"static","display":"block","textAlign":"start"}; native {"cls":"reviews","text":"A Classic for a Reason I haven't played "}

### K17 Home spotlight (Discounts & Events, 340×440; sale/event spotlights have no app link)

- Master key: `div.+1h|.carousel_items|app,art,carousel,art≥50%`; exact signatures: `div.home_area_spotlight`
- Seen on: explore_next_0 ×5, explore_next_3 ×5, home ×5
- Under headings: Discounts & Events ×15; section: .carousel_items ×15
- Ancestors: div.home_special_offers_group.spotlight_double_column < div.carousel_items < div#spotlight_carousel.carousel_container.spotlight.v2 < div.special_offers ×12
- Variants: img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×15
- Our treatment: unclaimed|shape=null|badge=null ×9 ; same|shape=card|badge=sro-badge sro-corner ×6
- Coverage: **partial** 9/15 unclaimed
- Example (explore_next_0, appid 2852190 "", 340x440): card {"position":"relative","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"grid","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"18px"}; price {"cls":"discount_pct","position":"static","display":"flex","textAlign":"start"}

### K18 Tag browse game tile

- Master key: `div.browse_tag_game`; exact signatures: `div.browse_tag_game`
- Seen on: tag_browse ×9
- Under headings: Indie Browse all 112,813 ×9; section: .game_grid ×9
- Ancestors: div.game_grid < div.browse_tag_games < div.tag_browse_games_results < div#tag_browse_games_ctn.tag_browse_games_ctn ×9
- Variants: img=true,price=true,date=false,nativeSummary=false,title=true,platforms=false,carousel=false ×8; img=true,price=false,date=false,nativeSummary=false,title=true,platforms=false,carousel=false ×1
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×9
- Coverage: **covered** 
- Example (tag_browse, appid 2306620 "Risk of Rain 2: Seekers of the Storm", 300x180): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"12px"}; price {"cls":"browse_tag_game_price","position":"static","display":"block","textAlign":"start"}

### K19 Charts overview rank link (text only)

- Master key: `a.S0OGjWAy4Co-`; exact signatures: `a.S0OGjWAy4Co-`
- Seen on: charts ×8
- Under headings: CHARTS OVERVIEW ×8; section: .NBN-f1mBrso-.Panel ×8
- Ancestors: div.NBN-f1mBrso-.Panel < div.Panel < div.fm1dMrfMpDc- < div.Panel.uX4qL3T--O8-.wnzEl6A2mnI- ×8
- Variants: img=false,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×8
- Our treatment: unclaimed|shape=null|badge=null ×8
- Coverage: **text-link** 8/8 unclaimed
- Example (charts, appid 730 "", 540x40): card {"position":"static","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K20 Labs experiment capsule (not a game)

- Master key: `div.capsule`; exact signatures: `div.capsule`
- Seen on: labs ×7
- Under headings: Active Experiments / 016 Personal Calendar / Past Experiments / 009 News Hub; section: .left-column ×7
- Ancestors: div.left-column < div.labs-content < div.page_content < div.labs.page_content_ctn ×7
- Variants: link=news,img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×3; img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×3; img=true,price=false,date=true,nativeSummary=false,title=true,platforms=false,carousel=false ×1
- Our treatment: same|shape=null|badge=none ×6 ; unclaimed|shape=null|badge=null
- Coverage: **partial** 1/7 unclaimed; 6/7 without a label although Steam shows no summary
- Example (labs, appid 593110 "", 680x460): card {"position":"static","display":"block","overflow":"visible","borderRadius":"4px","backgroundImage":"radial-gradient(at 0% 0%, rgb(81, 95, 133), rgb(24, 38, 74))"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K21 Community recommendation review card (variant)

- Master key: `div#AppN.appeared.has_microtrailer.reviewed_app+1h`; exact signatures: `div#AppN.appeared.has_microtrailer.has_multiple_reviews.reviewed_app`
- Seen on: communityrecommendations ×5
- Under headings: There are no reviews that match the filters set above ×5; section: #reviewed_apps ×5
- Ancestors: div#reviewed_apps.trending_reviews_content < div.page_content < div.page_content_ctn < div#responsive_page_template_content.responsive_page_template_content ×5
- Variants: img=true,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=false ×5
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×5
- Coverage: **covered** 
- Example (communityrecommendations, appid 275850 "Anakin Skywalker", 1160x340): card {"position":"relative","display":"flex","overflow":"hidden","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"discount_pct","position":"static","display":"block","textAlign":"start"}; native {"cls":"reviews","text":"No Man's Sky had the best comeback story"}

### K22 Home takeover banner (1380×460)

- Master key: `a.+1h|.has_takeover.mobile_sizer_set.mobile_static_set|app,art`; exact signatures: `a.home_page_takeover_sizer`
- Seen on: explore_next_0, explore_next_3, home
- Under headings: -; section: .has_takeover.mobile_sizer_set.mobile_static_set ×3
- Ancestors: div.home_page_takeover_link < div.has_takeover.home_page_body_ctn.mobile_sizer_set.mobile_static_set < div#responsive_page_template_content.responsive_page_template_content < div.responsive_page_content ×3
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×3
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×3
- Coverage: **covered** 
- Example (explore_next_0, appid 275850 "", 1380x460): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K23 Home takeunder banner (hidden fallback anchor, no art)

- Master key: `div.home_page_content.takeunder`; exact signatures: `div.home_page_content.takeunder`
- Seen on: explore_next_0, explore_next_3, home
- Under headings: Featured & Recommended ×3; section: #home_takeunder_ctn ×3
- Ancestors: div#home_takeunder_ctn.home_pagecontent_ctn < div.main_content_ctn < div.has_takeover.home_page_body_ctn.mobile_sizer_set.mobile_static_set < div#responsive_page_template_content.responsive_page_template_content ×3
- Variants: img=false,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×3
- Our treatment: same|shape=null|badge=none ×3
- Coverage: **partial** 3/3 without a label although Steam shows no summary
- Example (explore_next_0, appid 4197860 "", 1200x200): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K24 App-page breadcrumbs (not a card)

- Master key: `div.breadcrumbs`; exact signatures: `div.breadcrumbs`
- Seen on: app_1867240_WARDOGS, app_730_CounterStrike_2
- Under headings: -; section: .game_title_area.page_content.page_title_area ×2
- Ancestors: div.game_title_area.page_content.page_title_area < div.page_top_area < div.page_content_ctn < div#tabletGrid.tablet_grid ×2
- Variants: img=false,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×2
- Our treatment: unclaimed|shape=null|badge=null ×2
- Coverage: **text-link** 2/2 unclaimed
- Example (app_1867240_WARDOGS, appid 1867240 "", 1200x40): card {"position":"static","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K25 App-page DLC row / cart form

- Master key: `form.`; exact signatures: `form.`
- Seen on: app_1867240_WARDOGS, app_730_CounterStrike_2
- Under headings: Content For This GameBrowse all (1) ×2; section: #gameAreaDLCSection ×2
- Ancestors: div.game_area_dlc_list < div#gameAreaDLCSection.game_area_dlc_section < div#game_area_purchase.game_area_purchase < div.game_description_column.leftcol ×2
- Variants: img=true,price=true,date=false,nativeSummary=false,title=true,platforms=false,carousel=false ×1; img=false,price=false,date=false,nativeSummary=false,title=true,platforms=false,carousel=false ×1
- Our treatment: same|shape=row|badge=sro-badge sro-inline ; unclaimed|shape=null|badge=null
- Coverage: **partial** 1/2 unclaimed
- Example (app_1867240_WARDOGS, appid 4809960 "Recommended WARDOGS - Supporter Pack", 780x120): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"game_area_dlc_price","position":"static","display":"block","textAlign":"right"}

### K26 Panel holding a news link (app-page events widget, news hub)

- Master key: `div.Panel+1h`; exact signatures: `div.Panel._8bfDpjt5qevt4WIKJfbhY`
- Seen on: app_1867240_WARDOGS, app_730_CounterStrike_2
- Under headings: Mostly Positive / Very Positive; section: #app_reviews_hash ×2
- Ancestors: div. < div. < div#app_reviews_hash.app_reviews_area < div.page_content ×2
- Variants: link=news,img=false,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×2
- Our treatment: unclaimed|shape=null|badge=null ×2
- Coverage: **text-link** 2/2 unclaimed
- Example (app_1867240_WARDOGS, appid 593110 "", 1200x40): card {"position":"static","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K27 Charts overview top-3 tile (art + stat)

- Master key: `div.xjiY68vUbWQ-`; exact signatures: `div.xjiY68vUbWQ-`
- Seen on: charts ×2
- Under headings: CHARTS OVERVIEW ×2; section: .NBN-f1mBrso-.Panel ×2
- Ancestors: div.NBN-f1mBrso-.Panel < div.Panel < div.fm1dMrfMpDc- < div.Panel.uX4qL3T--O8-.wnzEl6A2mnI- ×2
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×2
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×2
- Coverage: **covered** 
- Example (charts, appid 1867240 "", 540x380): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K28 Community recommendation review card (no microtrailer)

- Master key: `div#AppN.appeared.reviewed_app+1h`; exact signatures: `div#AppN.appeared.has_multiple_reviews.reviewed_app`
- Seen on: communityrecommendations ×2
- Under headings: There are no reviews that match the filters set above ×2; section: #reviewed_apps ×2
- Ancestors: div#reviewed_apps.trending_reviews_content < div.page_content < div.page_content_ctn < div#responsive_page_template_content.responsive_page_template_content ×2
- Variants: img=true,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=false ×2
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×2
- Coverage: **covered** 
- Example (communityrecommendations, appid 2421750 "AdrianWithA", 1160x340): card {"position":"relative","display":"flex","overflow":"hidden","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"discount_final_price","position":"static","display":"block","textAlign":"start"}; native {"cls":"reviews","text":"Needs more time to cook Well the gamepla"}

### K29 New Releases page capsule (600×340)

- Master key: `a.+1h|.page_content|app,art,art≥50%`; exact signatures: `a.newonsteam_headercap`
- Seen on: explore_new ×2
- Under headings: New Releases ×2; section: .page_content ×2
- Ancestors: div.newonsteam_capsules.newonsteam_headercaps < div.page_content < div.page_ctn.top_capsules < div.game.game_page_background ×2
- Variants: img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×2
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×2
- Coverage: **covered** 
- Example (explore_new, appid 3751260 "", 600x340): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"linear-gradient(to right, rgb(53, 101, 128) 0%, rgb(64, 121, 153) 100%)"}; parent {"display":"flex","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"20px"}; price {"cls":"discount_final_price","position":"static","display":"block","textAlign":"start"}

### K30 Upcoming Releases bucket capsule (600×340)

- Master key: `a.+1h|.bucket_contents|app,art,art≥50%`; exact signatures: `a.comingsoon_headercap`
- Seen on: explore_upcoming ×2
- Under headings: Upcoming Releases ×2; section: .bucket_contents ×2
- Ancestors: div.bucket_contents.comingsoon_capsules.comingsoon_headercaps < div.page_content < div.page_ctn.top_capsules < div.game.game_page_background ×2
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×1; img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×1
- Our treatment: same|shape=null|badge=sro-badge sro-corner ×2
- Coverage: **covered** 
- Example (explore_upcoming, appid 1757350 "", 600x340): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"linear-gradient(to right, rgb(53, 101, 128) 0%, rgb(64, 121, 153) 100%)"}; parent {"display":"flex","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"20px"}

### K31 News hub post tile (row style, Warframe-type single posts)

- Master key: `div.+4h|.Panel|news,art`; exact signatures: `div._1E3Anhs34BXsWWWqH4RNPL._2BniJe0boLDKV9lwtWTCtm._2vzY3sqcpyNcqGqlP6cLOv._2wHiBVvtv56AMUWeVWRbuz`
- Seen on: news ×2
- Under headings: Coming soon ×2; section: .Panel ×2
- Ancestors: div.Panel._1YVOyhzWrYyfeINbwhHVqc < div.HorizontalTileCtn.muk0v4M7AjwCVox0Kk1Q6 < div._398u23KF15gxmeH741ZSyL < div._1U2BW9tpHKOVi_TG0XvjT._3FpvGiwJqnukNOcrsKd_sN ×2
- Variants: link=news,img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×2
- Our treatment: same|shape=row|badge=sro-badge sro-corner ×2
- Coverage: **covered** 
- Example (news, appid 230410 "", 340x120): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K32 Category hero capsule, larger variant (1200×560)

- Master key: `div.Panel+3h`; exact signatures: `div.Panel._1cOoCFwafBlSkwllIMf3XM._30Yfh62g3YeDgzOL-z9BnJ._39HWXhhjsbML7K9sme9ItV`
- Seen on: category_rpg_jrpg
- Under headings: Popular Titles; section: #SaleSection_N
- Ancestors: div#SaleSection_N.Panel.SaleSectionCtn.expanded.i2PTzRNXOK1OXvXb9-wzd.trailercarousel < div.SaleSectionTabListContainer._2VZtqrDRVSIicZZHPUY9SY < div.Panel < div.Panel.SaleOuterContainer._150kddWk8JgylTvh_eC20b
- Variants: img=true,price=true,date=true,nativeSummary=false,title=false,platforms=false,carousel=true ×1
- Our treatment: same|shape=null|badge=sro-badge sro-inline
- Coverage: **covered** 
- Example (category_rpg_jrpg, appid 2963950 "", 1200x560): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"_2s-O5T3qJJYR2AUq4b9jIN StoreSalePriceWidgetContainer _2f7BMv_bJMTrHmaOF8B3Ws","position":"relative","display":"flex","textAlign":"start"}

### K33 Community recommendation review card (no microtrailer, no hashed class)

- Master key: `div#AppN.appeared.reviewed_app`; exact signatures: `div#AppN.appeared.reviewed_app`
- Seen on: communityrecommendations
- Under headings: There are no reviews that match the filters set above; section: #reviewed_apps
- Ancestors: div#reviewed_apps.trending_reviews_content < div.page_content < div.page_content_ctn < div#responsive_page_template_content.responsive_page_template_content
- Variants: img=true,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=false ×1
- Our treatment: same|shape=card|badge=sro-badge sro-corner
- Coverage: **covered** 
- Example (communityrecommendations, appid 668580 "Slayer", 1160x340): card {"position":"relative","display":"flex","overflow":"hidden","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"discount_pct","position":"static","display":"block","textAlign":"start"}; native {"cls":"reviews","text":"Atomic heart is easily one of my favouri"}

### K34 Great on Deck 'Ignored' banner panel

- Master key: `div.Panel+4h`; exact signatures: `div.OPH8r3-pnCjCM7T8GrpWo.Panel.SaleSectionForCustomCSS._1cOoCFwafBlSkwllIMf3XM._39HWXhhjsbML7K9sme9ItV`
- Seen on: greatondeck
- Under headings: Ignored; section: #SaleSection_N
- Ancestors: div#SaleSection_N.Panel.SaleSectionCtn.expanded.i2PTzRNXOK1OXvXb9-wzd.links < div.SaleSectionTabListContainer._2VZtqrDRVSIicZZHPUY9SY < div.Panel < div.Panel.SaleOuterContainer._150kddWk8JgylTvh_eC20b
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×1
- Our treatment: same|shape=null|badge=none
- Coverage: **partial** 1/1 without a label although Steam shows no summary
- Example (greatondeck, appid 1675200 "", 1200x240): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K35 Labs experiment banner fragment (not a game)

- Master key: `div.capsule-banner`; exact signatures: `div.capsule-banner`
- Seen on: labs
- Under headings: 004.1 Search Query Expansion; section: .capsule
- Ancestors: div.capsule < div.left-column < div.labs-content < div.page_content
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×1
- Our treatment: unclaimed|shape=null|badge=null
- Coverage: **gap** 1/1 unclaimed
- Example (labs, appid 1254040 "", 680x300): card {"position":"static","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K36 Labs experiment text blurb (not a game)

- Master key: `div.exp_text_ctn`; exact signatures: `div.exp_text_ctn`
- Seen on: labs
- Under headings: 004.1 Search Query Expansion; section: .capsule
- Ancestors: div.capsule < div.left-column < div.labs-content < div.page_content
- Variants: link=news,img=false,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×1
- Our treatment: same|shape=null|badge=none
- Coverage: **partial** 1/1 without a label although Steam shows no summary
- Example (labs, appid 593110 "", 680x160): card {"position":"static","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K37 Plain text link on a package page (not a card)

- Master key: `a.`; exact signatures: `a.`
- Seen on: sub_354231
- Under headings: Half-Life: Alyx; section: #game_area_description
- Ancestors: div#game_area_description.game_area_description < div.game_description_column.leftcol < div.main_page_content.page_content < div.page_content_ctn
- Variants: img=false,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×1
- Our treatment: unclaimed|shape=null|badge=null
- Coverage: **text-link** 1/1 unclaimed
- Example (sub_354231, appid 546560 "", 100x20): card {"position":"static","display":"inline","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"hidden","overflowX":"hidden","gap":"normal"}

### K38 BBCode list on a package page (not a card)

- Master key: `ul.bb_ul`; exact signatures: `ul.bb_ul`
- Seen on: sub_354231
- Under headings: Requires; section: #game_area_description
- Ancestors: div#game_area_description.game_area_description < div.game_description_column.leftcol < div.main_page_content.page_content < div.page_content_ctn
- Variants: img=false,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×1
- Our treatment: unclaimed|shape=null|badge=null
- Coverage: **text-link** 1/1 unclaimed
- Example (sub_354231, appid 1070910 "", 580x20): card {"position":"static","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"hidden","overflowX":"hidden","gap":"normal"}
