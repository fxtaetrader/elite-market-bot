class TelegramBot {
    constructor() {
        // IMPORTANT: In production, store these in GitHub Secrets
        // These are placeholders - you'll set them via environment variables
        this.token = null;
        this.chatId = null;
        this.messageThreadId = null;
        
        // Load from localStorage or environment
        this.loadConfig();
    }
    
    loadConfig() {
        // In GitHub Actions, these come from secrets
        // For web interface, store securely in localStorage
        const config = localStorage.getItem('telegramConfig');
        if (config) {
            const parsed = JSON.parse(config);
            this.token = parsed.token;
            this.chatId = parsed.chatId;
            this.messageThreadId = parsed.messageThreadId;
        }
    }
    
    saveConfig(token, chatId, messageThreadId) {
        this.token = token;
        this.chatId = chatId;
        this.messageThreadId = messageThreadId;
        localStorage.setItem('telegramConfig', JSON.stringify({
            token, chatId, messageThreadId
        }));
    }
    
    async sendMessage(message, parseMode = 'Markdown') {
        if (!this.token || !this.chatId) {
            console.error('Telegram configuration missing');
            return { success: false, error: 'Configuration missing' };
        }
        
        try {
            const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
            const payload = {
                chat_id: this.chatId,
                text: message,
                parse_mode: parseMode
            };
            
            if (this.messageThreadId) {
                payload.message_thread_id = parseInt(this.messageThreadId);
            }
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (data.ok) {
                this.addToLog('Message sent successfully', 'success');
                return { success: true, data };
            } else {
                throw new Error(data.description);
            }
        } catch (error) {
            console.error('Telegram send error:', error);
            this.addToLog(`Failed to send: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }
    
    async sendMarketUpdate(marketData, newsItems, signals = null) {
        let message = this.formatMarketUpdate(marketData, newsItems, signals);
        return await this.sendMessage(message);
    }
    
    formatMarketUpdate(marketData, newsItems, signals = null) {
        const lines = [];
        
        // Header
        lines.push('📊 *DAILY MARKET UPDATE*');
        lines.push(`📅 ${new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })}`);
        lines.push(`⏰ ${new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            timeZoneName: 'short' 
        })}`);
        lines.push('');
        
        // XAUUSD Section
        if (marketData.xau) {
            const changeEmoji = marketData.xau.change >= 0 ? '📈' : '📉';
            const changeText = marketData.xau.change >= 0 ? `+${marketData.xau.change}%` : `${marketData.xau.change}%`;
            lines.push('🥇 *XAUUSD - GOLD*');
            lines.push(`💰 Price: $${marketData.xau.price}`);
            lines.push(`${changeEmoji} Change: ${changeText}`);
            lines.push('');
        }
        
        // BTCUSD Section
        if (marketData.btc) {
            const changeEmoji = marketData.btc.change >= 0 ? '📈' : '📉';
            const changeText = marketData.btc.change >= 0 ? `+${marketData.btc.change}%` : `${marketData.btc.change}%`;
            lines.push('₿ *BTCUSD - BITCOIN*');
            lines.push(`💰 Price: $${marketData.btc.price.toLocaleString()}`);
            lines.push(`${changeEmoji} Change: ${changeText}`);
            lines.push('');
        }
        
        // News Section
        if (newsItems && newsItems.length > 0) {
            lines.push('📰 *TOP MARKET NEWS*');
            lines.push('');
            
            // Show top 5 news items
            newsItems.slice(0, 5).forEach((item, index) => {
                const impactEmoji = item.impact === 'HIGH' ? '🔴' : item.impact === 'MEDIUM' ? '🟡' : '🟢';
                lines.push(`${index + 1}. ${impactEmoji} *${item.title}*`);
                if (item.description) {
                    lines.push(`   ${item.description.substring(0, 100)}...`);
                }
                lines.push(`   📍 ${item.source} | ${new Date(item.pubDate).toLocaleTimeString()}`);
                lines.push('');
            });
        }
        
        // Signals Section
        if (signals && signals.length > 0) {
            lines.push('⚡ *TRADING SIGNALS*');
            lines.push('');
            signals.forEach(signal => {
                const actionEmoji = signal.action === 'BUY' ? '🟢' : '🔴';
                lines.push(`${actionEmoji} *${signal.pair}*: ${signal.action}`);
                lines.push(`   Strength: ${signal.strength}`);
                lines.push(`   Reason: ${signal.reason}`);
                lines.push('');
            });
        }
        
        // Footer
        lines.push('---');
        lines.push('🤖 *Automated by Market Bot*');
        lines.push('⚠️ *Disclaimer:* For informational purposes only. Always DYOR.');
        lines.push('');
        lines.push('🔄 *Next update:* Coming soon');
        
        return lines.join('\n');
    }
    
    addToLog(message, type = 'info') {
        const logContainer = document.getElementById('updateLog');
        if (logContainer) {
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            const time = new Date().toLocaleTimeString();
            logEntry.innerHTML = `
                <span class="log-time">[${time}]</span>
                <span class="log-${type}">${message}</span>
            `;
            logContainer.insertBefore(logEntry, logContainer.firstChild);
            
            // Keep only last 50 logs
            while (logContainer.children.length > 50) {
                logContainer.removeChild(logContainer.lastChild);
            }
        }
    }
}

window.TelegramBot = TelegramBot;
