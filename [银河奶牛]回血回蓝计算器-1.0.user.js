// ==UserScript==
// @name         [银河奶牛]回血回蓝计算器
// @namespace    http://tampermonkey.net/
// @version      1.0.3
// @description  计算补给品的搭配性价比，找出最佳回血/回蓝组合。支持左买(买入价)、右买(卖出价)和平均价格的性价比分析，可自定义最低恢复量需求。
// @author       银河奶牛
// @license      CC-BY-NC-SA-4.0
// @match        https://www.milkywayidle.com/*
// @match        https://test.milkywayidle.com/*
// @match        https://www.milkywayidlecn.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/tingxie697-sys/milkywayidle-consumable-optimizer/master/%5B%E9%93%B6%E6%B2%B3%E5%A5%B6%E7%89%9B%5D%E5%9B%9E%E8%A1%80%E5%9B%9E%E8%93%9D%E8%AE%A1%E7%AE%97%E5%99%A8-1.0.user.js
// @downloadURL  https://raw.githubusercontent.com/tingxie697-sys/milkywayidle-consumable-optimizer/master/%5B%E9%93%B6%E6%B2%B3%E5%A5%B6%E7%89%9B%5D%E5%9B%9E%E8%A1%80%E5%9B%9E%E8%93%9D%E8%AE%A1%E7%AE%97%E5%99%A8-1.0.user.js
// @run-at       document-end
// ==/UserScript==

/*
[银河奶牛]回血回蓝计算器 v1.0.3

功能说明：
1. 支持回蓝(MP)和回血(HP)两种类型的补给品计算
2. 计算左买(买入价)、右买(卖出价)和平均价格的性价比
3. 可自定义最低恢复量需求
4. 自动排序显示市场价格和成本分析
5. 界面可拖动、调整大小、最小化
6. 30分钟缓存市场数据，减少API请求

恢复物品：
- 回蓝(MP)：软糖系列、酸奶系列
- 回血(HP)：甜甜圈系列、蛋糕系列

使用方法：
1. 输入最低回血(HP)和回蓝(MP)需求
2. 点击"更新市场数据"按钮获取最新价格
3. 查看最佳搭配建议

GitHub仓库：https://github.com/tingxie697-sys/milkywayidle-consumable-optimizer
*/

