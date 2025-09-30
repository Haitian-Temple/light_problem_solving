// 系統設定
const CONFIG = {
    // Google Sheets 設定
    SPREADSHEET_ID_LIGHTS: '1-dokVbrsfkUBOMF-GvmMRYPdsyq-EozStwQOFQvtTIE',
    SPREADSHEET_ID_MEETING: '1tTtzy1pSBF9W8x2GD_bpAffZffrOdA9OUsOTaoMKCu4',
    
    // 狀態常數
    CLIENT_STATUS: {
        PENDING: '審核中',
        WAITING: '等待中',
        ENTERING: '進入中',
        SERVING: '服務中',
        COMPLETED: '結束',
        REJECTED: '未通過'
    },
    
    LIGHT_TYPES: {
        BRIGHT: '光明燈',
        WEALTH: '財神燈',
        TAISUI: '太歲燈'
    },
    
    // API 端點 (需要設定 Google Apps Script 作為 Web API)
    API_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
    
    // 快取設定
    CACHE_DURATION: 5 * 60 * 1000, // 5分鐘
};

// 全域變數
let currentClient = null;
let refreshInterval = null;
let isLargeText = false;

// 初始化函數
function initializeApp() {
    loadConfigFromStorage();
    setupEventListeners();
    checkMobileBrowser();
}

// 載入本地設定
function loadConfigFromStorage() {
    isLargeText = localStorage.getItem('largeText') === 'true';
    if (isLargeText) {
        document.body.classList.add('large-text');
    }
}

// 行動瀏覽器檢測
function checkMobileBrowser() {
    const isLine = /Line/i.test(navigator.userAgent);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isLine) {
        document.body.classList.add('line-browser');
    }
    if (isMobile) {
        document.body.classList.add('mobile-browser');
    }
}

// 防抖函數 - 性能優化
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 快取管理
const cacheManager = {
    get: (key) => {
        try {
            const item = localStorage.getItem(`cache_${key}`);
            if (item) {
                const { value, expiry } = JSON.parse(item);
                if (Date.now() < expiry) {
                    return value;
                }
            }
        } catch (e) {
            console.warn('Cache read error:', e);
        }
        return null;
    },
    
    set: (key, value, duration = CONFIG.CACHE_DURATION) => {
        try {
            const item = {
                value: value,
                expiry: Date.now() + duration
            };
            localStorage.setItem(`cache_${key}`, JSON.stringify(item));
        } catch (e) {
            console.warn('Cache write error:', e);
        }
    },
    
    remove: (key) => {
        try {
            localStorage.removeItem(`cache_${key}`);
        } catch (e) {
            console.warn('Cache remove error:', e);
        }
    },
    
    clear: () => {
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('cache_')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.warn('Cache clear error:', e);
        }
    }
};
