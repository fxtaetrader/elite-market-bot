class TelegramBot {
    constructor() {
        // Direct configuration with your token
        this.token = "8735177156:AAGSKgNy8WaG66WK1FKxNCkeqRpxooXstvU";
        this.chatId = "-1003889484238";
        this.messageThreadId = "50";
        
        // Also try to load from localStorage if available
        this.loadConfig();
        
        console.log("Telegram Bot initialized with token:", this.token ? "Token set" : "No token");
        console.log("Chat ID:", this.chatId);
    }
    
    loadConfig() {
        // Try to load from localStorage, but use hardcoded values as fallback
        const savedConfig = localStorage.getItem('telegramConfig');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                if (config.token) this.token = config.token;
                if (config.chatId) this.chatId = config.chatId;
                if (config.messageThreadId) this.messageThreadId = config.messageThreadId;
                console.log("Loaded config from localStorage");
            } catch(e) {
                console.error("Error loading config:", e);
            }
        } else {
            // Save hardcoded config to localStorage
            this.saveConfigToLocalStorage();
        }
    }
    
    saveConfigToLocalStorage() {
        const config = {
            token: this.token,
            chatId: this.chatId,
            messageThreadId: this.messageThreadId
        };
        localStorage.setItem('telegramConfig', JSON.stringify(config));
        console.log("Saved config to localStorage");
    }
    
    saveConfig(token, chatId, messageThreadId) {
        this.token = token;
        this.chatId = chatId;
        this.messageThreadId = messageThreadId;
        localStorage.setItem('telegramConfig', JSON.stringify({
            token, chatId, messageThreadId
        }));
        console.log("Configuration saved successfully");
        return true;
    }
    
    async sendMessage(message, parseMode = 'Markdown') {
        // Validate configuration
        if (!this.token || this.token === "") {
            console.error("❌ No bot token configured");
            this.addToLog("❌ Bot token missing! Please configure in settings.", 'error');
            return { success: false, error: "Bot token missing" };
        }
        
        if (!this.chatId || this.chatId === "") {
            console.error("❌ No chat ID configured");
            this.addToLog("❌ Chat ID missing! Please configure in settings.", 'error');
            return { success: false, error: "Chat ID missing" };
        }
        
        console.log("Sending message to chat:", this.chatId);
        console.log("Message length:", message.length);
        
        try {
            const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
            const payload = {
                chat_id: this.chatId,
                text: message,
                parse_mode: parseMode
            };
            
            // Add message thread ID if provided
            if (this.messageThreadId && this.messageThreadId !== "") {
                payload.message_thread_id = parseInt(this.messageThreadId);
                console.log("Using message thread ID:", this.messageThreadId);
            }
            
            console.log("Sending to Telegram API...");
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            console.log("Telegram API response:", data);
            
            if (data.ok) {
                console.log("✅ Message sent successfully!");
                this.addToLog("✅ Message sent successfully to Telegram!", 'success');
                return { success: true, data };
            } else {
                throw new Error(data.description || "Unknown error");
            }
        } catch (error) {
            console.error("❌ Telegram send error:", error);
            this.addToLog(`❌ Failed to send: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }
    
    async sendMarketUpdate(marketData, newsItems, signals = null) {
        console.log("Formatting market update...");
        const message = this.formatMarketUpdate(marketData, newsItems, signals);
        console.log("Message formatted, sending...");
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
            second: '2-digit',
            timeZoneName: 'short' 
        })}`);
        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━━━━');
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
        
        lines.push('━━━━━━━━━━━━━━━━━━━━━');
        lines.push('');
        
        // News Section
        if (newsItems && newsItems.length > 0) {
            lines.push('📰 *TOP MARKET NEWS*');
            lines.push('');
            
            // Show top 5 news items
            const topNews = newsItems.slice(0, 5);
            topNews.forEach((item, index) => {
                const impactEmoji = item.impact === 'HIGH' ? '🔴' : item.impact === 'MEDIUM' ? '🟡' : '🟢';
                lines.push(`${index + 1}. ${impactEmoji} *${this.truncateText(item.title, 80)}*`);
                if (item.description && item.description !== "Click to read full article") {
                    lines.push(`   ${this.truncateText(item.description, 100)}`);
                }
                lines.push(`   📍 ${item.source} | ${new Date(item.pubDate).toLocaleTimeString()}`);
                lines.push('');
            });
        } else {
            lines.push('📰 *TOP MARKET NEWS*');
            lines.push('');
            lines.push('No recent news available at this moment.');
            lines.push('');
        }
        
        // Signals Section
        if (signals && signals.length > 0) {
            lines.push('━━━━━━━━━━━━━━━━━━━━━');
            lines.push('');
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
        lines.push('━━━━━━━━━━━━━━━━━━━━━');
        lines.push('');
        lines.push('🤖 *Automated by Market Bot*');
        lines.push('⚠️ *Disclaimer:* For informational purposes only.');
        lines.push('Always do your own research (DYOR).');
        lines.push('');
        lines.push('🔄 *Next update:* Scheduled for next interval');
        
        return lines.join('\n');
    }
    
    truncateText(text, maxLength) {
        if (!text) return "";
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    async testConnection() {
        console.log("Testing Telegram connection...");
        const testMessage = "🤖 *Market Bot Test*\n\nBot is online and configured correctly!\n\nTime: " + new Date().toLocaleString();
        return await this.sendMessage(testMessage);
    }
    
    addToLog(message, type = 'info') {
        const logContainer = document.getElementById('updateLog');
        if (logContainer) {
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            const time = new Date().toLocaleTimeString();
            const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
            logEntry.innerHTML = `
                <span class="log-time">[${time}]</span>
                <span class="log-${type}">${icon} ${message}</span>
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
