document.addEventListener('DOMContentLoaded', () => {
    Modal.init();
    Tree.init();
    Detail.init();

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
        themeToggle.title = theme === 'dark' ? 'Light theme' : 'Dark theme';
    }

    // Date in topbar
    const dateEl = document.getElementById('topbar-date');
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-US', {
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
        Modal.show('New Plant', [
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'description', label: 'Description', type: 'textarea' },
        ], async (data) => {
            await API.createFactory(data);
            Tree.refresh();
        });
    });

    // Initial load
    switchView('dashboard');
});
