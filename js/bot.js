class MarketBot {
    constructor() {
        console.log("Initializing Market Bot...");
        this.dataFetcher = new MarketDataFetcher();
        this.telegramBot = new TelegramBot();
        this.updateInterval = null;
        this.lastUpdateTime = null;
        this.updateHistory = [];
        
        this.init();
    }
    
    async init() {
        console.log("Bot initialization started...");
        this.updateStatus('initializing');
        this.setupEventListeners();
        this.startScheduler();
        
        // Test Telegram connection first
        const testResult = await this.telegramBot.testConnection();
        if (testResult.success) {
            console.log("✅ Telegram connection successful!");
            this.telegramBot.addToLog("Bot initialized successfully! Telegram connected.", 'success');
        } else {
            console.error("❌ Telegram connection failed:", testResult.error);
            this.telegramBot.addToLog(`⚠️ Telegram connection failed: ${testResult.error}`, 'error');
        }
        
        // Perform initial update
        await this.performUpdate();
        this.updateStatus('active');
        console.log("Bot initialization complete!");
    }
    
    setupEventListeners() {
        const manualBtn = document.getElementById('manualUpdateBtn');
        if (manualBtn) {
            manualBtn.addEventListener('click', () => {
                console.log("Manual update triggered");
                this.performUpdate(true);
            });
        }
        
        const frequencySelect = document.getElementById('updateFrequency');
        if (frequencySelect) {
            frequencySelect.addEventListener('change', (e) => {
                localStorage.setItem('updateFrequency', e.target.value);
                this.startScheduler();
            });
        }
        
        const includeSignals = document.getElementById('includeSignals');
        if (includeSignals) {
            includeSignals.addEventListener('change', (e) => {
                localStorage.setItem('includeSignals', e.target.checked);
            });
        }
        
        const alertThreshold = document.getElementById('alertThreshold');
        if (alertThreshold) {
            alertThreshold.addEventListener('change', (e) => {
                localStorage.setItem('alertThreshold', e.target.value);
            });
        }
        
        // Load saved settings
        const savedFreq = localStorage.getItem('updateFrequency');
        const savedSignals = localStorage.getItem('includeSignals');
        const savedThreshold = localStorage.getItem('alertThreshold');
        
        if (savedFreq && frequencySelect) frequencySelect.value = savedFreq;
        if (savedSignals && includeSignals) includeSignals.checked = savedSignals === 'true';
        if (savedThreshold && alertThreshold) alertThreshold.value = savedThreshold;
    }
    
    startScheduler() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        const frequency = document.getElementById('updateFrequency')?.value || 'daily';
        let intervalMinutes = 60;
        
        switch(frequency) {
            case 'hourly':
                intervalMinutes = 60;
                break;
            case 'daily':
                intervalMinutes = 1440;
                break;
            case 'manual':
                console.log("Manual mode - no automatic updates");
                return;
        }
        
        this.updateInterval = setInterval(() => {
            console.log(`Scheduled update triggered (every ${intervalMinutes} minutes)`);
            this.performUpdate();
        }, intervalMinutes * 60 * 1000);
        
        console.log(`Scheduler set to run every ${intervalMinutes} minutes`);
    }
    
    async performUpdate(manual = false) {
        console.log("Starting market update...");
        this.updateStatus('updating');
        
        try {
            // Fetch all data
            console.log("Fetching XAUUSD data...");
            const xauData = await this.dataFetcher.fetchXAUUSD();
            console.log("XAUUSD:", xauData);
            
            console.log("Fetching BTCUSD data...");
            const btcData = await this.dataFetcher.fetchBTCUSD();
            console.log("BTCUSD:", btcData);
            
            console.log("Fetching XAUUSD news...");
            const xauNews = await this.dataFetcher.fetchMarketNews('XAUUSD');
            console.log(`Found ${xauNews.length} XAUUSD news items`);
            
            console.log("Fetching BTCUSD news...");
            const btcNews = await this.dataFetcher.fetchMarketNews('BTCUSD');
            console.log(`Found ${btcNews.length} BTCUSD news items`);
            
            console.log("Fetching other markets...");
            const otherMarkets = await this.dataFetcher.fetchOtherMarkets();
            
            // Combine news (prioritize XAUUSD then BTCUSD)
            const allNews = [...xauNews, ...btcNews];
            console.log(`Total news items: ${allNews.length}`);
            
            // Generate signals if enabled
            let signals = [];
            const includeSignals = document.getElementById('includeSignals')?.checked;
            if (includeSignals) {
                console.log("Generating trading signals...");
                signals = this.generateSignals(xauData, btcData);
                console.log(`Generated ${signals.length} signals`);
            }
            
            // Update UI
            console.log("Updating UI...");
            this.updateUI({ xau: xauData, btc: btcData, other: otherMarkets }, allNews);
            
            // Send to Telegram
            console.log("Sending to Telegram...");
            const marketData = { xau: xauData, btc: btcData };
            const result = await this.telegramBot.sendMarketUpdate(marketData, allNews, signals);
            
            if (result.success) {
                console.log("✅ Update completed successfully!");
                this.addToHistory({ success: true, time: new Date(), data: marketData });
                this.updateStatus('active');
                this.telegramBot.addToLog(`✅ Market update sent successfully at ${new Date().toLocaleTimeString()}`, 'success');
            } else {
                console.error("❌ Update failed:", result.error);
                this.updateStatus('error', result.error);
                this.telegramBot.addToLog(`❌ Update failed: ${result.error}`, 'error');
            }
            
            // Check for price alerts
            await this.checkPriceAlerts(xauData, btcData);
            
        } catch (error) {
            console.error('Update failed with error:', error);
            this.updateStatus('error', error.message);
            this.telegramBot.addToLog(`❌ Update failed: ${error.message}`, 'error');
        }
    }
    
    generateSignals(xauData, btcData) {
        const signals = [];
        
        // Simple signal generation based on price movements
        if (xauData.change > 1) {
            signals.push({
                pair: 'XAUUSD',
                action: 'BUY',
                strength: 'HIGH',
                reason: 'Strong bullish momentum with +1% gain'
            });
        } else if (xauData.change < -1) {
            signals.push({
                pair: 'XAUUSD',
                action: 'SELL',
                strength: 'HIGH',
                reason: 'Bearish pressure with -1% drop'
            });
        }
        
        if (btcData.change > 2) {
            signals.push({
                pair: 'BTCUSD',
                action: 'BUY',
                strength: 'MEDIUM',
                reason: 'Strong upward movement'
            });
        } else if (btcData.change < -2) {
            signals.push({
                pair: 'BTCUSD',
                action: 'SELL',
                strength: 'MEDIUM',
                reason: 'Downward pressure'
            });
        }
        
        return signals;
    }
    
    async checkPriceAlerts(xauData, btcData) {
        const threshold = parseFloat(document.getElementById('alertThreshold')?.value) || 2;
        const lastData = this.updateHistory[0]?.data;
        
        if (lastData && lastData.xau && lastData.btc) {
            const xauChange = Math.abs(xauData.change);
            const btcChange = Math.abs(btcData.change);
            
            if (xauChange >= threshold) {
                await this.telegramBot.sendMessage(
                    `⚠️ *PRICE ALERT*\n\nXAUUSD has moved ${xauData.change}%\nCurrent price: $${xauData.price}\nThreshold: ${threshold}%`
                );
            }
            
            if (btcChange >= threshold) {
                await this.telegramBot.sendMessage(
                    `⚠️ *PRICE ALERT*\n\nBTCUSD has moved ${btcData.change}%\nCurrent price: $${btcData.price.toLocaleString()}\nThreshold: ${threshold}%`
                );
            }
        }
        
        this.lastUpdateTime = new Date();
    }
    
    updateUI(marketData, newsItems) {
        // Update XAUUSD
        const xauPriceEl = document.querySelector('#xauPrice .price');
        const xauChangeEl = document.querySelector('#xauPrice .change');
        if (xauPriceEl) xauPriceEl.textContent = `$${marketData.xau.price}`;
        if (xauChangeEl) {
            xauChangeEl.textContent = `${marketData.xau.change >= 0 ? '+' : ''}${marketData.xau.change}%`;
            xauChangeEl.className = `change ${marketData.xau.change >= 0 ? 'positive' : 'negative'}`;
        }
        
        // Update XAUUSD News
        const xauNewsList = document.querySelector('#xauNews .news-list');
        if (xauNewsList && newsItems) {
            xauNewsList.innerHTML = '';
            const xauNews = newsItems.filter(n => 
                n.title.toLowerCase().includes('gold') || 
                n.title.toLowerCase().includes('xau')
            ).slice(0, 5);
            
            if (xauNews.length === 0) {
                xauNewsList.innerHTML = '<div class="loading">No recent news available</div>';
            } else {
                xauNews.forEach(news => {
                    xauNewsList.appendChild(this.createNewsElement(news));
                });
            }
        }
        
        // Update BTCUSD
        const btcPriceEl = document.querySelector('#btcPrice .price');
        const btcChangeEl = document.querySelector('#btcPrice .change');
        if (btcPriceEl) btcPriceEl.textContent = `$${marketData.btc.price.toLocaleString()}`;
        if (btcChangeEl) {
            btcChangeEl.textContent = `${marketData.btc.change >= 0 ? '+' : ''}${marketData.btc.change}%`;
            btcChangeEl.className = `change ${marketData.btc.change >= 0 ? 'positive' : 'negative'}`;
        }
        
        // Update BTCUSD News
        const btcNewsList = document.querySelector('#btcNews .news-list');
        if (btcNewsList && newsItems) {
            btcNewsList.innerHTML = '';
            const btcNews = newsItems.filter(n => 
                n.title.toLowerCase().includes('bitcoin') || 
                n.title.toLowerCase().includes('btc')
            ).slice(0, 5);
            
            if (btcNews.length === 0) {
                btcNewsList.innerHTML = '<div class="loading">No recent news available</div>';
            } else {
                btcNews.forEach(news => {
                    btcNewsList.appendChild(this.createNewsElement(news));
                });
            }
        }
        
        // Update other markets
        const otherMarketsList = document.getElementById('otherMarkets');
        if (otherMarketsList && marketData.other && marketData.other.length > 0) {
            otherMarketsList.innerHTML = '';
            marketData.other.forEach(market => {
                const marketEl = document.createElement('div');
                marketEl.className = 'market-item';
                marketEl.innerHTML = `
                    <div class="market-name">${market.name}</div>
                    <div class="market-price">$${typeof market.price === 'number' ? market.price.toLocaleString() : market.price}</div>
                    <div class="market-change ${market.change >= 0 ? 'positive' : 'negative'}">
                        ${market.change >= 0 ? '+' : ''}${market.change}%
                    </div>
                `;
                otherMarketsList.appendChild(marketEl);
            });
        }
    }
    
    createNewsElement(news) {
        const div = document.createElement('div');
        div.className = 'news-item';
        div.innerHTML = `
            <div class="news-title">${this.escapeHtml(news.title)}</div>
            <div class="news-meta">
                <span>${news.source}</span>
                <span>${new Date(news.pubDate).toLocaleTimeString()}</span>
                <span class="news-impact impact-${news.impact.toLowerCase()}">${news.impact}</span>
            </div>
        `;
        
        if (news.link && news.link !== '#') {
            div.style.cursor = 'pointer';
            div.addEventListener('click', () => window.open(news.link, '_blank'));
        }
        
        return div;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    updateStatus(status, errorMsg = null) {
        const statusText = document.getElementById('statusText');
        const dot = document.querySelector('.dot');
        
        if (!statusText) return;
        
        switch(status) {
            case 'initializing':
                statusText.textContent = 'Initializing...';
                if (dot) dot.style.background = '#ff9800';
                break;
            case 'active':
                statusText.textContent = 'Active - Ready';
                if (dot) dot.style.background = '#4caf50';
                break;
            case 'updating':
                statusText.textContent = 'Updating...';
                if (dot) dot.style.background = '#2196f3';
                break;
            case 'error':
                statusText.textContent = `Error: ${errorMsg || 'Unknown error'}`;
                if (dot) dot.style.background = '#f44336';
                break;
        }
    }
    
    addToHistory(update) {
        this.updateHistory.unshift(update);
        if (this.updateHistory.length > 10) this.updateHistory.pop();
        
        // Save to localStorage
        try {
            localStorage.setItem('updateHistory', JSON.stringify(this.updateHistory));
        } catch(e) {
            console.error("Error saving history:", e);
        }
    }
}

// Initialize bot when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, initializing Market Bot...");
    window.marketBot = new MarketBot();
});
