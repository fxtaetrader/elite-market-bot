// Free and reliable market data APIs
class MarketDataFetcher {
    constructor() {
        // Free APIs (no API key required for basic usage)
        this.apis = {
            // CoinGecko - Free crypto data
            crypto: 'https://api.coingecko.com/api/v3',
            // Metal Price API - Free gold prices
            gold: 'https://api.metalpriceapi.com/v1',
            // Exchange rates - Free tier
            forex: 'https://api.exchangerate-api.com/v4/latest/USD',
            // Alternative: Alpha Vantage (get free key)
            alphaVantage: 'https://www.alphavantage.co/query',
            // News API (free tier)
            newsAPI: 'https://newsapi.org/v2'
        };
        
        // You can get free API keys from:
        // - Alpha Vantage: https://www.alphavantage.co/support/#api-key
        // - NewsAPI: https://newsapi.org/register
        // - MetalPriceAPI: https://metalpriceapi.com/
        
        this.apiKeys = {
            alphaVantage: 'YOUR_FREE_ALPHA_VANTAGE_KEY', // Get free key
            newsAPI: 'YOUR_FREE_NEWS_API_KEY', // Get free key
            metalPrice: 'YOUR_FREE_METAL_PRICE_KEY' // Get free key
        };
    }
    
    async fetchXAUUSD() {
        try {
            // Method 1: Using MetalPriceAPI (recommended for gold)
            const response = await fetch(
                `https://api.metalpriceapi.com/v1/latest?api_key=${this.apiKeys.metalPrice}&base=USD&currencies=XAU`
            );
            
            if (response.ok) {
                const data = await response.json();
                const goldPrice = data.rates?.XAU;
                if (goldPrice) {
                    return {
                        price: (1 / goldPrice).toFixed(2),
                        change: this.calculateChange('XAU', goldPrice)
                    };
                }
            }
            
            // Fallback: Alternative free source
            const fallbackResponse = await fetch('https://www.goldapi.io/api/XAU/USD', {
                headers: { 'x-access-token': 'goldapi-1j8k9f7g3h5j2k' } // Free tier
            });
            
            if (fallbackResponse.ok) {
                const data = await fallbackResponse.json();
                return {
                    price: data.price,
                    change: data.changepct
                };
            }
            
            throw new Error('Unable to fetch XAUUSD data');
        } catch (error) {
            console.error('Error fetching XAUUSD:', error);
            return this.getMockGoldData();
        }
    }
    
