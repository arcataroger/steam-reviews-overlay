# Steam game-card inventory (master set)

Generated 2026-10-18 from 102 pages, 36 kinds, 4455 cards. Regenerate with `npm run inventory` (see .claude/skills/steam-inventory).

| id | name | master key | pages | cards | sizes | features | our treatment | coverage |
|---|---|---|---|---|---|---|---|---|
| K01 | React grid capsule tile (Popular Titles / Top Demos / Popular Discounted rails) | `div.+1h|.ItemCount_N.center_row_trgt|app,art,carousel,art≥50%` | 68 | 2141 | 380x220 ×1283, 600x320 ×542 | price? carousel | card ×1130/row ×681 · sro-inline ×2141 | **covered** |
| K02 | React expanded capsule with info panel (Popular Titles, 920×340) | `div.+3h|.Panel|app,art` | 70 | 839 | 920x340 ×837, 920x360 ×2 | price? date? native? | card ×812/null ×27 · none ×754/sro-inline sro-beside-native ×58 | **covered** |
| K03 | Carousel slide: event/news tile (Recent & Upcoming Events) and small capsule variants | `div.carousel__slide.slide___3-Nqo+2h` | 75 | 672 | 300x240 ×579, 280x160 ×24 | news-link price? date? carousel | panel ×620/null ×28 · sro-corner ×588/sro-inline ×60 | **partial** — 24/672 without a label although Steam shows no summary |
| K04 | Sale capsule (home Discounts & Events small art tile) | `a.sale_capsule` | 3 | 131 | 240x160 ×75, 280x200 ×32 | price? carousel | card ×116/null ×15 · sro-corner ×116/null ×12 | **by-design** — 12/131 on purpose: package capsules share the Discounts & Events shelves with game capsules; a package has its own store page and its own score, so it gets no game label |
| K05 | Charts table row (Top Sellers / Most Played) | `tr._6-rISlJoUe0-` | 1 | 100 | 940x60 ×96, 940x80 ×4 | price? date? | row ×98/null ×2 · sro-corner ×86/sro-inline sro-beside-title ×7 | **partial** — 3/100 without a label although Steam shows no summary |
| K06 | React grid capsule tile, art under half the tile (Top Demos / Popular Titles rails) | `div.+1h|.ItemCount_N.center_row_trgt|app,art,carousel` | 7 | 99 | 380x220 ×61, 580x300 ×36 | carousel | null ×37/row ×31 · sro-inline ×99 | **covered** |
| K07 | News hub post row | `div.+1h|.Panel|news,art` | 1 | 78 | 1080x280 ×78 | news-link date? native? | row ×78 · sro-corner ×78 | **covered** |
| K08 | Category hero (rotating video carousel, 1200×540) | `div.+1h|#SaleSection_N|app,art,carousel,art≥50%` | 72 | 72 | 1200x540 ×72 | price? date native? carousel | row ×67/null ×3 · sro-corner ×70/sro-inline ×2 | **by-design** — 70/72 on purpose: the category hero is a rotating video carousel ("Next Game in 7 seconds"); the overlay claims the game's capsule, because Steam recycles the slide for the next game (verified on category/action, 2026-10-18) |
| K09 | Home hero broadcast capsule (Featured & Recommended) | `a.broadcast_capsule+1h` | 3 | 36 | 1200x480 ×30, 760x440 ×6 | price? date? native carousel | card ×30/row ×6 · none ×29/sro-inline sro-beside-native ×7 | **covered** |
| K10 | Classless React tile (Most Wanted Upcoming, Popular Game Demos, app-page content rows) | `div.` | 6 | 35 | 380x220 ×18, 560x300 ×6 | news-link price? date? | card ×24/null ×11 · sro-inline ×25/sro-corner ×6 | **by-design** — 4/35 on purpose: an app page's own game gets no label (verified: the 780x380 tile left unclaimed on each app page carries that page's own appid) |
| K11 | Tab row (explore/new Popular New Releases list) | `a.tab_item` | 2 | 32 | 800x60 ×31, 820x60 | price? date? platforms | row ×17/null ×15 · sro-corner ×32 | **covered** |
| K12 | Home tab row item (Trending Free etc.) | `a.tab_row_item` | 3 | 30 | 840x80 ×30 | price date | row ×30 · sro-corner ×30 | **covered** |
| K13 | React demo row with info panel (Popular Game Demos, 940×160) | `div.+1h|.Panel|app,art` | 2 | 24 | 940x160 ×24 | price? date native | row ×24 · none ×23/sro-inline sro-beside-native | **covered** |
| K14 | Specials small capsule (Under $10 / Under $5) | `a.special.special_img_ctn` | 1 | 24 | 200x100 ×24 | price | row ×22/null ×2 · sro-corner ×24 | **covered** |
| K15 | Community recommendation review card | `div#AppN.appeared.has_microtrailer.reviewed_app` | 1 | 21 | 1160x340 ×21 | price native | card ×21 · sro-corner ×21 | **covered** |
| K16 | Home deal tile (Today's Deal / Up to -N%, React panel, 374×482) | `div.Panel+2h` | 3 | 21 | 380x480 ×15, 380x220 ×6 | carousel | card ×11/row ×10 · sro-corner ×21 | **covered** |
| K17 | Store capsule (Released This Month, Popular wishlisted) | `a.store_capsule` | 2 | 18 | 240x140 ×18 | price? carousel | row ×10/null ×8 · sro-corner ×18 | **covered** |
| K18 | Category hero capsule, larger variant (1200×560) | `div.Panel+3h` | 4 | 13 | 380x220 ×12, 1200x560 | price? date? carousel | card ×13 · sro-corner ×12/sro-inline | **covered** |
| K19 | Panel holding a news link (app-page events widget, news hub) or a home deal panel | `div.Panel+1h` | 6 | 12 | 380x480 ×9, 1200x40 ×3 | news-link carousel | card ×7/null ×5 · sro-corner ×7/null ×5 | **by-design** — 12/12 on purpose: a home deal panel stacks a game tile on a sale-page tile: the game tile is claimed rather than the panel, and panels holding only sale tiles are not games (verified on the home page, 2026-10-18) |
| K20 | Tag browse game tile | `div.browse_tag_game` | 1 | 9 | 300x180 ×9 | price? | card ×9 · sro-corner ×9 | **covered** |
| K21 | Charts overview rank link (text only) | `a.S0OGjWAy4Co-` | 1 | 8 | 440x40 ×8 |  | row ×8 · sro-corner ×8 | **covered** |
| K22 | Labs experiment capsule (not a game) | `div.capsule` | 1 | 7 | 680x460 ×2, 680x400 ×2 | news-link date? | null ×7 · none ×6/null | **by-design** — 7/7 on purpose: a Labs experiment capsule, not a game |
| K23 | News hub post row with large art, and an app page's own Recent Events & Announcements tiles (those link to the page's own game, so they carry no label by design) | `div.+1h|.Panel|news,art,art≥50%` | 3 | 6 | 380x320 ×6 | news-link date | null ×6 · null ×6 | **by-design** — 6/6 on purpose: an app page's own Recent Events & Announcements tiles link to the game whose page you are already on, which is never labelled |
| K24 | Community recommendation review card (variant) | `div#AppN.appeared.has_microtrailer.reviewed_app+1h` | 1 | 4 | 1160x340 ×4 | price native | card ×4 · sro-corner ×4 | **covered** |
| K25 | App-page breadcrumbs (not a card) | `div.breadcrumbs` | 3 | 3 | 1200x40 ×3 |  | null ×3 · null ×3 | **text-link** — 3/3 unclaimed |
| K26 | App-page DLC row / cart form | `form.` | 3 | 3 | 780x20 ×2, 780x120 | price? | row ×3 · sro-inline ×3 | **covered** |
| K27 | Community recommendation review card (no microtrailer) | `div#AppN.appeared.reviewed_app+1h` | 1 | 3 | 1160x340 ×3 | price native | card ×3 · sro-corner ×3 | **covered** |
| K28 | Home takeunder banner (hidden fallback anchor, no art) | `div.home_page_content.takeunder` | 3 | 3 | 1200x200 ×3 |  | null ×3 · none ×3 | **by-design** — 3/3 on purpose: the hidden fallback anchor behind the home takeunder banner, with no art and no game |
| K29 | Charts overview top-3 tile (art + stat) | `div.xjiY68vUbWQ-` | 1 | 2 | 440x320 ×2 |  | card ×2 · sro-corner ×2 | **covered** |
| K30 | New Releases page capsule (600×340) | `a.+1h|.page_content|app,art,art≥50%` | 1 | 2 | 600x340 ×2 | price | card ×2 · sro-corner ×2 | **covered** |
| K31 | Upcoming Releases bucket capsule (600×340) | `a.+1h|.bucket_contents|app,art,art≥50%` | 1 | 2 | 600x320 ×2 |  | null ×2 · sro-corner ×2 | **covered** |
| K32 | Category video hero side panel before its capsule art loads | `div.+1h|.Panel|app,carousel` | 1 | 1 | 380x200 | date carousel | null · null | **gap** — 1/1 unclaimed |
| K33 | Community recommendation review card (no microtrailer, no hashed class) | `div#AppN.appeared.reviewed_app` | 1 | 1 | 1160x340 | price native | card · sro-corner | **covered** |
| K34 | Great on Deck 'Ignored' banner panel | `div.Panel+4h` | 1 | 1 | 1200x240 |  | null · none | **by-design** — 1/1 on purpose: the Great on Deck 'Ignored' banner panel, not a game |
| K35 | Labs experiment banner fragment (not a game) | `div.capsule-banner` | 1 | 1 | 680x300 |  | null · null | **by-design** — 1/1 on purpose: a Labs experiment banner, not a game |
| K36 | Labs experiment text blurb (not a game) | `div.exp_text_ctn` | 1 | 1 | 680x160 | news-link date | null · none | **by-design** — 1/1 on purpose: a Labs experiment text blurb, not a game |

