// Google Sheets API 服務
class SheetsService {
    constructor() {
        this.baseUrl = CONFIG.API_URL;
    }

    async callFunction(functionName, params = {}) {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    function: functionName,
                    parameters: params
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    // 客戶管理功能
    async submitApplication(clientData) {
        return await this.callFunction('submitApplication', clientData);
    }

    async getWaitingList(clientName) {
        return await this.callFunction('getWaitingList', { clientName });
    }

    async getAllClients() {
        return await this.callFunction('getAllClients');
    }

    async getPendingClients() {
        return await this.callFunction('getPendingClients');
    }

    // 管理功能
    async getAdminClientsList(password) {
        return await this.callFunction('getAdminClientsList', { password });
    }

    async updateClientStatus(row, newStatus, password) {
        return await this.callFunction('updateClientStatus', { row, newStatus, password });
    }

    async getMeetingSettings() {
        return await this.callFunction('getMeetingSettings');
    }

    async updateSettings(settings) {
        return await this.callFunction('updateSettings', settings);
    }

    // 尋燈系統功能
    async getAllData(sheetName) {
        return await this.callFunction('getAllData', { sheetName });
    }

    async exportToSheet(sheetName, markedData) {
        return await this.callFunction('exportToSheet', { sheetName, markedData });
    }

    // 系統功能
    async initializeSystem() {
        return await this.callFunction('initializeSystem');
    }

    async testSystem() {
        return await this.callFunction('testSystem');
    }

    async repairClientData() {
        return await this.callFunction('repairClientData');
    }

    async addTestClient() {
        return await this.callFunction('addTestClient');
    }

    async getTaiwanDate() {
        return await this.callFunction('getTaiwanDate');
    }
}

// 全域服務實例
const sheetsService = new SheetsService();

// 客戶端應用邏輯
class ClientApp {
    constructor() {
        this.currentClient = null;
        this.refreshInterval = null;
    }

    async loadSettings() {
        try {
            showLoading('載入系統設定中...');
            const settings = await sheetsService.getMeetingSettings();
            
            const lightDisplay = document.getElementById('light-type-display');
            if (lightDisplay) {
                const lightType = settings.TODAY_LIGHT || '光明燈';
                lightDisplay.innerHTML = `
                    <i class="fas fa-lightbulb"></i> ${lightType}
                    <div style="font-size: 1rem; color: #666; margin-top: 6px;">
                        今日指定燈種，無需選擇
                    </div>
                `;
            }
            
            hideLoading();
            return settings;
        } catch (error) {
            console.error('載入設定失敗:', error);
            hideLoading();
            showAlert('系統設定載入失敗，使用預設燈種', 'warning');
            return this.getDefaultSettings();
        }
    }

    getDefaultSettings() {
        return {
            TODAY_LIGHT: '光明燈',
            LINE_MEETING_LINK: '',
            MAX_WAITING_CLIENTS: '10'
        };
    }

    async submitApplication(clientData) {
        try {
            showLoading('提交申請中...');
            const result = await sheetsService.submitApplication(clientData);
            
            if (result.error) {
                showAlert(result.error, 'danger');
            } else {
                this.currentClient = { name: clientData.name, ...result };
                this.showApplicationResult(result);
                this.startStatusRefresh();
            }
        } catch (error) {
            console.error('提交失敗:', error);
            showAlert('提交失敗: ' + error.message, 'danger');
        } finally {
            hideLoading();
        }
    }

    async checkStatus(clientName) {
        if (!clientName) {
            showAlert('請先填寫姓名以查詢狀態', 'danger');
            return;
        }

        this.currentClient = { name: clientName };
        localStorage.setItem('clientName', clientName);
        this.startStatusRefresh();
    }

    startStatusRefresh() {
        this.loadWaitingQueue();
        if (!this.hasMeetingEnded) {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            
            const refreshRate = this.getRefreshRate();
            this.refreshInterval = setInterval(() => {
                this.loadWaitingQueue();
            }, refreshRate);
        }
    }

    stopStatusRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    getRefreshRate() {
        if (!this.currentClient) return 10000;
        
        if (this.currentClient.status === '審核中') {
            return 15000;
        }
        
        if (['等待中', '進入中', '服務中'].includes(this.currentClient.status)) {
            return 5000;
        }
        
        return 10000;
    }

    async loadWaitingQueue() {
        if (!this.currentClient || !this.currentClient.name) return;

        try {
            const data = await sheetsService.getWaitingList(this.currentClient.name);
            this.displayQueue(data);
            
            if (data.client) {
                this.updateClientStatusFromQueue(data.client, data.list);
                this.currentClient.status = data.client.status;
                this.adjustRefreshRate();
            } else {
                document.getElementById('application-form').style.display = 'block';
                document.getElementById('waiting-area').style.display = 'none';
                showAlert('找不到您的報名資料，請重新報名', 'warning');
                this.stopStatusRefresh();
            }
        } catch (error) {
            console.error('載入隊列失敗:', error);
            this.displayQueue({ list: [] });
            showAlert('載入等待名單失敗，請稍後再試', 'danger');
        }
    }

    displayQueue(data) {
        const queueListContent = document.getElementById('queue-list-content');
        const list = data.list || [];
        const queueListContainer = document.getElementById('queue-list-container');
        
        if (list.length > 0) {
            queueListContainer.style.display = 'block';
            
            let html = '';
            list.forEach(item => {
                const statusClass = this.getStatusClass(item.status);
                const isCurrentUser = this.currentClient && 
                    item.name && this.currentClient.name && 
                    this.maskName(this.currentClient.name) === item.name;
                
                const itemClass = isCurrentUser ? 'queue-item current-user' : 'queue-item';
                
                html += `
                    <div class="${itemClass} fade-in">
                        <div>
                            <strong>${item.queue_num || ''}號</strong> - ${item.display_name || '未知'}
                            ${isCurrentUser ? '<span style="color: var(--warning-color); margin-left: 8px; font-weight: 600;">(您)</span>' : ''}
                        </div>
                        <div class="status-badge ${statusClass}">${item.status || '未知'}</div>
                    </div>
                `;
            });
            
            queueListContent.innerHTML = html;
        } else {
            queueListContainer.style.display = 'none';
            queueListContent.innerHTML = '<p style="text-align: center; padding: 20px; font-size: 1.1rem;">目前沒有等待中的客戶</p>';
        }
    }

    maskName(name) {
        if (!name || name.length <= 2) return name;
        const firstChar = name.charAt(0);
        const lastChar = name.charAt(name.length - 1);
        const middle = '○'.repeat(name.length - 2);
        return firstChar + middle + lastChar;
    }

    getStatusClass(status) {
        switch(status) {
            case '審核中': return 'status-pending';
            case '等待中': return 'status-waiting';
            case '進入中': return 'status-active';
            case '服務中': return 'status-serving';
            case '結束': return 'status-completed';
            case '未通過': return 'status-pending';
            default: return 'status-pending';
        }
    }
}

// 初始化全域應用
const clientApp = new ClientApp();

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    
    // 根據當前頁面初始化對應的應用
    if (document.getElementById('application-form')) {
        // 客戶端頁面
        clientApp.loadSettings();
        
        // 從本地儲存恢復姓名
        const storedName = localStorage.getItem('clientName');
        if (storedName && document.getElementById('client-name')) {
            document.getElementById('client-name').value = storedName;
        }
    }
});
