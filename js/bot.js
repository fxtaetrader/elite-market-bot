class MarketBot {
    constructor() {
        this.dataFetcher = new MarketDataFetcher();
        this.telegramBot = new TelegramBot();
        this.updateInterval = null;
        this.lastUpdateTime = null;
        this.updateHistory = [];
        
        this.init();
    }
    
    async init() {
        this.updateStatus('initializing');
        await this.loadConfig();
        this.setupEventListeners();
        this.startScheduler();
        await this.performUpdate(); // Initial update
        this.updateStatus('active');
    }
    
    async loadConfig() {
        // Load saved configuration
        const savedFreq = localStorage.getItem('updateFrequency');
        const savedSignals = localStorage.getItem('includeSignals');
        const savedThreshold = localStorage.getItem('alertThreshold');
        
        if (savedFreq) document.getElementById('updateFrequency').value = savedFreq;
        if (savedSignals) document.getElementById('includeSignals').checked = savedSignals === 'true';
        if (savedThreshold) document.getElementById('alertThreshold').value = savedThreshold;
        
        // Check if Telegram config exists
        const telegramConfig = localStorage.getItem('telegramConfig');
        if (!telegramConfig) {
            this.showConfigPrompt();
        }
    }
    
    setupEventListeners() {
        document.getElementById('manualUpdateBtn')?.addEventListener('click', () => {
            this.performUpdate(true);
        });
        
        document.getElementById('updateFrequency')?.addEventListener('change', (e) => {
            localStorage.setItem('updateFrequency', e.target.value);
            this.startScheduler();
        });
        
        document.getElementById('includeSignals')?.addEventListener('change', (e) => {
            localStorage.setItem('includeSignals', e.target.checked);
        });
        
        document.getElementById('alertThreshold')?.addEventListener('change', (e) => {
            localStorage.setItem('alertThreshold', e.target.value);
        });
    }
    
    startScheduler() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        const frequency = document.getElementById('updateFrequency').value;
        let intervalMinutes = 60; // hourly default
        
        switch(frequency) {
            case 'hourly':
                intervalMinutes = 60;
                break;
            case 'daily':
                intervalMinutes = 1440;
                break;
            case 'manual':
                return;
        }
        
        this.updateInterval = setInterval(() => {
            this.performUpdate();
        }, intervalMinutes * 60 * 1000);
        
        console.log(`Scheduler set to run every ${intervalMinutes} minutes`);
    }
    
    async performUpdate(manual = false) {
        this.updateStatus('updating');
        
        try {
            // Fetch all data
            const [xauData, btcData, xauNews, btcNews, otherMarkets] = await Promise.all([
                this.dataFetcher.fetchXAUUSD(),
                this.dataFetcher.fetchBTCUSD(),
                this.dataFetcher.fetchMarketNews('XAUUSD'),
                this.dataFetcher.fetchMarketNews('BTCUSD'),
                this.dataFetcher.fetchOtherMarkets()
            ]);
            
            // Combine news (prioritize XAUUSD then BTCUSD)
            const allNews = [...xauNews, ...btcNews];
            
            // Generate signals if enabled
            let signals = [];
            if (document.getElementById('includeSignals').checked) {
                signals = this.generateSignals(xauData, btcData);
            }
            
            // Update UI
            this.updateUI({ xau: xauData, btc: btcData, other: otherMarkets }, allNews);
            
            // Send to Telegram
            const marketData = { xau: xauData, btc: btcData };
            const result = await this.telegramBot.sendMarketUpdate(marketData, allNews, signals);
            
            if (result.success) {
                this.addToHistory({ success: true, time: new Date(), data: marketData });
                this.updateStatus('active');
                this.telegramBot.addToLog(`✅ Update sent successfully at ${new Date().toLocaleTimeString()}`, 'success');
            } else {
                this.updateStatus('error', result.error);
                this.telegramBot.addToLog(`❌ Update failed: ${result.error}`, 'error');
            }
            
            // Check for price alerts
            await this.checkPriceAlerts(xauData, btcData);
            
        } catch (error) {
            console.error('Update failed:', error);
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
        const threshold = parseFloat(document.getElementById('alertThreshold').value) || 2;
        const lastData = this.lastUpdateTime ? this.updateHistory[0]?.data : null;
        
        if (lastData) {
            if (Math.abs(xauData.change) >= threshold) {
                await this.telegramBot.sendMessage(
                    `⚠️ *PRICE ALERT*\n\nXAUUSD has moved ${xauData.change}%\nCurrent price: $${xauData.price}\nThreshold: ${threshold}%`
                );
            }
            
            if (Math.abs(btcData.change) >= threshold) {
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
            
            xauNews.forEach(news => {
                xauNewsList.appendChild(this.createNewsElement(news));
            });
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
            
            btcNews.forEach(news => {
                btcNewsList.appendChild(this.createNewsElement(news));
            });
        }
        
        // Update other markets
        const otherMarketsList = document.getElementById('otherMarkets');
        if (otherMarketsList && marketData.other) {
            otherMarketsList.innerHTML = '';
            marketData.other.forEach(market => {
                const marketEl = document.createElement('div');
                marketEl.className = 'market-item';
                marketEl.innerHTML = `
                    <div class="market-name">${market.name}</div>
                    <div class="market-price">$${market.price.toLocaleString()}</div>
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
            <div class="news-title">${news.title}</div>
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
    
    updateStatus(status, errorMsg = null) {
        const statusText = document.getElementById('statusText');
        const dot = document.querySelector('.dot');
        
        if (!statusText) return;
        
        switch(status) {
            case 'initializing':
                statusText.textContent = 'Initializing...';
                dot.style.background = '#ff9800';
                break;
            case 'active':
                statusText.textContent = 'Active - Ready';
                dot.style.background = '#4caf50';
                break;
            case 'updating':
                statusText.textContent = 'Updating...';
                dot.style.background = '#2196f3';
                break;
            case 'error':
                statusText.textContent = `Error: ${errorMsg}`;
                dot.style.background = '#f44336';
                break;
        }
    }
    
    addToHistory(update) {
        this.updateHistory.unshift(update);
        if (this.updateHistory.length > 10) this.updateHistory.pop();
        
        // Save to localStorage
        localStorage.setItem('updateHistory', JSON.stringify(this.updateHistory));
    }
    
    showConfigPrompt() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Configure Telegram Bot</h3>
                <div class="form-group">
                    <label>Bot Token (from @BotFather):</label>
                    <input type="text" id="botToken" placeholder="8735177156:AAGSKgNy8WaG66WK1FKxNCkeqRpxooXstvU">
                </div>
                <div class="form-group">
                    <label>Chat ID:</label>
                    <input type="text" id="chatId" placeholder="-1003889484238">
                </div>
                <div class="form-group">
                    <label>Message Thread ID (optional):</label>
                    <input type="text" id="threadId" placeholder="50">
                </div>
                <button id="saveConfigBtn" class="btn-primary">Save & Continue</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('saveConfigBtn').addEventListener('click', () => {
            const token = document.getElementById('botToken').value;
            const chatId = document.getElementById('chatId').value;
            const threadId = document.getElementById('threadId').value;
            
            if (token && chatId) {
                this.telegramBot.saveConfig(token, chatId, threadId);
                modal.remove();
                this.telegramBot.addToLog('Telegram configured successfully', 'success');
            }
        });
    }
}

// Initialize bot when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.marketBot = new MarketBot();
});