## Kinds in detail

### K01 React grid capsule tile (Popular Titles / Top Demos / Popular Discounted rails)

- Master key: `div.+1h|.ItemCount_N.center_row_trgt|app,art,carousel,art≥50%`; exact signatures: `div._3r4Ny9tQdQZc50XDM5B2q2`
- Seen on: category_casual ×60, category_hidden_object ×45, category_metroidvania ×45, category_multiplayer ×45, category_multiplayer_lan ×45, category_multiplayer_local_party ×45 (+62)
- Under headings: Popular Titles ×976 / Top Demos ×775 / Popular Discounted ×330 / Controller-Friendly ×15; section: .ItemCount_3.center_row_trgt ×1283 / .ItemCount_2.center_row_trgt ×858
- Ancestors: div.ItemCount_3.SaleSectionContainer.W9_WAYXgEe-t-7aqqC4Jp._3gb3JeV_1IMaIeODzBSrP3.center_row_trgt < div.HlkukqE4fB5si76sBJzKX < div.Panel < div.carousel__inner-slide.slideInner___2mfX9 ×1283
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×1019; img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×1122
- Our treatment: same|shape=card|badge=sro-badge sro-inline ×1130 ; same|shape=row|badge=sro-badge sro-inline ×681 ; same|shape=null|badge=sro-badge sro-inline ×330
- Coverage: **covered** 
- Example (category_action, appid 570 "", 600x320): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"grid","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"16px"}

### K02 React expanded capsule with info panel (Popular Titles, 920×340)

- Master key: `div.+3h|.Panel|app,art`; exact signatures: `div.LibraryAssetExpandedDisplay._39Jz5Qi6nhOd7XvaNnbSoR.t75Je5tr-0U-BmJ9zl5ia`, `div.LibraryAssetExpandedDisplay.PZY_7wH_NY7OgzH9MBiB8._2hhNOdcC6yLwL_rugP3YLf`
- Seen on: category_action ×12, category_action_fps ×12, category_action_run_jump ×12, category_action_tps ×12, category_adventure ×12, category_adventure_rpg ×12 (+64)
- Under headings: Popular Titles ×767 / Co-op ×12 / Shared / Split Screen ×12 / Ignored ×12; section: .Panel ×839
- Ancestors: div._2Xmxos5yKwoYnXYguVbp1w < div.FceFPjrKVMUMEQizv8jcP < div. < div._18byEIHFiivSklOwKqIx2b ×815
- Variants: img=true,price=true,date=true,nativeSummary=true,title=true,platforms=false,carousel=false ×626; img=true,price=false,date=true,nativeSummary=true,title=true,platforms=false,carousel=false ×183; img=true,price=true,date=true,nativeSummary=false,title=true,platforms=false,carousel=false ×21; img=true,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=false ×1; img=true,price=true,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×6; img=true,price=true,date=true,nativeSummary=true,title=false,platforms=false,carousel=false ×2
- Our treatment: same|shape=card|badge=none ×754 ; same|shape=card|badge=sro-badge sro-inline sro-beside-native ×58 ; same|shape=null|badge=sro-badge sro-inline ×27
- Coverage: **covered** 
- Example (category_action, appid 4435490 "Tags", 920x340): card {"position":"relative","display":"flex","overflow":"visible","borderRadius":"0px 5px 0px 0px","backgroundImage":"linear-gradient(rgba(0, 0, 0, 0.43) 5%, rgb(0, 0, 0) 95%)"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"_1so1AGD_m_uIBFDEc1ImOu StoreSalePriceWidgetContainer _1QuRa-ebvBejdSjmUkqX5v","position":"relative","display":"flex","textAlign":"start"}; native {"cls":"_6ctF1zf2MKZRofZdWQXqG ReviewScore","text":"Very Positive(1,035 English Reviews)"}