(() => {
    "use strict";

    // 恢复能力数据
    const restoreData = {
        // MP恢复物品
        gummies: {
            "gummy": 40,
            "apple_gummy": 80,
            "orange_gummy": 120,
            "plum_gummy": 160,
            "peach_gummy": 200,
            "dragon_fruit_gummy": 240,
            "star_fruit_gummy": 280
        },
        yogurts: {
            "yogurt": 50,
            "apple_yogurt": 100,
            "orange_yogurt": 150,
            "plum_yogurt": 200,
            "peach_yogurt": 250,
            "dragon_fruit_yogurt": 300,
            "star_fruit_yogurt": 350
        },
        // HP恢复物品
        donuts: {
            "donut": 40,
            "blueberry_donut": 80,
            "blackberry_donut": 120,
            "strawberry_donut": 160,
            "mooberry_donut": 200,
            "marsberry_donut": 240,
            "spaceberry_donut": 280
        },
        cakes: {
            "cupcake": 50,
            "blueberry_cake": 100,
            "blackberry_cake": 150,
            "strawberry_cake": 200,
            "mooberry_cake": 250,
            "marsberry_cake": 300,
            "spaceberry_cake": 350
        }
    };

    // 物品名称映射
    const itemNames = {
        // MP恢复
        "gummy": "软糖",
        "apple_gummy": "苹果软糖",
        "orange_gummy": "橙子软糖",
        "plum_gummy": "李子软糖",
        "peach_gummy": "桃子软糖",
        "dragon_fruit_gummy": "火龙果软糖",
        "star_fruit_gummy": "杨桃软糖",
        "yogurt": "酸奶",
        "apple_yogurt": "苹果酸奶",
        "orange_yogurt": "橙子酸奶",
        "plum_yogurt": "李子酸奶",
        "peach_yogurt": "桃子酸奶",
        "dragon_fruit_yogurt": "火龙果酸奶",
        "star_fruit_yogurt": "杨桃酸奶",
        // HP恢复
        "donut": "甜甜圈",
        "blueberry_donut": "蓝莓甜甜圈",
        "blackberry_donut": "黑莓甜甜圈",
        "strawberry_donut": "草莓甜甜圈",
        "mooberry_donut": "哞莓甜甜圈",
        "marsberry_donut": "火星莓甜甜圈",
        "spaceberry_donut": "太空莓甜甜圈",
        "cupcake": "纸杯蛋糕",
        "blueberry_cake": "蓝莓蛋糕",
        "blackberry_cake": "黑莓蛋糕",
        "strawberry_cake": "草莓蛋糕",
        "mooberry_cake": "哞莓蛋糕",
        "marsberry_cake": "火星莓蛋糕",
        "spaceberry_cake": "太空莓蛋糕"
    };

    // 市场API URL
    const MARKET_API_URL = window.location.href.includes("milkywayidle.com")
        ? "https://www.milkywayidle.com/game_data/marketplace.json"
        : window.location.href.includes("milkywayidlecn.com")
        ? "https://www.milkywayidlecn.com/game_data/marketplace.json"
        : "https://www.milkywayidle.com/game_data/marketplace.json";

    // 缓存市场数据
    let marketData = null;
    let lastUpdateTime = 0;
    const CACHE_DURATION = 30 * 60 * 1000; // 30分钟

    // 添加样式
    GM_addStyle(`
        .consumable-optimizer {
            position: fixed;
            top: 50px;
            right: 20px;
            width: 420px;
            min-width: 300px;
            max-height: 90vh;
            background: linear-gradient(135deg, rgba(20,20,30,0.95), rgba(30,30,45,0.95));
            color: #e0e0e0;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            z-index: 9999;
            font-family: 'Segoe UI', Arial, sans-serif;
            display: flex;
            flex-direction: column;
            resize: both;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            backdrop-filter: blur(10px);
        }
        .consumable-optimizer.minimized {
            width: 40px !important;
            height: 40px !important;
            min-width: 40px;
            min-height: 40px;
            resize: none;
            border-radius: 50%;
            cursor: pointer;
            overflow: hidden;
        }
        .consumable-optimizer.minimized .optimizer-body,
        .consumable-optimizer.minimized .panel-header {
            display: none;
        }
        .consumable-optimizer.minimized::after {
            content: '🐄';
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
        }
        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 14px;
            background: linear-gradient(90deg, rgba(76,175,80,0.15), rgba(33,150,243,0.1));
            cursor: move;
            user-select: none;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .panel-header h3 {
            margin: 0;
            color: #81C784;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .panel-controls {
            display: flex;
            gap: 6px;
        }
        .panel-btn {
            width: 22px;
            height: 22px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.06);
            color: #aaa;
            transition: all 0.15s;
        }
        .panel-btn:hover {
            background: rgba(255,255,255,0.15);
            color: #fff;
        }
        .panel-btn.minimize-btn:hover {
            background: rgba(255,193,7,0.3);
            color: #FFD54F;
        }
        .optimizer-body {
            padding: 12px 14px;
            overflow-y: auto;
            flex: 1;
        }
        .optimizer-body::-webkit-scrollbar { width: 4px; }
        .optimizer-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
        .consumable-optimizer h4 {
            margin: 0 0 10px;
            color: #81C784;
            font-size: 13px;
            font-weight: 600;
        }
        .consumable-optimizer h5 {
            margin: 5px 0;
            color: #bbb;
            font-size: 12px;
            font-weight: 600;
        }
        .optimizer-section {
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .optimizer-section:last-child { border-bottom: none; }
        .item-row {
            display: grid;
            grid-template-columns: 100px 100px 100px;
            gap: 8px;
            padding: 3px 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            font-size: 12px;
        }
        .item-row:last-child { border-bottom: none; }
        .item-name { font-weight: 500; color: #999; }
        .item-value { text-align: right; color: #e0e0e0; }
        .best-combo .item-row { grid-template-columns: 100px 1fr; }
        .collapsible .collapse-header {
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 2px 0;
        }
        .collapsible .collapse-header:hover { color: #81C784; }
        .collapsible .collapse-icon {
            font-size: 10px;
            transition: transform 0.2s;
            color: #666;
        }
        .collapsible.collapsed .collapse-icon { transform: rotate(-90deg); }
        .collapsible .collapse-content {
            max-height: 2000px;
            overflow: hidden;
            transition: max-height 0.3s ease-out;
        }
        .collapsible.collapsed .collapse-content { max-height: 0; }
        .combo-group {
            margin-bottom: 8px;
            padding: 8px 10px;
            border-radius: 8px;
        }
        .combo-group.highlight-left {
            background: rgba(76,175,80,0.1);
            border-left: 3px solid #66BB6A;
        }
        .combo-group.highlight-right {
            background: rgba(33,150,243,0.1);
            border-left: 3px solid #42A5F5;
        }
        .combo-group.highlight-avg {
            background: rgba(255,193,7,0.1);
            border-left: 3px solid #FFD54F;
        }
        .best-combo { background: transparent; padding: 4px 0; }
        .update-btn {
            width: 100%;
            padding: 7px;
            background: linear-gradient(90deg, #43A047, #2E7D32);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            margin-top: 8px;
            font-size: 12px;
            font-weight: 500;
            letter-spacing: 0.5px;
            transition: all 0.15s;
        }
        .update-btn:hover { background: linear-gradient(90deg, #4CAF50, #388E3C); transform: translateY(-1px); }
        .loading { text-align: center; color: #666; padding: 10px; font-size: 12px; }
        .restore-input-group {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }
        .restore-input-group label { color: #999; font-size: 12px; }
        .input-pair {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .restore-input {
            width: 100px;
            padding: 5px 8px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 6px;
            color: #e0e0e0;
            font-size: 12px;
            text-align: right;
        }
        .restore-input:focus {
            outline: none;
            border-color: rgba(76,175,80,0.5);
            background: rgba(255,255,255,0.1);
        }
        .restore-input::placeholder { color: #555; }
    `);

    // 创建优化器面板
    function createOptimizerPanel() {
        const panel = document.createElement('div');
        panel.className = 'consumable-optimizer';
        panel.innerHTML = `
            <div class="panel-header">
                <h3>[银河奶牛]回血回蓝计算器</h3>
                <div class="panel-controls">
                    <button class="panel-btn minimize-btn" title="最小化">−</button>
                </div>
            </div>
            <div class="optimizer-body">
                <div class="optimizer-section">
                    <div class="restore-input-group">
                        <div class="input-pair">
                            <label>最低回血(HP)：</label>
                            <input type="number" id="min-hp-input" class="restore-input" value="0" min="0" placeholder="HP">
                        </div>
                        <div class="input-pair">
                            <label>最低回蓝(MP)：</label>
                            <input type="number" id="min-mp-input" class="restore-input" value="550" min="0" placeholder="MP">
                        </div>
                    </div>
                </div>
                <div class="optimizer-section">
                    <h4>最佳搭配</h4>
                    <div class="loading">加载中...</div>
                </div>
                <div class="optimizer-section collapsible collapsed">
                    <h4 class="collapse-header">每点成本分析 <span class="collapse-icon">▼</span></h4>
                    <div class="collapse-content">
                        <div class="loading">加载中...</div>
                    </div>
                </div>
                <div class="optimizer-section collapsible collapsed">
                    <h4 class="collapse-header">市场价格 <span class="collapse-icon">▼</span></h4>
                    <div class="collapse-content">
                        <div class="loading">加载中...</div>
                    </div>
                </div>
                <button class="update-btn">更新市场数据</button>
            </div>
        `;
        document.body.appendChild(panel);
        
        // 绑定折叠事件
        panel.querySelectorAll('.collapse-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.parentElement;
                section.classList.toggle('collapsed');
            });
        });
        
        // 绑定最小化按钮
        const minimizeBtn = panel.querySelector('.minimize-btn');
        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('minimized');
        });
        // 最小化状态下点击圆形图标恢复（拖动时不恢复）
        panel.addEventListener('click', (e) => {
            if (panel.classList.contains('minimized') && !hasDragged) {
                panel.classList.remove('minimized');
            }
        });
        
        // 拖动功能（正常状态拖标题栏，最小化状态拖圆形图标）
        const header = panel.querySelector('.panel-header');
        let isDragging = false;
        let hasDragged = false;
        let dragOffset = { x: 0, y: 0 };

        const startDrag = (e) => {
            if (e.target.classList.contains('panel-btn')) return;
            isDragging = true;
            hasDragged = false;
            dragOffset.x = e.clientX - panel.offsetLeft;
            dragOffset.y = e.clientY - panel.offsetTop;
            panel.style.right = 'auto';
            panel.style.transition = 'none';
        };

        header.addEventListener('mousedown', startDrag);
        panel.addEventListener('mousedown', (e) => {
            if (panel.classList.contains('minimized')) startDrag(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            hasDragged = true;
            let newX = e.clientX - dragOffset.x;
            let newY = e.clientY - dragOffset.y;
            newX = Math.max(0, Math.min(newX, window.innerWidth - panel.offsetWidth));
            newY = Math.max(0, Math.min(newY, window.innerHeight - panel.offsetHeight));
            panel.style.left = newX + 'px';
            panel.style.top = newY + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            panel.style.transition = '';
        });
        
        return panel;
    }

    // 获取市场数据
    function fetchMarketData() {
        return new Promise((resolve, reject) => {
            const sendRequest = typeof GM.xmlHttpRequest === "function" ? GM.xmlHttpRequest : typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : null;

            if (!sendRequest) {
                reject(new Error('无法发送HTTP请求'));
                return;
            }

            sendRequest({
                method: 'GET',
                url: MARKET_API_URL,
                timeout: 5000,
                onload: function(response) {
                    try {
                        if (response.status === 200) {
                            const data = JSON.parse(response.responseText);
                            marketData = data;
                            lastUpdateTime = Date.now();
                            resolve(data);
                        } else {
                            reject(new Error(`HTTP错误: ${response.status}`));
                        }
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function() {
                    reject(new Error('网络错误'));
                },
                ontimeout: function() {
                    reject(new Error('请求超时'));
                }
            });
        });
    }

    // 获取物品价格详情
    // marketData[itemHrid][0] = { a: ask(卖出价/右买), b: bid(买入价/左买) }
    function getItemPriceDetails(itemHrid) {
        if (!marketData) return null;

        let bidPrice = null;  // 买入价 (左买)
        let askPrice = null;  // 卖出价 (右买)

        const marketDataObj = marketData.marketData || marketData;

        if (typeof marketDataObj === 'object' && marketDataObj[itemHrid]) {
            const itemData = marketDataObj[itemHrid];

            if (Array.isArray(itemData) && itemData.length > 0) {
                askPrice = itemData[0].a;
                bidPrice = itemData[0].b;
            } else if (typeof itemData === 'object') {
                if (itemData[0] && typeof itemData[0] === 'object') {
                    askPrice = itemData[0].a;
                    bidPrice = itemData[0].b;
                } else {
                    askPrice = itemData.ask || itemData.a;
                    bidPrice = itemData.bid || itemData.b;
                }
            }
        }

        const hasValidBid = bidPrice !== null && bidPrice !== undefined && !isNaN(bidPrice) && bidPrice > 0;
        const hasValidAsk = askPrice !== null && askPrice !== undefined && !isNaN(askPrice) && askPrice > 0;

        if (!hasValidBid && !hasValidAsk) return null;

        return { bidPrice: hasValidBid ? bidPrice : null, askPrice: hasValidAsk ? askPrice : null };
    }
    
    // 获取物品价格（兼容旧代码）
    function getItemPrice(itemHrid) {
        const details = getItemPriceDetails(itemHrid);
        return details ? (details.askPrice || details.bidPrice) : null;
    }

    // 数字格式化：1000=1k, 1000000=1m
    function fmtNum(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(2) + 'm';
        if (n >= 1000) return (n / 1000).toFixed(2) + 'k';
        return n.toFixed(2);
    }

    // 计算所有物品的性价比（HP+MP同时计算）
    function calculateAllPerformance() {
        const allItems = { hp: [], mp: [] };
        const processItems = (dataSource, category) => {
            for (const [hrid, restore] of Object.entries(dataSource)) {
                const itemHrid = `/items/${hrid}`;
                const priceDetails = getItemPriceDetails(itemHrid);
                if (priceDetails && (priceDetails.bidPrice !== null || priceDetails.askPrice !== null)) {
                    const bidPrice = priceDetails.bidPrice !== null ? priceDetails.bidPrice : priceDetails.askPrice;
                    const askPrice = priceDetails.askPrice !== null ? priceDetails.askPrice : priceDetails.bidPrice;
                    const leftPerf = bidPrice !== null ? bidPrice / restore : Infinity;
                    const rightPerf = askPrice !== null ? askPrice / restore : Infinity;
                    allItems[category].push({
                        hrid, name: itemNames[hrid], restore,
                        bidPrice, askPrice,
                        leftPerformance: leftPerf,
                        rightPerformance: rightPerf,
                        performance: (leftPerf + rightPerf) / 2
                    });
                }
            }
        };
        processItems(restoreData.gummies, 'mp');
        processItems(restoreData.yogurts, 'mp');
        processItems(restoreData.donuts, 'hp');
        processItems(restoreData.cakes, 'hp');

        const hpOrder = ['donut','blueberry_donut','blackberry_donut','strawberry_donut','mooberry_donut','marsberry_donut','spaceberry_donut',
            'cupcake','blueberry_cake','blackberry_cake','strawberry_cake','mooberry_cake','marsberry_cake','spaceberry_cake'];
        const mpOrder = ['gummy','apple_gummy','orange_gummy','plum_gummy','peach_gummy','dragon_fruit_gummy','star_fruit_gummy',
            'yogurt','apple_yogurt','orange_yogurt','plum_yogurt','peach_yogurt','dragon_fruit_yogurt','star_fruit_yogurt'];
        allItems.hp.sort((a, b) => hpOrder.indexOf(a.hrid) - hpOrder.indexOf(b.hrid));
        allItems.mp.sort((a, b) => mpOrder.indexOf(a.hrid) - mpOrder.indexOf(b.hrid));
        return allItems;
    }

    // 生成 k 个物品的所有组合（可重复选取）
    function generateCombos(items, k) {
        if (k === 0) return [{ totalRestore: 0, totalCost: 0, items: [] }];
        const result = [];
        const sub = generateCombos(items, k - 1);
        for (const combo of sub) {
            for (const item of items) {
                result.push({
                    totalRestore: combo.totalRestore + item.restore,
                    totalCost: combo.totalCost + item.cost,
                    items: [...combo.items, { name: item.name, restore: item.restore, cost: item.cost }]
                });
            }
        }
        return result;
    }

    // 在 3 格约束下找 HP+MP 最优分配
    // 游戏机制：可控制食用速率(0~1个/min/格)，优先吃性价比高的
    // 最优策略：按 cost/restore 排序，性价比高的尽量吃满(1个/min)，剩余需求由次优食物补足
    function findBestAllocation(allItems, minHP, minMP) {
        if (minHP <= 0 && minMP <= 0) return null;

        const hpItems = allItems.hp.map(i => ({ hrid: i.hrid, name: i.name, restore: i.restore, cost: i.bidPrice || i.askPrice })).filter(i => i.cost > 0);
        const mpItems = allItems.mp.map(i => ({ hrid: i.hrid, name: i.name, restore: i.restore, cost: i.bidPrice || i.askPrice })).filter(i => i.cost > 0);
        if (hpItems.length === 0 && mpItems.length === 0) return null;

        // 计算最优食用策略：按性价比排序，优先吃满高效的
        function calcBestStrategy(items, k, minRestore) {
            if (k <= 0 || minRestore <= 0) return { hourlyCost: 0, items: [], eatingOrder: [] };
            const combos = generateCombos(items, k);
            let best = null;
            for (const combo of combos) {
                if (combo.totalRestore < minRestore) continue;
                // 按性价比排序（cost/restore 升序 = 最优优先）
                const sorted = [...combo.items].sort((a, b) => (a.cost / a.restore) - (b.cost / b.restore));
                let remaining = minRestore;
                const strategy = [];
                for (const item of sorted) {
                    const needed = remaining / item.restore;
                    const rate = Math.min(needed, 1);
                    strategy.push({ ...item, rate });
                    remaining -= item.restore * rate;
                    if (remaining <= 0) break;
                }
                const hourlyCost = strategy.reduce((s, i) => s + i.cost * i.rate * 60, 0);
                if (!best || hourlyCost < best.hourlyCost) {
                    best = { hourlyCost, items: combo.items, totalRestore: combo.totalRestore, totalCost: combo.totalCost, strategy };
                }
            }
            return best;
        }

        // 生成指定格数的食物组合（2格时必须不同类型：甜甜圈+蛋糕 或 软糖+酸奶）
        function generateCategoryCombos(items, categoryA, categoryB, k) {
            if (k <= 0) return [{ totalRestore: 0, totalCost: 0, items: [] }];
            if (k === 1) return items.map(i => ({ totalRestore: i.restore, totalCost: i.cost, items: [i] }));
            // k === 2: 必须从两个不同类别各选一个
            const itemsA = items.filter(i => categoryA.includes(i.hrid));
            const itemsB = items.filter(i => categoryB.includes(i.hrid));
            const result = [];
            for (const a of itemsA) {
                for (const b of itemsB) {
                    result.push({
                        totalRestore: a.restore + b.restore,
                        totalCost: a.cost + b.cost,
                        items: [a, b]
                    });
                }
            }
            return result;
        }

        function calcBestComboStrategy(items, categoryA, categoryB, k, minRestore) {
            if (k <= 0 || minRestore <= 0) return { hourlyCost: 0, items: [], strategy: [] };
            const combos = generateCategoryCombos(items, categoryA, categoryB, k);
            let best = null;
            for (const combo of combos) {
                if (combo.totalRestore < minRestore) continue;
                const sorted = [...combo.items].sort((a, b) => (a.cost / a.restore) - (b.cost / b.restore));
                let remaining = minRestore;
                const strategy = [];
                for (const item of sorted) {
                    const needed = remaining / item.restore;
                    const rate = Math.min(needed, 1);
                    strategy.push({ ...item, rate });
                    remaining -= item.restore * rate;
                    if (remaining <= 0) break;
                }
                const hourlyCost = strategy.reduce((s, i) => s + i.cost * i.rate * 60, 0);
                if (!best || hourlyCost < best.hourlyCost) {
                    best = { hourlyCost, items: combo.items, totalRestore: combo.totalRestore, totalCost: combo.totalCost, strategy };
                }
            }
            return best;
        }

        const donutNames = ['donut','blueberry_donut','blackberry_donut','strawberry_donut','mooberry_donut','marsberry_donut','spaceberry_donut'];
        const cakeNames = ['cupcake','blueberry_cake','blackberry_cake','strawberry_cake','mooberry_cake','marsberry_cake','spaceberry_cake'];
        const gummyNames = ['gummy','apple_gummy','orange_gummy','plum_gummy','peach_gummy','dragon_fruit_gummy','star_fruit_gummy'];
        const yogurtNames = ['yogurt','apple_yogurt','orange_yogurt','plum_yogurt','peach_yogurt','dragon_fruit_yogurt','star_fruit_yogurt'];

        let bestTotalHourly = Infinity, bestResult = null;
        for (let hpSlots = 1; hpSlots <= 2; hpSlots++) {
            const mpSlots = 3 - hpSlots;
            const hpBest = calcBestComboStrategy(hpItems, donutNames, cakeNames, hpSlots, minHP);
            const mpBest = calcBestComboStrategy(mpItems, gummyNames, yogurtNames, mpSlots, minMP);
            if (!hpBest || !mpBest) continue;
            if (hpBest.hourlyCost === Infinity || mpBest.hourlyCost === Infinity) continue;
            const total = hpBest.hourlyCost + mpBest.hourlyCost;
            if (total < bestTotalHourly) {
                bestTotalHourly = total;
                bestResult = {
                    hpStrategy: hpBest.strategy, hpItems: hpBest.items, hpRestore: hpBest.totalRestore, hpCost: hpBest.totalCost, hpHourlyCost: hpBest.hourlyCost, hpSlots,
                    mpStrategy: mpBest.strategy, mpItems: mpBest.items, mpRestore: mpBest.totalRestore, mpCost: mpBest.totalCost, mpHourlyCost: mpBest.hourlyCost, mpSlots,
                    totalHourlyCost: total, totalSlots: 3
                };
            }
        }
        return bestResult;
    }




    // 更新面板
    async function updatePanel(panel) {
        try {
            const minHP = parseInt(panel.querySelector('#min-hp-input')?.value) || 0;
            const minMP = parseInt(panel.querySelector('#min-mp-input')?.value) || 0;

            if (!marketData || (Date.now() - lastUpdateTime) > CACHE_DURATION) {
                await fetchMarketData();
            }

            const allItems = calculateAllPerformance();
            if (allItems.hp.length === 0 && allItems.mp.length === 0) {
                throw new Error('没有获取到物品价格数据');
            }

            const best = findBestAllocation(allItems, minHP, minMP);

            // 最佳搭配 section (nth-child(2))
            const comboSection = panel.querySelector('.optimizer-body .optimizer-section:nth-child(2)');

            if (!best) {
                // 检查哪些需求无法满足
                const maxHP1 = allItems.hp.length > 0 ? Math.max(...allItems.hp.map(i => i.restore)) : 0;
                const maxHP2 = allItems.hp.length >= 2 ? maxHP1 + Math.max(...allItems.hp.filter(i => i.restore < maxHP1).map(i => i.restore), 0) : maxHP1;
                const maxMP1 = allItems.mp.length > 0 ? Math.max(...allItems.mp.map(i => i.restore)) : 0;
                const maxMP2 = allItems.mp.length >= 2 ? maxMP1 + Math.max(...allItems.mp.filter(i => i.restore < maxMP1).map(i => i.restore), 0) : maxMP1;
                const hpImpossible = minHP > 0 && minHP > maxHP2;
                const mpImpossible = minMP > 0 && minMP > maxMP2;
                let reason = '';
                if (hpImpossible && mpImpossible) reason = '回血和回蓝需求都超出最大恢复量';
                else if (hpImpossible) reason = `回血需求 ${minHP} 超出最大恢复 ${maxHP2}（2格）`;
                else if (mpImpossible) reason = `回蓝需求 ${minMP} 超出最大恢复 ${maxMP2}（2格）`;
                else reason = '请设置最低恢复量（HP或MP至少一项 > 0）';
                comboSection.innerHTML = `<h4>最佳搭配（3格）</h4><div class="loading" style="color:#F44336">无法实现：${reason}</div>`;
            } else {
                const hpPerPoint = best.hpRestore > 0 ? (best.hpCost / best.hpRestore).toFixed(4) : '-';
                const mpPerPoint = best.mpRestore > 0 ? (best.mpCost / best.mpRestore).toFixed(4) : '-';
                const hpFoodRows = best.hpStrategy.map((i, idx) => {
                    const tag = idx === 0 ? ' ★优先' : '';
                    return `<div class="item-row"><span class="item-name">${i.name}${tag}</span><span class="item-value">回血${i.restore}/个</span><span class="item-value">${i.rate.toFixed(2)}个/min</span></div>`;
                }).join('');
                const mpFoodRows = best.mpStrategy.map((i, idx) => {
                    const tag = idx === 0 ? ' ★优先' : '';
                    return `<div class="item-row"><span class="item-name">${i.name}${tag}</span><span class="item-value">回蓝${i.restore}/个</span><span class="item-value">${i.rate.toFixed(2)}个/min</span></div>`;
                }).join('');

                comboSection.innerHTML = `
                    <h4>最佳搭配（共 ${best.totalSlots}/3 格）</h4>
                    <div class="combo-group highlight-left">
                        <h5>回血(HP) - ${best.hpSlots} 格</h5>
                        <div class="best-combo">
                            ${hpFoodRows}
                            <div class="item-row"><span class="item-name">总回血</span><span class="item-value">${best.hpRestore}</span></div>
                            <div class="item-row"><span class="item-name">食物成本</span><span class="item-value">${fmtNum(best.hpCost)}</span></div>
                            <div class="item-row"><span class="item-name">每小时成本</span><span class="item-value">${fmtNum(best.hpHourlyCost)}</span></div>
                            <div class="item-row"><span class="item-name">每天成本</span><span class="item-value">${fmtNum(best.hpHourlyCost * 24)}</span></div>
                            <div class="item-row"><span class="item-name">成本/血</span><span class="item-value">${hpPerPoint}</span></div>
                        </div>
                    </div>
                    <div class="combo-group highlight-right">
                        <h5>回蓝(MP) - ${best.mpSlots} 格</h5>
                        <div class="best-combo">
                            ${mpFoodRows}
                            <div class="item-row"><span class="item-name">总回蓝</span><span class="item-value">${best.mpRestore}</span></div>
                            <div class="item-row"><span class="item-name">食物成本</span><span class="item-value">${fmtNum(best.mpCost)}</span></div>
                            <div class="item-row"><span class="item-name">每小时成本</span><span class="item-value">${fmtNum(best.mpHourlyCost)}</span></div>
                            <div class="item-row"><span class="item-name">每天成本</span><span class="item-value">${fmtNum(best.mpHourlyCost * 24)}</span></div>
                            <div class="item-row"><span class="item-name">成本/蓝</span><span class="item-value">${mpPerPoint}</span></div>
                        </div>
                    </div>
                    <div class="combo-group highlight-avg">
                        <h5>合计</h5>
                        <div class="best-combo">
                            <div class="item-row"><span class="item-name">每小时总成本</span><span class="item-value">${fmtNum(best.totalHourlyCost)}</span></div>
                            <div class="item-row"><span class="item-name">每天总成本</span><span class="item-value">${fmtNum(best.totalHourlyCost * 24)}</span></div>
                        </div>
                    </div>
                `;
            }

            // 成本分析 section (nth-child(3))
            const analysisContent = panel.querySelector('.optimizer-body .optimizer-section:nth-child(3) .collapse-content');

            // 获取推荐搭配中的物品名称
            const recommendedHP = best ? new Set(best.hpItems.map(i => i.name)) : new Set();
            const recommendedMP = best ? new Set(best.mpItems.map(i => i.name)) : new Set();

            const generateBarSection = (items, typeName, color, recommendedNames) => {
                const valid = items.filter(i => i.performance !== Infinity && i.performance > 0);
                if (valid.length === 0) return `<h5 style="color:${color};margin:10px 0 6px">${typeName}</h5><div class="loading">无数据</div>`;
                const sorted = [...valid].sort((a, b) => a.performance - b.performance);
                const minP = sorted[0].performance;
                const maxP = sorted[sorted.length - 1].performance;
                const range = maxP - minP || 1;

                const rows = sorted.map((item) => {
                    const pct = ((item.performance - minP) / range) * 100;
                    const isRecommended = recommendedNames.has(item.name);
                    const barColor = isRecommended ? color : `rgba(${color === '#66BB6A' ? '76,175,80' : '33,150,243'},${0.3 + (pct / 100) * 0.5})`;
                    return `
                        <div style="margin:4px 0;${isRecommended ? 'font-weight:600;' : ''}">
                            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">
                                <span style="color:${isRecommended ? '#EF5350' : '#aaa'}">${isRecommended ? '★ ' : ''}${item.name}</span>
                                <span style="color:${isRecommended ? '#EF5350' : '#888'};${isRecommended ? 'font-weight:700;' : ''}">${item.performance.toFixed(2)} 金/点</span>
                            </div>
                            <div style="background:rgba(255,255,255,0.05);border-radius:3px;height:6px;overflow:hidden">
                                <div style="width:${Math.max(pct, 2)}%;height:100%;background:${barColor};border-radius:3px;transition:width 0.3s"></div>
                            </div>
                        </div>`;
                }).join('');

                const recommendedItems = sorted.filter(i => recommendedNames.has(i.name));
                const summaryStr = recommendedItems.length > 0
                    ? `推荐 ${recommendedItems.map(i => `${i.name} ${i.performance.toFixed(2)}`).join('、')} 金/点`
                    : `最优 ${sorted[0].performance.toFixed(2)} 金/点`;

                return `
                    <h5 style="color:${color};margin:10px 0 6px;font-size:12px">${typeName} <span style="color:#EF5350;font-weight:700">· ${summaryStr}</span></h5>
                    ${rows}`;
            };

            analysisContent.innerHTML = `
                <div style="font-size:11px;color:#666;margin-bottom:8px">按平均性价比排序（左买+右买均值），★ 为当前推荐搭配</div>
                ${generateBarSection(allItems.hp, '回血(HP)', '#66BB6A', recommendedHP)}
                ${generateBarSection(allItems.mp, '回蓝(MP)', '#42A5F5', recommendedMP)}
            `;

            // 市场价格 section (nth-child(4))
            const priceContent = panel.querySelector('.optimizer-body .optimizer-section:nth-child(4) .collapse-content');
            const generatePriceSection = (items, typeName, color) => {
                if (items.length === 0) return `<h5 style="color:${color};margin:10px 0 6px">${typeName}</h5><div class="loading">无数据</div>`;
                const rows = items.map(item => {
                    const spread = item.bidPrice && item.askPrice ? item.askPrice - item.bidPrice : null;
                    const spreadStr = spread !== null ? (spread > 0 ? `+${fmtNum(spread)}` : '0') : '-';
                    return `
                        <div style="display:grid;grid-template-columns:70px 1fr 1fr 50px;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;align-items:center">
                            <span style="color:#aaa;font-weight:500">${item.name}</span>
                            <span style="text-align:right;color:#66BB6A">${item.bidPrice ? fmtNum(item.bidPrice) : '-'}</span>
                            <span style="text-align:right;color:#EF5350">${item.askPrice ? fmtNum(item.askPrice) : '-'}</span>
                            <span style="text-align:right;color:#888">${item.restore}</span>
                        </div>`;
                }).join('');
                return `
                    <h5 style="color:${color};margin:10px 0 6px;font-size:12px">${typeName}</h5>
                    <div style="display:grid;grid-template-columns:70px 1fr 1fr 50px;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.1);font-size:10px;color:#666">
                        <span>物品</span><span style="text-align:right">买入价</span><span style="text-align:right">卖出价</span><span style="text-align:right">恢复</span>
                    </div>
                    ${rows}`;
            };
            priceContent.innerHTML = `
                ${generatePriceSection(allItems.hp, '回血(HP)', '#66BB6A')}
                ${generatePriceSection(allItems.mp, '回蓝(MP)', '#42A5F5')}
            `;

        } catch (e) {
            console.error('更新面板错误:', e);
            const comboSection = panel.querySelector('.optimizer-body .optimizer-section:nth-child(2)');
            comboSection.innerHTML = `<h4>最佳搭配</h4><div class="loading">无法获取市场数据</div>`;
            panel.querySelector('.optimizer-body .optimizer-section:nth-child(3) .collapse-content').innerHTML = `<div class="loading">无法获取市场数据</div>`;
            panel.querySelector('.optimizer-body .optimizer-section:nth-child(4) .collapse-content').innerHTML = `<div class="loading">无法获取市场数据</div>`;
        }
    }

    // 初始化
    function init() {
        const panel = createOptimizerPanel();
        updatePanel(panel);

        panel.querySelector('.update-btn').addEventListener('click', () => {
            marketData = null;
            updatePanel(panel);
        });

        panel.querySelector('#min-hp-input').addEventListener('input', () => updatePanel(panel));
        panel.querySelector('#min-mp-input').addEventListener('input', () => updatePanel(panel));
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
