const Detail = {
    el: null,

    init() {
        this.el = document.getElementById('detail');
    },

    clear() {
        this.el.innerHTML = `<div class="empty-state"><p>${t('equipment_empty')}</p></div>`;
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
            <div class="detail-section"><h3>Information</h3><p style="font-size:13px; color:var(--text-secondary)">${t('detail_type_plant')}</p></div>`;
    },

    renderSection(s) {
        return `
            <div class="detail-header"><h2>\u{1F4C1} ${this.esc(s.name)}</h2></div>
            ${s.description ? `<p class="detail-description">${this.esc(s.description)}</p>` : ''}
            <div class="detail-section"><h3>Information</h3><p style="font-size:13px; color:var(--text-secondary)">${t('detail_type_section')}</p></div>`;
    },

    renderEquipment(e) {
        setTimeout(() => this.loadEquipmentDetails(e), 0);
        return `
            <div class="detail-header"><h2>\u2699\uFE0F ${this.esc(e.name)}</h2></div>
            ${e.description ? `<p class="detail-description">${this.esc(e.description)}</p>` : ''}
            <div id="detail-extra">Loading...</div>`;
    },

    renderComponent(c) {
        setTimeout(() => this.loadComponentDetails(c), 0);
        return `
            <div class="detail-header"><h2>\u{1F529} ${this.esc(c.name)}</h2></div>
            ${c.description ? `<p class="detail-description">${this.esc(c.description)}</p>` : ''}
            <div id="detail-extra">Loading...</div>`;
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
                <h3>${t('detail_documentation')} <button class="btn btn-sm" data-action="add-doc">+ Add</button></h3>
                <div class="item-list">
                    ${docs.length === 0 ? `<p style="font-size:13px;color:var(--text-secondary)">${t('detail_no_documentation')}</p>` : ''}
                    ${docs.map(d => `
                        <div class="item-card">
                            <a href="${this.esc(d.url)}" target="_blank" class="doc-link">\u{1F4C4} ${this.esc(d.name)}</a>
                            <button class="btn btn-sm btn-danger" data-action="del-doc" data-id="${d.id}">\u2715</button>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="detail-section">
                <h3>${t('detail_maintenance_tasks')} <button class="btn btn-sm" data-action="add-task">+ Add</button></h3>
                <div class="item-list">
                    ${tasks.length === 0 ? `<p style="font-size:13px;color:var(--text-secondary)">${t('detail_no_tasks')}</p>` : ''}
                    ${tasks.map(task => `
                        <div class="item-card">
                            <div>
                                <div class="item-name">${this.esc(task.title)}</div>
                                <div class="item-meta">${task.due_date} <span class="status status-${task.status}">${task.status}</span></div>
                            </div>
                            <div style="display:flex;gap:4px;">
                                ${task.status === 'planned' || task.status === 'overdue' ? `<button class="btn btn-sm" data-action="complete-task" data-id="${task.id}">\u2713</button>` : ''}
                                <button class="btn btn-sm btn-danger" data-action="del-task" data-id="${task.id}">\u2715</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="detail-section">
                <h3>${t('detail_maintenance_plans')} <button class="btn btn-sm" data-action="add-plan">+ Add</button></h3>
                <div class="item-list">
                    ${plans.length === 0 ? `<p style="font-size:13px;color:var(--text-secondary)">${t('detail_no_plans')}</p>` : ''}
                    ${plans.map(p => `
                        <div class="item-card">
                            <div>
                                <div class="item-name">${this.esc(p.title)}</div>
                                <div class="item-meta">${t('detail_every_days', { days: p.interval_days, date: p.next_due })}</div>
                            </div>
                            <div style="display:flex;gap:4px;">
                                <button class="btn btn-sm" data-action="complete-plan" data-id="${p.id}">${t('btn_complete')}</button>
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
                    Modal.show(t('modal_add_doc'), [
                        { name: 'name', label: t('field_name'), type: 'text', required: true },
                        { name: 'url', label: t('field_url'), type: 'url', required: true },
                    ], async (data) => { data[ownerKey] = ownerId; await API.createDoc(data); this.reloadDetails(ownerKey, ownerId); });
                } else if (action === 'del-doc') {
                    await API.deleteDoc(id); this.reloadDetails(ownerKey, ownerId);
                } else if (action === 'add-task') {
                    Modal.show(t('modal_new_task'), [
                        { name: 'title', label: t('field_title'), type: 'text', required: true },
                        { name: 'description', label: t('field_description'), type: 'textarea' },
                        { name: 'due_date', label: t('field_due_date'), type: 'date', required: true },
                    ], async (data) => { data[ownerKey] = ownerId; await API.createTask(data); this.reloadDetails(ownerKey, ownerId); });
                } else if (action === 'complete-task') {
                    await API.updateTask(id, { status: 'completed' }); this.reloadDetails(ownerKey, ownerId);
                } else if (action === 'del-task') {
                    await API.deleteTask(id); this.reloadDetails(ownerKey, ownerId);
                } else if (action === 'add-plan') {
                    Modal.show(t('modal_new_plan'), [
                        { name: 'title', label: t('field_title'), type: 'text', required: true },
                        { name: 'description', label: t('field_description'), type: 'textarea' },
                        { name: 'interval_days', label: t('field_interval'), type: 'number', required: true },
                        { name: 'next_due', label: t('field_first_due'), type: 'date', required: true },
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
