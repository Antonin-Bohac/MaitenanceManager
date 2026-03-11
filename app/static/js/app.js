document.addEventListener('DOMContentLoaded', () => {
    Modal.init();
    Tree.init();
    Detail.init();
    DetailPane.init();

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    const saved = localStorage.getItem('theme') || 'dark';
    applyTheme(saved);

    themeToggle.addEventListener('click', () => {
        const current = localStorage.getItem('theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('theme', next);
    });

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        themeToggle.title = theme === 'dark' ? t('theme_light') : t('theme_dark');
    }

    // Language toggle
    const langToggle = document.getElementById('lang-toggle');
    const langLabel = document.getElementById('lang-label');
    langLabel.textContent = I18n.currentLang.toUpperCase();

    langToggle.addEventListener('click', async () => {
        const next = I18n.currentLang === 'en' ? 'de' : 'en';
        I18n.setLang(next);
        langLabel.textContent = next.toUpperCase();
        applyStaticTranslations();
        await TranslationCache.loadAll(next);
        switchView(getCurrentView());
    });

    function applyStaticTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = t(el.dataset.i18nPlaceholder);
        });
    }

    function getCurrentView() {
        const active = document.querySelector('.nav-item.active');
        return active ? active.dataset.view : 'dashboard';
    }

    // Date in topbar
    const dateEl = document.getElementById('topbar-date');
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString(I18n.getDateLocale(), {
        weekday: 'long', month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Navigation
    const navItems = document.querySelectorAll('.nav-item[data-view]');
    const views = document.querySelectorAll('.view');

    function switchView(viewName) {
        navItems.forEach(n => n.classList.toggle('active', n.dataset.view === viewName));
        views.forEach(v => v.classList.toggle('active', v.id === 'view-' + viewName));

        if (viewName === 'dashboard') {
            Dashboard.load();
        } else if (viewName === 'equipment') {
            Tree.refresh();
        } else if (viewName === 'tasks') {
            Dashboard.load().then(() => Dashboard.applyFilters2());
        } else if (viewName === 'plans') {
            Dashboard.loadPlans();
        }
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view));
    });

    // Filter events - dashboard
    document.getElementById('filter-status').addEventListener('change', () => Dashboard.applyFilters());
    document.getElementById('filter-search').addEventListener('input', () => Dashboard.applyFilters());

    // Filter events - tasks view
    document.getElementById('filter-status-2').addEventListener('change', () => Dashboard.applyFilters2());
    document.getElementById('filter-search-2').addEventListener('input', () => Dashboard.applyFilters2());

    // New task buttons
    document.getElementById('btn-new-task').addEventListener('click', () => Dashboard.showNewTaskModal());
    document.getElementById('btn-new-task-2').addEventListener('click', () => Dashboard.showNewTaskModal());

    // New plan button
    document.getElementById('btn-new-plan').addEventListener('click', () => Dashboard.showNewPlanModal());

    // Add factory button
    document.getElementById('add-factory-btn').addEventListener('click', () => {
        Modal.show(t('btn_new_plant'), [
            { name: 'name', label: t('field_name'), type: 'text', required: true },
            { name: 'description', label: t('field_description'), type: 'textarea' },
        ], async (data) => {
            await API.createFactory(data);
            Tree.refresh();
        });
    });

    // Mobile sidebar toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');

    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarBackdrop.classList.remove('active');
    }

    mobileMenuBtn.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('open');
        sidebarBackdrop.classList.toggle('active', isOpen);
    });

    sidebarBackdrop.addEventListener('click', closeSidebar);

    // Close sidebar when navigating on mobile
    navItems.forEach(item => {
        item.addEventListener('click', closeSidebar);
    });

    // Initial load
    TranslationCache.loadAll(I18n.currentLang).then(() => {
        applyStaticTranslations();
        switchView('dashboard');
    });
});