### K03 Carousel slide: event/news tile (Recent & Upcoming Events) and small capsule variants

- Master key: `div.carousel__slide.slide___3-Nqo+2h`; exact signatures: `div._3Cc2bMRML2lEkSyi2IAZ9G.carousel__slide.slideHorizontal___1NzNV.slide___3-Nqo`
- Seen on: greatondeck ×25, vr ×18, news ×10, app_1675200_Steam_Deck ×9, category_action ×9, category_action_fps ×9 (+69)
- Under headings: Recent & Upcoming Events ×579 / System Requirements ×24 / Steam Deck Top Played Games ×18 / Coming Soon ×14; section: .carousel__slider.vt-scrollable ×672
- Ancestors: div._2VUpHDtxN8lR1LDahY_cI2._3J8-bW87K3pb8EpRNYq0JG.carousel__slider-tray.carousel__slider-tray--horizontal.sliderTray___-vHFQ < div.carousel__slider-tray-wrap--horizontal.carousel__slider-tray-wrapper < div.carousel__slider.carousel__slider--horizontal.horizontalSlider___281Ls.touchDisabled___2qs4y.vt-scrollable < div.SliderBody._2M3SnYGvMvplWUC8yGhowo ×672
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×45; img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×32; link=news,img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=true ×551; link=news,img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×38; img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=true ×2; img=true,price=true,date=true,nativeSummary=false,title=false,platforms=false,carousel=true ×4
- Our treatment: same|shape=panel|badge=sro-badge sro-corner ×578 ; same|shape=panel|badge=none ×24 ; same|shape=null|badge=sro-badge sro-inline ×18 ; same|shape=panel|badge=sro-badge sro-inline ×18
- Coverage: **partial** 24/672 without a label although Steam shows no summary
- Example (app_1675200_Steam_Deck, appid 1401590 "", 260x300): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K04 Sale capsule (home Discounts & Events small art tile)

- Master key: `a.sale_capsule`; exact signatures: `a.sale_capsule`
- Seen on: explore_next_3 ×45, home ×45, explore_next_0 ×41
- Under headings: Under $10 ×75 / September 2026 ×32 / Featured tag ×24; section: .carousel_items ×107 / #home_tags_section ×24
- Ancestors: div. < div.carousel_items.store_capsule_container < div.carousel_container.paging_capsules < div#sale_underN_area.home_pagecontent_ctn.sale_capsule_carousel ×75
- Variants: img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×104; img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×22; img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×2; img=true,price=true,date=false,nativeSummary=false,title=true,platforms=false,carousel=false ×2; img=true,price=true,date=false,nativeSummary=false,title=true,platforms=false,carousel=true ×1
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×113 ; unclaimed|shape=null|badge=null ×12 ; same|shape=null|badge=sro-badge sro-corner ×3 ; same|shape=card|badge=sro-badge sro-inline sro-beside-title ×3
- Coverage: **by-design** 12/131 on purpose: package capsules share the Discounts & Events shelves with game capsules; a package has its own store page and its own score, so it gets no game label
- Example (explore_next_0, appid 4358690 "", 280x200): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"12px"}; price {"cls":"discount_final_price","position":"static","display":"block","textAlign":"right"}

### K05 Charts table row (Top Sellers / Most Played)

