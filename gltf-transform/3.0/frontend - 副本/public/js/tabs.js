const TabManager = {
    tabs: {},
    activeTab: 'compress',

    register(id, config) {
        this.tabs[id] = config;
    },

    init() {
        const nav = document.getElementById('tabNav');
        const buttons = nav.querySelectorAll('.tab-btn');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => this.switchTo(btn.dataset.tab));
        });

        Object.entries(this.tabs).forEach(([id, config]) => {
            if (config.onInit) config.onInit();
        });
    },

    switchTo(tabId) {
        if (!this.tabs[tabId] || tabId === this.activeTab) return;

        const prev = this.tabs[this.activeTab];
        if (prev && prev.onLeave) prev.onLeave();

        this.activeTab = tabId;
        const config = this.tabs[tabId];

        document.querySelectorAll('.tab-btn').forEach(btn => {
            const isActive = btn.dataset.tab === tabId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
        });

        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `panel-${tabId}`);
        });

        const sidebar = document.getElementById('sidebar');
        if (config.showSidebar) {
            sidebar.classList.remove('hidden');
        } else {
            sidebar.classList.add('hidden');
        }

        if (config.onEnter) config.onEnter();
    }
};

// 由最后一个模块脚本调用 TabManager.init()
