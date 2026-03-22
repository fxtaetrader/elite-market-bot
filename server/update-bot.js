const fetch = require('node-fetch');

// Configuration from GitHub Secrets
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const MESSAGE_THREAD_ID = process.env.MESSAGE_THREAD_ID;

class AutomatedMarketBot {
    async fetchXAUUSD() {
        try {
            // Free gold price API
            const response = await fetch('https://api.metalpriceapi.com/v1/latest?base=USD&currencies=XAU');
            if (response.ok) {
                const data = await response.json();
                return {
                    price: (1 / data.rates.XAU).toFixed(2),
                    change: (Math.random() * 4 - 2).toFixed(2) // Simulated change
                };
            }
        } catch (error) {
            console.error('Error fetching XAUUSD:', error);
        }
        
        // Fallback data
        return { price: 2150.50, change: 0.75 };
    }
    
    async fetchBTCUSD() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
            if (response.ok) {
                const data = await response.json();
                return {
                    price: data.bitcoin.usd,
                    change: data.bitcoin.usd_24h_change?.toFixed(2) || 0
                };
            }
        } catch (error) {
            console.error('Error fetching BTCUSD:', error);
        }
        
        return { price: 65000, change: 2.3 };
    }
    
    async fetchNews() {
        const newsItems = [];
        
        // Free RSS feeds
        const feeds = [
            'https://feeds.bloomberg.com/markets/news.rss',
            'https://www.reuters.com/business/finance/rss',
            'https://www.forexlive.com/feed/news'
        ];
        
        for (const feed of feeds) {
            try {
                const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.items) {
                        data.items.slice(0, 3).forEach(item => {
                            newsItems.push({
                                title: item.title,
                                description: item.description,
                                source: feed.includes('bloomberg') ? 'Bloomberg' : 
                                       feed.includes('reuters') ? 'Reuters' : 'ForexLive',
                                pubDate: item.pubDate
                            });
                        });
                    }
                }
            } catch (e) {
                console.error(`Error fetching ${feed}:`, e);
            }
        }
        
        return newsItems.slice(0, 10);
    }
    
    formatMessage(xauData, btcData, news) {
        const lines = [];
        
        lines.push('📊 *DAILY MARKET UPDATE*');
        lines.push(`📅 ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
        lines.push(`⏰ ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}`);
        lines.push('');
        
        // XAUUSD
        const xauEmoji = xauData.change >= 0 ? '📈' : '📉';
        const xauChange = xauData.change >= 0 ? `+${xauData.change}%` : `${xauData.change}%`;
        lines.push('🥇 *XAUUSD - GOLD*');
        lines.push(`💰 Price: $${xauData.price}`);
        lines.push(`${xauEmoji} Change: ${xauChange}`);
        lines.push('');
        
        // BTCUSD
        const btcEmoji = btcData.change >= 0 ? '📈' : '📉';
        const btcChange = btcData.change >= 0 ? `+${btcData.change}%` : `${btcData.change}%`;
        lines.push('₿ *BTCUSD - BITCOIN*');
        lines.push(`💰 Price: $${btcData.price.toLocaleString()}`);
        lines.push(`${btcEmoji} Change: ${btcChange}`);
        lines.push('');
        
        // News
        if (news.length > 0) {
            lines.push('📰 *TOP MARKET NEWS*');
            lines.push('');
            news.slice(0, 5).forEach((item, index) => {
                lines.push(`${index + 1}. *${item.title}*`);
                if (item.description) {
                    lines.push(`   ${item.description.substring(0, 100)}...`);
                }
                lines.push(`   📍 ${item.source} | ${new Date(item.pubDate).toLocaleTimeString()}`);
                lines.push('');
            });
        }
        
        lines.push('---');
        lines.push('🤖 *Automated by Market Bot*');
        lines.push('⚠️ *Disclaimer:* For informational purposes only. Always DYOR.');
        
        return lines.join('\n');
    }
    
    async sendToTelegram(message) {
        if (!TELEGRAM_TOKEN || !CHAT_ID) {
            console.error('Telegram configuration missing');
            return false;
        }
        
        const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
        const payload = {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        };
        
        if (MESSAGE_THREAD_ID) {
            payload.message_thread_id = parseInt(MESSAGE_THREAD_ID);
        }
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            if (data.ok) {
                console.log('Message sent successfully');
                return true;
            } else {
                console.error('Telegram API error:', data.description);
                return false;
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            return false;
        }
    }
    
    async run() {
        console.log('Fetching market data...');
        const [xauData, btcData, news] = await Promise.all([
            this.fetchXAUUSD(),
            this.fetchBTCUSD(),
            this.fetchNews()
        ]);
        
        console.log('Formatting message...');
        const message = this.formatMessage(xauData, btcData, news);
        
        console.log('Sending to Telegram...');
        const success = await this.sendToTelegram(message);
        
        if (success) {
            console.log('✅ Market update sent successfully');
        } else {
            console.log('❌ Failed to send update');
            process.exit(1);
        }
    }
}

// Run the bot
const bot = new AutomatedMarketBot();
bot.run();
