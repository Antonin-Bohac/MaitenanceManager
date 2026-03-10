const Detail = {
    el: null,

    init() {
        this.el = document.getElementById('detail');
    },

    clear() {
        this.el.innerHTML = '<div class="empty-state"><p>Vyberte položku z navigace.</p></div>';
    },

    async show(type, id) {
        const fetchers = {
            factory: () => API.getFactory(id),
            section: () => API.getSection(id),
            equipment: () => API.getEquipment(id),
            component: () => API.getComponent(id),
        };
        const item = await fetchers[type]();
        const renderers = {
            factory: () => this.renderFactory(item),
            section: () => this.renderSection(item),
            equipment: () => this.renderEquipment(item),
            component: () => this.renderComponent(item),
        };
        this.el.innerHTML = renderers[type]();
        this.bindEvents(type, item);
    },

    renderFactory(f) {
        return `
            <div class="detail-header"><h2>\u{1F3ED} ${this.esc(f.name)}</h2></div>
            ${f.description ? `<p class="detail-description">${this.esc(f.description)}</p>` : ''}
            <div class="detail-section"><h3>Informace</h3><p style="font-size:13px; color:var(--text-secondary)">Typ: Továrna</p></div>`;
    },

    renderSection(s) {
        return `
            <div class="detail-header"><h2>\u{1F4C1} ${this.esc(s.name)}</h2></div>
            ${s.description ? `<p class="detail-description">${this.esc(s.description)}</p>` : ''}
            <div class="detail-section"><h3>Informace</h3><p style="font-size:13px; color:var(--text-secondary)">Typ: Sekce</p></div>`;
    },

    renderEquipment(e) {
        setTimeout(() => this.loadEquipmentDetails(e), 0);
        return `
            <div class="detail-header"><h2>\u2699\uFE0F ${this.esc(e.name)}</h2></div>
            ${e.description ? `<p class="detail-description">${this.esc(e.description)}</p>` : ''}
            <div id="detail-extra">Načítám...</div>`;
    },

    renderComponent(c) {
        setTimeout(() => this.loadComponentDetails(c), 0);
        return `
            <div class="detail-header"><h2>\u{1F529} ${this.esc(c.name)}</h2></div>
            ${c.description ? `<p class="detail-description">${this.esc(c.description)}</p>` : ''}
            <div id="detail-extra">Načítám...</div>`;
    },

    async loadEquipmentDetails(e) {
        const [docs, tasks, plans] = await Promise.all([
            API.getDocs({ equipment_id: e.id }),
            API.getTasks({ equipment_id: e.id }),
            API.getPlans({ equipment_id: e.id }),
        ]);
        const el = document.getElementById('detail-extra');
        if (!el) return;
        el.innerHTML = this.renderDetailsBlock(docs, tasks, plans, 'equipment_id', e.id);
        this.bindDetailEvents('equipment_id', e.id);
    },

    async loadComponentDetails(c) {
        const [docs, tasks, plans] = await Promise.all([
            API.getDocs({ component_id: c.id }),
            API.getTasks({ component_id: c.id }),
            API.getPlans({ component_id: c.id }),
        ]);
        const el = document.getElementById('detail-extra');
        if (!el) return;
        el.innerHTML = this.renderDetailsBlock(docs, tasks, plans, 'component_id', c.id);
        this.bindDetailEvents('component_id', c.id);
    },

    renderDetailsBlock(docs, tasks, plans, ownerKey, ownerId) {
        return `
            <div class="detail-section">
                <h3>Dokumentace <button class="btn btn-sm" data-action="add-doc">+ Přidat</button></h3>
                <div class="item-list">
                    ${docs.length === 0 ? '<p style="font-size:13px;color:var(--text-secondary)">Žádná dokumentace</p>' : ''}
                    ${docs.map(d => `
                        <div class="item-card">
                            <a href="${this.esc(d.url)}" target="_blank" class="doc-link">\u{1F4C4} ${this.esc(d.name)}</a>
                            <button class="btn btn-sm btn-danger" data-action="del-doc" data-id="${d.id}">\u2715</button>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="detail-section">
                <h3>Údržba - úkoly <button class="btn btn-sm" data-action="add-task">+ Přidat</button></h3>
                <div class="item-list">
                    ${tasks.length === 0 ? '<p style="font-size:13px;color:var(--text-secondary)">Žádné úkoly</p>' : ''}
                    ${tasks.map(t => `
                        <div class="item-card">
                            <div>
                                <div class="item-name">${this.esc(t.title)}</div>
                                <div class="item-meta">${t.due_date} <span class="status status-${t.status}">${t.status}</span></div>
                            </div>
                            <div style="display:flex;gap:4px;">
                                ${t.status === 'planned' || t.status === 'overdue' ? `<button class="btn btn-sm" data-action="complete-task" data-id="${t.id}">\u2713</button>` : ''}
                                <button class="btn btn-sm btn-danger" data-action="del-task" data-id="${t.id}">\u2715</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="detail-section">
                <h3>Údržba - plány <button class="btn btn-sm" data-action="add-plan">+ Přidat</button></h3>
                <div class="item-list">
                    ${plans.length === 0 ? '<p style="font-size:13px;color:var(--text-secondary)">Žádné plány</p>' : ''}
                    ${plans.map(p => `
                        <div class="item-card">
                            <div>
                                <div class="item-name">${this.esc(p.title)}</div>
                                <div class="item-meta">Každých ${p.interval_days} dní | Další: ${p.next_due}</div>
                            </div>
                            <div style="display:flex;gap:4px;">
                                <button class="btn btn-sm" data-action="complete-plan" data-id="${p.id}">\u2713 Hotovo</button>
                                <button class="btn btn-sm btn-danger" data-action="del-plan" data-id="${p.id}">\u2715</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    },

    bindEvents(type, item) {},

    bindDetailEvents(ownerKey, ownerId) {
        const extra = document.getElementById('detail-extra');
        if (!extra) return;
        extra.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;
                if (action === 'add-doc') {
                    Modal.show('Přidat dokumentaci', [
                        { name: 'name', label: 'Název', type: 'text', required: true },
                        { name: 'url', label: 'URL', type: 'url', required: true },
                    ], async (data) => { data[ownerKey] = ownerId; await API.createDoc(data); this.reloadDetails(ownerKey, ownerId); });
                } else if (action === 'del-doc') {
                    await API.deleteDoc(id); this.reloadDetails(ownerKey, ownerId);
                } else if (action === 'add-task') {
                    Modal.show('Nový úkol údržby', [
                        { name: 'title', label: 'Název', type: 'text', required: true },
                        { name: 'description', label: 'Popis', type: 'textarea' },
                        { name: 'due_date', label: 'Termín', type: 'date', required: true },
                    ], async (data) => { data[ownerKey] = ownerId; await API.createTask(data); this.reloadDetails(ownerKey, ownerId); });
                } else if (action === 'complete-task') {
                    await API.updateTask(id, { status: 'completed' }); this.reloadDetails(ownerKey, ownerId);
                } else if (action === 'del-task') {
                    await API.deleteTask(id); this.reloadDetails(ownerKey, ownerId);
                } else if (action === 'add-plan') {
                    Modal.show('Nový plán údržby', [
                        { name: 'title', label: 'Název', type: 'text', required: true },
                        { name: 'description', label: 'Popis', type: 'textarea' },
                        { name: 'interval_days', label: 'Interval (dny)', type: 'number', required: true },
                        { name: 'next_due', label: 'První termín', type: 'date', required: true },
                    ], async (data) => { data[ownerKey] = ownerId; await API.createPlan(data); this.reloadDetails(ownerKey, ownerId); });
                } else if (action === 'complete-plan') {
                    await API.completePlan(id); this.reloadDetails(ownerKey, ownerId);
                } else if (action === 'del-plan') {
                    await API.deletePlan(id); this.reloadDetails(ownerKey, ownerId);
                }
            });
        });
    },

    reloadDetails(ownerKey, ownerId) {
        if (ownerKey === 'equipment_id') {
            this.loadEquipmentDetails({ id: ownerId });
        } else {
            this.loadComponentDetails({ id: ownerId });
        }
    },

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};
