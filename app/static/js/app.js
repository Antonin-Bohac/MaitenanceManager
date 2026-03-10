document.addEventListener('DOMContentLoaded', () => {
    Modal.init();
    Tree.init();
    Detail.init();

    const themeToggle = document.getElementById('theme-toggle');
    const saved = localStorage.getItem('theme') || 'auto';
    applyTheme(saved);

    themeToggle.addEventListener('click', () => {
        const current = localStorage.getItem('theme') || 'auto';
        const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
        applyTheme(next);
        localStorage.setItem('theme', next);
    });

    function applyTheme(theme) {
        if (theme === 'auto') {
            delete document.documentElement.dataset.theme;
        } else {
            document.documentElement.dataset.theme = theme;
        }
        const icons = { auto: '\u25D0', light: '\u2600', dark: '\u263E' };
        themeToggle.textContent = icons[theme] || '\u25D0';
    }

    document.getElementById('add-factory-btn').addEventListener('click', () => {
        Modal.show('Nová továrna', [
            { name: 'name', label: 'Název', type: 'text', required: true },
            { name: 'description', label: 'Popis', type: 'textarea' },
        ], async (data) => {
            await API.createFactory(data);
            Tree.refresh();
        });
    });

    Tree.refresh();
});