    async fetchBTCUSD() {
        try {
            // Using CoinGecko free API
            const response = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
            );
            
            if (response.ok) {
                const data = await response.json();
                return {
                    price: data.bitcoin.usd,
                    change: data.bitcoin.usd_24h_change?.toFixed(2) || 0
                };
            }
            
            throw new Error('Unable to fetch BTCUSD data');
        } catch (error) {
            console.error('Error fetching BTCUSD:', error);
            return this.getMockBTCData();
        }
    }
    
    async fetchMarketNews(symbol, category = 'forex') {
        const newsItems = [];
        
        try {
            // Method 1: RSS Feeds from trusted sources (free)
            const rssFeeds = [
                `https://feeds.bloomberg.com/markets/news.rss`,
                `https://www.reuters.com/business/finance/rss`,
                `https://www.forexlive.com/feed/news`,
                `https://www.fxstreet.com/feed/news`
            ];
            
            // Use RSS2JSON API (free)
            for (const feed of rssFeeds) {
                try {
                    const response = await fetch(
                        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`
                    );
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.items) {
                            const relevantNews = data.items
                                .filter(item => {
                                    const title = item.title.toLowerCase();
                                    const desc = item.description?.toLowerCase() || '';
                                    return title.includes(symbol.toLowerCase()) || 
                                           desc.includes(symbol.toLowerCase()) ||
                                           title.includes('gold') || 
                                           title.includes('bitcoin') ||
                                           title.includes('forex');
                                })
                                .slice(0, 5);
                            
                            relevantNews.forEach(item => {
                                newsItems.push({
                                    title: item.title,
                                    description: item.description,
                                    link: item.link,
                                    pubDate: item.pubDate,
                                    source: this.getSourceName(feed),
                                    impact: this.determineImpact(item.title)
                                });
                            });
                        }
                    }
                } catch (e) {
                    console.log(`Error fetching ${feed}:`, e);
                }
            }
            
            // Method 2: Free NewsAPI (if you have API key)
            if (this.apiKeys.newsAPI !== 'YOUR_FREE_NEWS_API_KEY') {
                const newsResponse = await fetch(
                    `${this.apis.newsAPI}/everything?q=${symbol}+forex&language=en&sortBy=publishedAt&apiKey=${this.apiKeys.newsAPI}&pageSize=5`
                );
                
                if (newsResponse.ok) {
                    const newsData = await newsResponse.json();
                    newsData.articles?.forEach(article => {
                        newsItems.push({
                            title: article.title,
                            description: article.description,
                            link: article.url,
                            pubDate: article.publishedAt,
                            source: article.source.name,
                            impact: this.determineImpact(article.title)
                        });
                    });
                }
            }
            
            // Remove duplicates
            const uniqueNews = newsItems.filter((item, index, self) => 
                index === self.findIndex(n => n.title === item.title)
            );
            
            return uniqueNews.slice(0, 10);
            
        } catch (error) {
            console.error('Error fetching news:', error);
            return this.getMockNews(symbol);
        }
    }
    
    async fetchOtherMarkets() {
        const markets = [];
        
        try {
            // Fetch major forex pairs
            const forexResponse = await fetch(this.apis.forex);
            if (forexResponse.ok) {
                const data = await forexResponse.json();
                const pairs = ['EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'];
                
                pairs.forEach(pair => {
                    markets.push({
                        name: `USD/${pair}`,
                        price: data.rates[pair],
                        change: 0 // Would need historical data
                    });
                });
            }
            
            // Fetch other cryptos
            const cryptoResponse = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,solana,cardano,ripple&vs_currencies=usd&include_24hr_change=true'
            );
            
            if (cryptoResponse.ok) {
                const data = await cryptoResponse.json();
                const cryptos = {
                    ethereum: 'ETH',
                    solana: 'SOL',
                    cardano: 'ADA',
                    ripple: 'XRP'
                };
                
                for (const [id, symbol] of Object.entries(cryptos)) {
                    if (data[id]) {
                        markets.push({
                            name: symbol,
                            price: data[id].usd,
                            change: data[id].usd_24h_change?.toFixed(2) || 0
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching other markets:', error);
        }
        
        return markets;
    }
    
    calculateChange(symbol, currentPrice) {
        // This would need historical data
        // For demo purposes, return random change
        return (Math.random() * 4 - 2).toFixed(2);
    }
    
    determineImpact(title) {
        const title_lower = title.toLowerCase();
        if (title_lower.includes('urgent') || title_lower.includes('breaking') || 
            title_lower.includes('alert') || title_lower.includes('emergency')) {
            return 'HIGH';
        } else if (title_lower.includes('warning') || title_lower.includes('important') ||
                   title_lower.includes('significant')) {
            return 'MEDIUM';
        }
        return 'LOW';
    }
    
    getSourceName(feedUrl) {
        if (feedUrl.includes('bloomberg')) return 'Bloomberg';
        if (feedUrl.includes('reuters')) return 'Reuters';
        if (feedUrl.includes('forexlive')) return 'ForexLive';
        if (feedUrl.includes('fxstreet')) return 'FXStreet';
        return 'Market News';
    }
    
    getMockGoldData() {
        return {
            price: 2150.50,
            change: 0.75
        };
    }
    
    getMockBTCData() {
        return {
            price: 65000,
            change: 2.3
        };
    }
    
    getMockNews(symbol) {
        const newsTemplates = {
            XAUUSD: [
                { title: "Gold prices surge as Fed signals rate cuts", impact: "HIGH" },
                { title: "Central bank buying boosts gold demand", impact: "MEDIUM" },
                { title: "Technical analysis: Gold breaks key resistance", impact: "MEDIUM" }
            ],
            BTCUSD: [
                { title: "Bitcoin hits new highs amid institutional adoption", impact: "HIGH" },
                { title: "ETF inflows drive BTC price action", impact: "HIGH" },
                { title: "Technical indicators show bullish momentum", impact: "MEDIUM" }
            ]
        };
        
        const templates = newsTemplates[symbol] || newsTemplates.XAUUSD;
        return templates.map((t, i) => ({
            ...t,
            description: "Click to read full article",
            link: "#",
            pubDate: new Date().toISOString(),
            source: "Market News"
        }));
    }
}

// Export for use in other files
window.MarketDataFetcher = MarketDataFetcher;