- Master key: `tr._6-rISlJoUe0-`; exact signatures: `tr._6-rISlJoUe0-`
- Seen on: charts_topselling ×100
- Under headings: Top Sellers ×100; section: .cCE5WXLdwQ4- ×100
- Ancestors: tbody. < table.cCE5WXLdwQ4- < div.Panel.y8ScxjY4mi8- < div.Panel.Y4tvTqCXrtc- ×100
- Variants: img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×72; img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×19; img=true,price=false,date=false,nativeSummary=false,title=true,platforms=false,carousel=false ×4; img=true,price=true,date=false,nativeSummary=false,title=true,platforms=false,carousel=false ×3; img=true,price=true,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×2
- Our treatment: same|shape=row|badge=sro-badge sro-corner ×84 ; same|shape=row|badge=sro-badge sro-inline sro-beside-title ×7 ; same|shape=row|badge=sro-badge sro-inline ×4 ; same|shape=row|badge=none ×3
- Coverage: **partial** 3/100 without a label although Steam shows no summary
- Example (charts_topselling, appid 4435490 "", 940x60): card {"position":"relative","display":"table-row","overflow":"visible","borderRadius":"0px","backgroundImage":"linear-gradient(90deg, rgba(86, 92, 103, 0.3), rgba(90, 98, 108, 0.3))"}; parent {"display":"table-row-group","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"K2UfkCIuEhY- StoreSalePriceWidgetContainer jaJf732NByw- IChJxoOm7tM-","position":"relative","display":"flex","textAlign":"right"}

### K06 React grid capsule tile, art under half the tile (Top Demos / Popular Titles rails)

- Master key: `div.+1h|.ItemCount_N.center_row_trgt|app,art,carousel`; exact signatures: `div._3r4Ny9tQdQZc50XDM5B2q2`
- Seen on: category_racing_sim ×17, category_puzzle_matching ×16, category_racing ×16, category_rogue_like_rogue_lite ×16, category_sim_hobby_sim ×16, category_strategy_cities_settlements ×16 (+1)
- Under headings: Top Demos ×90 / Popular Titles ×9; section: .ItemCount_3.center_row_trgt ×61 / .ItemCount_2.center_row_trgt ×38
- Ancestors: div.ItemCount_3.SaleSectionContainer.W9_WAYXgEe-t-7aqqC4Jp._3gb3JeV_1IMaIeODzBSrP3.center_row_trgt < div.HlkukqE4fB5si76sBJzKX < div.Panel < div.carousel__inner-slide.slideInner___2mfX9 ×61
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×99
- Our treatment: same|shape=null|badge=sro-badge sro-inline ×37 ; same|shape=row|badge=sro-badge sro-inline ×31 ; same|shape=card|badge=sro-badge sro-inline ×31
- Coverage: **covered** 
- Example (category_puzzle_matching, appid 4282500 "", 380x220): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"grid","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"16px"}

### K07 News hub post row

- Master key: `div.+1h|.Panel|news,art`; exact signatures: `div._398u23KF15gxmeH741ZSyL`
- Seen on: news ×78
- Under headings: Thursday ×36 / Friday ×26 / Wednesday ×11 / Yesterday ×4; section: .Panel ×78
- Ancestors: div._1U2BW9tpHKOVi_TG0XvjT._3FpvGiwJqnukNOcrsKd_sN < div.Panel._1_BP6N2tGh4484bcmYnZeX < div.r3Dia2Yw2X-goqFn-_UPT < div._3yqpPRFLwr6ETVDgLGT37s ×40
- Variants: link=news,img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×68; link=news,img=true,price=false,date=false,nativeSummary=true,title=false,platforms=false,carousel=false ×8; link=news,img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×2
- Our treatment: same|shape=row|badge=sro-badge sro-corner ×78
- Coverage: **covered** 
- Example (news, appid 578080 "", 1080x280): card {"position":"relative","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"normal"}

### K08 Category hero (rotating video carousel, 1200×540)

- Master key: `div.+1h|#SaleSection_N|app,art,carousel,art≥50%`; exact signatures: `div._3olpRSXr66ohyQFxmzqokI`
- Seen on: category_action, category_action_fps, category_action_run_jump, category_action_tps, category_adventure, category_adventure_rpg (+66)
- Under headings: Action / First-Person Shooter / Platformers & Runners / Third-Person Shooter; section: #SaleSection_N ×72
- Ancestors: div#SaleSection_N.Panel.SaleSectionCtn.contenthubmaincarousel.expanded.i2PTzRNXOK1OXvXb9-wzd < div.SaleSectionTabListContainer._2VZtqrDRVSIicZZHPUY9SY < div.Panel < div.Panel.SaleOuterContainer._150kddWk8JgylTvh_eC20b ×72
- Variants: img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=true ×12; img=true,price=true,date=true,nativeSummary=false,title=false,platforms=false,carousel=true ×57; img=true,price=false,date=true,nativeSummary=true,title=false,platforms=false,carousel=true ×1; img=true,price=true,date=true,nativeSummary=true,title=false,platforms=false,carousel=true ×2
- Our treatment: other:a.Ay0ys40M1NtzbqyKeNgwX|shape=row|badge=sro-badge sro-corner ×67 ; other:a.Ay0ys40M1NtzbqyKeNgwX|shape=null|badge=sro-badge sro-corner ×3 ; same|shape=card|badge=sro-badge sro-inline ×2
- Coverage: **by-design** 70/72 on purpose: the category hero is a rotating video carousel ("Next Game in 7 seconds"); the overlay claims the game's capsule, because Steam recycles the slide for the next game (verified on category/action, 2026-10-18)
- Example (category_action, appid 2357570 "", 1200x540): card {"position":"static","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"hidden auto","overflowX":"hidden","gap":"normal"}

### K09 Home hero broadcast capsule (Featured & Recommended)

- Master key: `a.broadcast_capsule+1h`; exact signatures: `a.broadcast_capsule.store_main_capsule`
- Seen on: explore_next_0 ×12, explore_next_3 ×12, home ×12
- Under headings: Featured & Recommended ×36; section: .carousel_items ×36
- Ancestors: div.carousel_items.store_capsule_container < div.carousel_container.maincap < div.home_cluster_ctn.home_pagecontent_ctn.v2 < div#home_maincap_vN.carousel_wide_mode ×36
- Variants: img=true,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=true ×21; img=true,price=false,date=false,nativeSummary=true,title=true,platforms=false,carousel=true ×11; img=false,price=true,date=true,nativeSummary=true,title=true,platforms=false,carousel=true ×2; img=false,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=true ×1; img=true,price=true,date=true,nativeSummary=true,title=true,platforms=false,carousel=true ×1
- Our treatment: same|shape=card|badge=none ×25 ; same|shape=card|badge=sro-badge sro-inline sro-beside-native ×5 ; same|shape=row|badge=none ×4 ; same|shape=row|badge=sro-badge sro-inline sro-beside-native ×2
- Coverage: **covered** 
- Example (explore_next_0, appid 2807960 "Battlefield™ 6", 1200x480): card {"position":"relative","display":"grid","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"discount_pct","position":"static","display":"flex","textAlign":"right"}; native {"cls":"review_summary","text":"Mixed (156,919 Reviews)"}

### K10 Classless React tile (Most Wanted Upcoming, Popular Game Demos, app-page content rows)

- Master key: `div.`; exact signatures: `div.`
- Seen on: greatondeck ×17, dlcforyou ×8, demos ×6, app_2767030_Marvel_Rivals ×2, app_1867240_WARDOGS, app_730_CounterStrike_2
- Under headings: Popular Titles ×17 / Most Wanted Upcoming ×8 / Popular Game Demos ×6 / Content For This GameBrowse all (1) ×4; section: .ItemCount_3.center_row_trgt ×21 / .ItemCount_2.center_row_trgt ×6
- Ancestors: div.ItemCount_3.SaleSectionContainer.W9_WAYXgEe-t-7aqqC4Jp._3gb3JeV_1IMaIeODzBSrP3.center_row_trgt < div.Panel < div.Panel.SaleSectionForCustomCSS._1cOoCFwafBlSkwllIMf3XM._39HWXhhjsbML7K9sme9ItV < div#SaleSection_N.Panel.SaleSectionCtn.expanded.i2PTzRNXOK1OXvXb9-wzd.items ×15
- Variants: link=news,img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×3; img=false,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×1; img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×8; img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×6; img=true,price=true,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×2; img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×15
- Our treatment: same|shape=card|badge=sro-badge sro-inline ×18 ; same|shape=null|badge=sro-badge sro-inline ×7 ; same|shape=card|badge=sro-badge sro-corner ×6 ; unclaimed|shape=null|badge=null ×3
- Coverage: **by-design** 4/35 on purpose: an app page's own game gets no label (verified: the 780x380 tile left unclaimed on each app page carries that page's own appid)
- Example (app_1867240_WARDOGS, appid 1867240 "", 780x380): card {"position":"static","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K11 Tab row (explore/new Popular New Releases list)

- Master key: `a.tab_item`; exact signatures: `a.tab_item`
- Seen on: explore_new ×16, explore_upcoming ×16
- Under headings: Popular New Releases ×16 / Popular wishlisted games ×16; section: .tab_content_items ×16 / #tab_popular_comingsoon_content ×16
- Ancestors: div.tab_content_items < div#tab_newreleases_content.tab_content < div.home_tabs_content < div.home_leftcol.home_tab_col ×16
- Variants: img=true,price=true,date=false,nativeSummary=false,title=true,platforms=true,carousel=false ×15; img=true,price=false,date=false,nativeSummary=false,title=true,platforms=true,carousel=false ×1; img=true,price=false,date=true,nativeSummary=false,title=true,platforms=true,carousel=false ×10; img=true,price=true,date=true,nativeSummary=false,title=true,platforms=true,carousel=false ×6
- Our treatment: same|shape=row|badge=sro-badge sro-corner ×17 ; same|shape=null|badge=sro-badge sro-corner ×15
- Coverage: **covered** 
- Example (explore_new, appid 2295060 "Beyond These Stars", 800x60): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"discount_pct","position":"static","display":"flex","textAlign":"right"}

### K12 Home tab row item (Trending Free etc.)

- Master key: `a.tab_row_item`; exact signatures: `a.tab_row_item`
- Seen on: explore_next_0 ×10, explore_next_3 ×10, home ×10
- Under headings: Trending Free ×30; section: .tab_content_items ×30
- Ancestors: div.tab_content_items < div#tab_newreleases_content.home_tab_content < div#home_tabs_row.home_tabs_sections.row_list_view < div.home_tabs_columns ×30
- Variants: img=true,price=true,date=true,nativeSummary=false,title=true,platforms=false,carousel=false ×30
- Our treatment: same|shape=row|badge=sro-badge sro-corner ×30
- Coverage: **covered** 
- Example (explore_next_0, appid 2295060 "Beyond These Stars", 840x80): card {"position":"relative","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"10px"}; price {"cls":"discount_pct","position":"static","display":"flex","textAlign":"start"}

### K13 React demo row with info panel (Popular Game Demos, 940×160)

- Master key: `div.+1h|.Panel|app,art`; exact signatures: `div._3_-EEQpFNke34pzfmip5yh`
- Seen on: demos ×12, greatondeck ×12
- Under headings: Popular Game Demos ×12 / Popular Titles ×12; section: .Panel ×24
- Ancestors: div._2Xmxos5yKwoYnXYguVbp1w < div.FceFPjrKVMUMEQizv8jcP < div. < div._18byEIHFiivSklOwKqIx2b ×24
- Variants: img=true,price=false,date=true,nativeSummary=true,title=true,platforms=false,carousel=false ×12; img=true,price=true,date=true,nativeSummary=true,title=true,platforms=false,carousel=false ×12
- Our treatment: same|shape=row|badge=none ×23 ; same|shape=row|badge=sro-badge sro-inline sro-beside-native
- Coverage: **covered** 
- Example (demos, appid 5076290 "No Body No Problem! Demo", 940x160): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}; native {"cls":"_6ctF1zf2MKZRofZdWQXqG ReviewScore","text":"Mixed(25 User Reviews)"}

### K14 Specials small capsule (Under $10 / Under $5)

- Master key: `a.special.special_img_ctn`; exact signatures: `a.special.special_img_ctn`
- Seen on: explore_new ×24
- Under headings: Under $10 ×12 / Under $5 ×12; section: .home_specials_ctn.sidebar_wide.underten ×12 / .home_specials_ctn.underfive.underten ×12
- Ancestors: div.home_specials_grid < div.home_specials_ctn.sidebar_wide.underten < div.home_rightcol < div.page_content ×12
- Variants: img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×24
- Our treatment: same|shape=row|badge=sro-badge sro-corner ×22 ; same|shape=null|badge=sro-badge sro-corner ×2
- Coverage: **covered** 
- Example (explore_new, appid 4954910 "", 200x100): card {"position":"relative","display":"flex","overflow":"hidden","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"4px"}; price {"cls":"discount_pct","position":"static","display":"block","textAlign":"start"}

### K15 Community recommendation review card

- Master key: `div#AppN.appeared.has_microtrailer.reviewed_app`; exact signatures: `div#AppN.appeared.has_microtrailer.reviewed_app`
- Seen on: communityrecommendations ×21
- Under headings: There are no reviews that match the filters set above ×21; section: #reviewed_apps ×21
- Ancestors: div#reviewed_apps.trending_reviews_content < div.page_content < div.page_content_ctn < div#responsive_page_template_content.responsive_page_template_content ×21
- Variants: img=true,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=false ×21
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×21
- Coverage: **covered** 
- Example (communityrecommendations, appid 2483190 "ishhy ☽", 1160x340): card {"position":"relative","display":"flex","overflow":"hidden","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"discount_final_price","position":"static","display":"block","textAlign":"start"}; native {"cls":"reviews","text":"I am quite new to racing games as this i"}

### K16 Home deal tile (Today's Deal / Up to -N%, React panel, 374×482)

- Master key: `div.Panel+2h`; exact signatures: `div.G3-gajXyBqVPe_dLxcra1.Panel._14LO-skSyf__YkJybhT_cx`, `div.Panel._1gsW0WuP7ZclL1_ScZlsvo._2Krn_hSFPsQV65KD-NO15-`
- Seen on: explore_next_0 ×7, explore_next_3 ×7, home ×7
- Under headings: Up to -95% ×12 / Discounts & Events ×5 / Up to -80% ×4; section: .Panel ×21
- Ancestors: div.Panel._3gVAXLzTzt5xCjFA1_c9rn < div.carousel__inner-slide.slideInner___2mfX9 < div._3Cc2bMRML2lEkSyi2IAZ9G.carousel__slide.slideHorizontal___1NzNV.slide___3-Nqo < div._2VUpHDtxN8lR1LDahY_cI2._3J8-bW87K3pb8EpRNYq0JG.carousel__slider-tray.carousel__slider-tray--horizontal.sliderTray___-vHFQ ×15
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×21
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×11 ; same|shape=row|badge=sro-badge sro-corner ×10
- Coverage: **covered** 
- Example (explore_next_0, appid 1857950 "", 380x480): card {"position":"relative","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"grid","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"18px"}

### K17 Store capsule (Released This Month, Popular wishlisted)

- Master key: `a.store_capsule`; exact signatures: `a.store_capsule`
- Seen on: explore_new ×10, explore_upcoming ×8
- Under headings: Released This Month ×10 / Popular wishlisted games ×8; section: .bucket_contents.peeking_carousel ×10 / .bucket_contents ×8
- Ancestors: div.bucket_contents.peeking_carousel.store_capsule_container_scrolling.store_horizontal_autoslider < div.store_horizontal_autoslider_ctn < div.bucket < div.newonsteam_buckets.page_content ×10
- Variants: img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×13; img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×5
- Our treatment: same|shape=row|badge=sro-badge sro-corner ×10 ; same|shape=null|badge=sro-badge sro-corner ×8
- Coverage: **covered** 
- Example (explore_new, appid 4078430 "", 240x140): card {"position":"relative","display":"inline-block","overflow":"visible","borderRadius":"0px","backgroundImage":"radial-gradient(62.67% 62.67% at 62.67% 100%, rgb(61, 72, 86) 0%, rgb(40, 54, 69) 100%)"}; parent {"display":"block","flexDirection":"row","overflow":"scroll hidden","overflowX":"scroll","gap":"normal"}; price {"cls":"discount_final_price","position":"static","display":"block","textAlign":"right"}

### K18 Category hero capsule, larger variant (1200×560)

- Master key: `div.Panel+3h`; exact signatures: `div.Panel._1cOoCFwafBlSkwllIMf3XM._30Yfh62g3YeDgzOL-z9BnJ._39HWXhhjsbML7K9sme9ItV`, `div.Panel._1gsW0WuP7ZclL1_ScZlsvo._2Krn_hSFPsQV65KD-NO15-._2j75F6fqx57q6RLx94e7KU`
- Seen on: explore_next_0 ×4, explore_next_3 ×4, home ×4, category_rpg_jrpg
- Under headings: Up to -95% ×10 / Up to -80% ×2 / Popular Titles; section: .Panel ×12 / #SaleSection_N
- Ancestors: div.Panel._14LO-skSyf__YkJybhT_cx < div.Panel._3gVAXLzTzt5xCjFA1_c9rn < div.carousel__inner-slide.slideInner___2mfX9 < div._3Cc2bMRML2lEkSyi2IAZ9G.carousel__slide.slideHorizontal___1NzNV.slide___3-Nqo ×12
- Variants: img=true,price=true,date=true,nativeSummary=false,title=false,platforms=false,carousel=true ×1; img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×12
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×12 ; same|shape=card|badge=sro-badge sro-inline
- Coverage: **covered** 
- Example (category_rpg_jrpg, appid 3470630 "", 1200x560): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"_1so1AGD_m_uIBFDEc1ImOu StoreSalePriceWidgetContainer","position":"relative","display":"flex","textAlign":"start"}

### K19 Panel holding a news link (app-page events widget, news hub) or a home deal panel

- Master key: `div.Panel+1h`; exact signatures: `div.Panel._8bfDpjt5qevt4WIKJfbhY`, `div.Panel._14LO-skSyf__YkJybhT_cx`
- Seen on: explore_next_0 ×3, explore_next_3 ×3, home ×3, app_1867240_WARDOGS, app_2767030_Marvel_Rivals, app_730_CounterStrike_2
- Under headings: Up to -95% ×5 / Mostly Positive ×2 / Discounts & Events ×2 / Up to -80% ×2; section: .Panel ×9 / #app_reviews_hash ×3
- Ancestors: div.Panel._3gVAXLzTzt5xCjFA1_c9rn < div.carousel__inner-slide.slideInner___2mfX9 < div._3Cc2bMRML2lEkSyi2IAZ9G.carousel__slide.slideHorizontal___1NzNV.slide___3-Nqo < div._2VUpHDtxN8lR1LDahY_cI2._3J8-bW87K3pb8EpRNYq0JG.carousel__slider-tray.carousel__slider-tray--horizontal.sliderTray___-vHFQ ×9
- Variants: link=news,img=false,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×3; img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=true ×9
- Our treatment: other:div.Panel._1gsW0WuP7ZclL1_ScZlsvo._2Krn_hSFPsQV65KD-NO15-|shape=card|badge=sro-badge sro-corner ×6 ; unclaimed|shape=null|badge=null ×5 ; other:div.Panel._1gsW0WuP7ZclL1_ScZlsvo._2Krn_hSFPsQV65KD-NO15-._2j75F6fqx57q6RLx94e7KU|shape=card|badge=sro-badge sro-corner
- Coverage: **by-design** 12/12 on purpose: a home deal panel stacks a game tile on a sale-page tile: the game tile is claimed rather than the panel, and panels holding only sale tiles are not games (verified on the home page, 2026-10-18)
- Example (app_1867240_WARDOGS, appid 593110 "", 1200x40): card {"position":"static","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K20 Tag browse game tile

- Master key: `div.browse_tag_game`; exact signatures: `div.browse_tag_game`
- Seen on: tag_browse ×9
- Under headings: Indie Browse all 119,532 ×9; section: .game_grid ×9
- Ancestors: div.game_grid < div.browse_tag_games < div.tag_browse_games_results < div#tag_browse_games_ctn.tag_browse_games_ctn ×9
- Variants: img=true,price=true,date=false,nativeSummary=false,title=true,platforms=false,carousel=false ×8; img=true,price=false,date=false,nativeSummary=false,title=true,platforms=false,carousel=false ×1
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×9
- Coverage: **covered** 
- Example (tag_browse, appid 2306620 "Risk of Rain 2: Seekers of the Storm", 300x180): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"12px"}; price {"cls":"browse_tag_game_price","position":"static","display":"block","textAlign":"start"}

### K21 Charts overview rank link (text only)

- Master key: `a.S0OGjWAy4Co-`; exact signatures: `a.S0OGjWAy4Co-`
- Seen on: charts ×8
- Under headings: CHARTS OVERVIEW ×8; section: .NBN-f1mBrso-.Panel ×8
- Ancestors: div.NBN-f1mBrso-.Panel < div.Panel < div.fm1dMrfMpDc- < div.Panel.uX4qL3T--O8-.wnzEl6A2mnI- ×8
- Variants: img=false,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×8
- Our treatment: same|shape=row|badge=sro-badge sro-corner ×8
- Coverage: **covered** 
- Example (charts, appid 3393110 "", 440x40): card {"position":"relative","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K22 Labs experiment capsule (not a game)

- Master key: `div.capsule`; exact signatures: `div.capsule`
- Seen on: labs ×7
- Under headings: Active Experiments / 016 Personal Calendar / Past Experiments / 009 News Hub; section: .left-column ×7
- Ancestors: div.left-column < div.labs-content < div.page_content < div.labs.page_content_ctn ×7
- Variants: link=news,img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×3; img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×3; img=true,price=false,date=true,nativeSummary=false,title=true,platforms=false,carousel=false ×1
- Our treatment: same|shape=null|badge=none ×6 ; unclaimed|shape=null|badge=null
- Coverage: **by-design** 7/7 on purpose: a Labs experiment capsule, not a game
- Example (labs, appid 593110 "", 680x460): card {"position":"static","display":"block","overflow":"visible","borderRadius":"4px","backgroundImage":"radial-gradient(at 0% 0%, rgb(81, 95, 133), rgb(24, 38, 74))"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K23 News hub post row with large art, and an app page's own Recent Events & Announcements tiles (those link to the page's own game, so they carry no label by design)

- Master key: `div.+1h|.Panel|news,art,art≥50%`; exact signatures: `div._2JC5DEuXUeE50kjpb7Eeau`
- Seen on: app_1867240_WARDOGS ×2, app_2767030_Marvel_Rivals ×2, app_730_CounterStrike_2 ×2
- Under headings: Recent Events & AnnouncementsView All ×6; section: .Panel ×6
- Ancestors: div._1snIw0RvJduvDtqpmwtKJ9 < div._2Jd3MGaOu0C9Ydswf8Q4Tn < div.Panel.early_access_announcements < div. ×6
- Variants: link=news,img=true,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×6
- Our treatment: unclaimed|shape=null|badge=null ×6
- Coverage: **by-design** 6/6 on purpose: an app page's own Recent Events & Announcements tiles link to the game whose page you are already on, which is never labelled
- Example (app_1867240_WARDOGS, appid 1867240 "", 380x320): card {"position":"relative","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"row","overflow":"auto","overflowX":"auto","gap":"8px"}

### K24 Community recommendation review card (variant)

- Master key: `div#AppN.appeared.has_microtrailer.reviewed_app+1h`; exact signatures: `div#AppN.appeared.has_microtrailer.has_multiple_reviews.reviewed_app`
- Seen on: communityrecommendations ×4
- Under headings: There are no reviews that match the filters set above ×4; section: #reviewed_apps ×4
- Ancestors: div#reviewed_apps.trending_reviews_content < div.page_content < div.page_content_ctn < div#responsive_page_template_content.responsive_page_template_content ×4
- Variants: img=true,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=false ×4
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×4
- Coverage: **covered** 
- Example (communityrecommendations, appid 4231820 "jorozco396", 1160x340): card {"position":"relative","display":"flex","overflow":"hidden","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"discount_final_price","position":"static","display":"block","textAlign":"start"}; native {"cls":"reviews","text":"This game is more \"Hollow Knight with Ca"}

### K25 App-page breadcrumbs (not a card)

- Master key: `div.breadcrumbs`; exact signatures: `div.breadcrumbs`
- Seen on: app_1867240_WARDOGS, app_2767030_Marvel_Rivals, app_730_CounterStrike_2
- Under headings: -; section: .game_title_area.page_content.page_title_area ×3
- Ancestors: div.game_title_area.page_content.page_title_area < div.page_top_area < div.page_content_ctn < div#tabletGrid.tablet_grid ×3
- Variants: img=false,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×3
- Our treatment: unclaimed|shape=null|badge=null ×3
- Coverage: **text-link** 3/3 unclaimed
- Example (app_1867240_WARDOGS, appid 1867240 "", 1200x40): card {"position":"static","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K26 App-page DLC row / cart form

- Master key: `form.`; exact signatures: `form.`
- Seen on: app_1867240_WARDOGS, app_2767030_Marvel_Rivals, app_730_CounterStrike_2
- Under headings: Content For This GameBrowse all (1) ×3; section: #gameAreaDLCSection ×3
- Ancestors: div.game_area_dlc_list < div#gameAreaDLCSection.game_area_dlc_section < div#game_area_purchase.game_area_purchase < div.game_description_column.leftcol ×3
- Variants: img=true,price=true,date=false,nativeSummary=false,title=true,platforms=false,carousel=false ×1; img=false,price=false,date=false,nativeSummary=false,title=true,platforms=false,carousel=false ×2
- Our treatment: same|shape=row|badge=sro-badge sro-inline ×3
- Coverage: **covered** 
- Example (app_1867240_WARDOGS, appid 4809960 "Recommended WARDOGS - Supporter Pack", 780x120): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"game_area_dlc_price","position":"static","display":"block","textAlign":"right"}

### K27 Community recommendation review card (no microtrailer)

- Master key: `div#AppN.appeared.reviewed_app+1h`; exact signatures: `div#AppN.appeared.has_multiple_reviews.reviewed_app`
- Seen on: communityrecommendations ×3
- Under headings: There are no reviews that match the filters set above ×3; section: #reviewed_apps ×3
- Ancestors: div#reviewed_apps.trending_reviews_content < div.page_content < div.page_content_ctn < div#responsive_page_template_content.responsive_page_template_content ×3
- Variants: img=true,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=false ×3
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×3
- Coverage: **covered** 
- Example (communityrecommendations, appid 3470960 "Hotarun", 1160x340): card {"position":"relative","display":"flex","overflow":"hidden","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"discount_final_price","position":"static","display":"block","textAlign":"start"}; native {"cls":"reviews","text":"- The return of the skits - The ability "}

### K28 Home takeunder banner (hidden fallback anchor, no art)

- Master key: `div.home_page_content.takeunder`; exact signatures: `div.home_page_content.takeunder`
- Seen on: explore_next_0, explore_next_3, home
- Under headings: Featured & Recommended ×3; section: #home_takeunder_ctn ×3
- Ancestors: div#home_takeunder_ctn.home_pagecontent_ctn < div.main_content_ctn < div.home_page_body_ctn < div#responsive_page_template_content.responsive_page_template_content ×3
- Variants: img=false,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×3
- Our treatment: same|shape=null|badge=none ×3
- Coverage: **by-design** 3/3 on purpose: the hidden fallback anchor behind the home takeunder banner, with no art and no game
- Example (explore_next_0, appid 4197840 "", 1200x200): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K29 Charts overview top-3 tile (art + stat)

- Master key: `div.xjiY68vUbWQ-`; exact signatures: `div.xjiY68vUbWQ-`
- Seen on: charts ×2
- Under headings: CHARTS OVERVIEW ×2; section: .NBN-f1mBrso-.Panel ×2
- Ancestors: div.NBN-f1mBrso-.Panel < div.Panel < div.fm1dMrfMpDc- < div.Panel.uX4qL3T--O8-.wnzEl6A2mnI- ×2
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×2
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×2
- Coverage: **covered** 
- Example (charts, appid 4435490 "", 440x320): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K30 New Releases page capsule (600×340)

- Master key: `a.+1h|.page_content|app,art,art≥50%`; exact signatures: `a.newonsteam_headercap`
- Seen on: explore_new ×2
- Under headings: New Releases ×2; section: .page_content ×2
- Ancestors: div.newonsteam_capsules.newonsteam_headercaps < div.page_content < div.page_ctn.top_capsules < div.game.game_page_background ×2
- Variants: img=true,price=true,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×2
- Our treatment: same|shape=card|badge=sro-badge sro-corner ×2
- Coverage: **covered** 
- Example (explore_new, appid 4019220 "", 600x340): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"linear-gradient(to right, rgb(53, 101, 128) 0%, rgb(64, 121, 153) 100%)"}; parent {"display":"flex","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"20px"}; price {"cls":"discount_final_price","position":"static","display":"block","textAlign":"start"}

### K31 Upcoming Releases bucket capsule (600×340)

- Master key: `a.+1h|.bucket_contents|app,art,art≥50%`; exact signatures: `a.comingsoon_headercap`
- Seen on: explore_upcoming ×2
- Under headings: Upcoming Releases ×2; section: .bucket_contents ×2
- Ancestors: div.bucket_contents.comingsoon_capsules.comingsoon_headercaps < div.page_content < div.page_ctn.top_capsules < div.game.game_page_background ×2
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×2
- Our treatment: same|shape=null|badge=sro-badge sro-corner ×2
- Coverage: **covered** 
- Example (explore_upcoming, appid 1757350 "", 600x320): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"linear-gradient(to right, rgb(53, 101, 128) 0%, rgb(64, 121, 153) 100%)"}; parent {"display":"flex","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"20px"}

### K32 Category video hero side panel before its capsule art loads

- Master key: `div.+1h|.Panel|app,carousel`; exact signatures: `div._3yPJAYRckrGOYnsQF9nnMD`
- Seen on: category_multiplayer
- Under headings: Ignored; section: .Panel
- Ancestors: div.Panel._1845vzkd5RIKg7vU214cq0 < div._3hxg83PMgvZaOaB_-m0mXX < div.VideoRow.mQ2qrYTbonWejXmhFQ81v < div.Panel
- Variants: img=false,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=true ×1
- Our treatment: unclaimed|shape=null|badge=null
- Coverage: **gap** 1/1 unclaimed
- Example (category_multiplayer, appid 1938090 "", 380x200): card {"position":"relative","display":"flex","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"normal"}

### K33 Community recommendation review card (no microtrailer, no hashed class)

- Master key: `div#AppN.appeared.reviewed_app`; exact signatures: `div#AppN.appeared.reviewed_app`
- Seen on: communityrecommendations
- Under headings: There are no reviews that match the filters set above; section: #reviewed_apps
- Ancestors: div#reviewed_apps.trending_reviews_content < div.page_content < div.page_content_ctn < div#responsive_page_template_content.responsive_page_template_content
- Variants: img=true,price=true,date=false,nativeSummary=true,title=true,platforms=false,carousel=false ×1
- Our treatment: same|shape=card|badge=sro-badge sro-corner
- Coverage: **covered** 
- Example (communityrecommendations, appid 1551980 "Silna Baba", 1160x340): card {"position":"relative","display":"flex","overflow":"hidden","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"flex","flexDirection":"column","overflow":"visible","overflowX":"visible","gap":"normal"}; price {"cls":"discount_final_price","position":"static","display":"block","textAlign":"start"}; native {"cls":"reviews","text":"Disgusting, bloody, full of guts, dirty,"}

### K34 Great on Deck 'Ignored' banner panel

- Master key: `div.Panel+4h`; exact signatures: `div.OPH8r3-pnCjCM7T8GrpWo.Panel.SaleSectionForCustomCSS._1cOoCFwafBlSkwllIMf3XM._39HWXhhjsbML7K9sme9ItV`
- Seen on: greatondeck
- Under headings: Ignored; section: #SaleSection_N
- Ancestors: div#SaleSection_N.Panel.SaleSectionCtn.expanded.i2PTzRNXOK1OXvXb9-wzd.links < div.SaleSectionTabListContainer._2VZtqrDRVSIicZZHPUY9SY < div.Panel < div.Panel.SaleOuterContainer._150kddWk8JgylTvh_eC20b
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×1
- Our treatment: same|shape=null|badge=none
- Coverage: **by-design** 1/1 on purpose: the Great on Deck 'Ignored' banner panel, not a game
- Example (greatondeck, appid 1675200 "", 1200x240): card {"position":"relative","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K35 Labs experiment banner fragment (not a game)

- Master key: `div.capsule-banner`; exact signatures: `div.capsule-banner`
- Seen on: labs
- Under headings: 004.1 Search Query Expansion; section: .capsule
- Ancestors: div.capsule < div.left-column < div.labs-content < div.page_content
- Variants: img=true,price=false,date=false,nativeSummary=false,title=false,platforms=false,carousel=false ×1
- Our treatment: unclaimed|shape=null|badge=null
- Coverage: **by-design** 1/1 on purpose: a Labs experiment banner, not a game
- Example (labs, appid 1254040 "", 680x300): card {"position":"static","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}

### K36 Labs experiment text blurb (not a game)

- Master key: `div.exp_text_ctn`; exact signatures: `div.exp_text_ctn`
- Seen on: labs
- Under headings: 004.1 Search Query Expansion; section: .capsule
- Ancestors: div.capsule < div.left-column < div.labs-content < div.page_content
- Variants: link=news,img=false,price=false,date=true,nativeSummary=false,title=false,platforms=false,carousel=false ×1
- Our treatment: same|shape=null|badge=none
- Coverage: **by-design** 1/1 on purpose: a Labs experiment text blurb, not a game
- Example (labs, appid 593110 "", 680x160): card {"position":"static","display":"block","overflow":"visible","borderRadius":"0px","backgroundImage":"none"}; parent {"display":"block","flexDirection":"row","overflow":"visible","overflowX":"visible","gap":"normal"}
