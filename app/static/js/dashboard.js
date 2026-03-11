const Dashboard = {
    data: null,
    filteredTasks: [],

    async load() {
        try {
            this.data = await API.get('/api/maintenance/dashboard');
            this.renderStats();
            this.filteredTasks = this.data.tasks;
            this.applyFilters();
        } catch (e) {
            console.error('Dashboard load error:', e);
        }
    },

    renderStats() {
        if (!this.data) return;
        const s = this.data.stats;
        document.getElementById('stat-total').textContent = s.total_tasks;
        document.getElementById('stat-overdue').textContent = s.overdue;
        document.getElementById('stat-planned').textContent = s.planned;
        document.getElementById('stat-completed').textContent = s.completed;
        document.getElementById('stat-equipment').textContent = s.total_equipment;
        document.getElementById('stat-plans').textContent = s.total_plans;
    },

    applyFilters(statusFilter, searchFilter) {
        if (!this.data) return;
        const status = statusFilter || document.getElementById('filter-status').value;
        const search = (searchFilter || document.getElementById('filter-search').value).toLowerCase();

        this.filteredTasks = this.data.tasks.filter(t => {
            if (status && t.status !== status) return false;
            if (search) {
                const haystack = [t.title, t.equipment_name, t.component_name, t.section_name, t.factory_name]
                    .join(' ').toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            return true;
        });

        this.renderTable('task-tbody', this.filteredTasks);
        document.getElementById('result-count').textContent =
            this.filteredTasks.length + ' ' + t('records_of') + ' ' + this.data.tasks.length + ' ' + t('records_label');

        const empty = document.getElementById('table-empty');
        const table = document.getElementById('task-table');
        if (this.filteredTasks.length === 0) {
            empty.classList.remove('hidden');
            table.classList.add('hidden');
        } else {
            empty.classList.add('hidden');
            table.classList.remove('hidden');
        }
    },

    applyFilters2() {
        if (!this.data) return;
        const status = document.getElementById('filter-status-2').value;
        const search = document.getElementById('filter-search-2').value.toLowerCase();

        const filtered = this.data.tasks.filter(t => {
            if (status && t.status !== status) return false;
            if (search) {
                const haystack = [t.title, t.equipment_name, t.component_name, t.section_name, t.factory_name]
                    .join(' ').toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            return true;
        });

        this.renderTable('task-tbody-2', filtered);
        document.getElementById('result-count-2').textContent =
            filtered.length + ' ' + t('records_of') + ' ' + this.data.tasks.length + ' ' + t('records_label');
    },

    renderTable(tbodyId, tasks) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;

        if (tasks.length === 0) {
            tbody.innerHTML = '';
            return;
        }

        tbody.innerHTML = tasks.map(task => {
            const typeLabel = task.plan_id
                ? `<span class="task-type-badge type-plan">${I18n.t('type_plan')}</span>`
                : `<span class="task-type-badge type-manual">${I18n.t('type_manual')}</span>`;

            const statusClass = 'status-' + task.status;
            const statusLabels = {
                overdue: I18n.t('status_overdue'),
                planned: I18n.t('status_planned'),
                completed: I18n.t('status_completed'),
                in_progress: I18n.t('status_in_progress'),
            };

            const dueDateFormatted = task.due_date ? this.formatDate(task.due_date) : '-';

            return `<tr>
                <td class="col-name" title="${this.esc(task.title)}">${this.esc(task.title)}</td>
                <td class="col-factory cell-muted">${this.esc(task.factory_name) || '-'}</td>
                <td class="col-section cell-muted">${this.esc(task.section_name) || '-'}</td>
                <td class="col-equipment">${this.esc(task.equipment_name) || '-'}</td>
                <td class="col-component">${this.esc(task.component_name) || '-'}</td>
                <td class="col-type">${typeLabel}</td>
                <td class="col-due cell-mono">${dueDateFormatted}</td>
                <td class="col-status">
                    <div class="status-bar ${statusClass}">
                        <div class="status-indicator"></div>
                        <span class="status-text">${statusLabels[task.status] || task.status}</span>
                    </div>
                </td>
                <td class="col-actions">
                    <div class="action-btns">
                        ${task.status !== 'completed' ? `<button class="btn-icon" data-action="complete" data-id="${task.id}" title="Complete">&#10003;</button>` : ''}
                        <button class="btn-icon" data-action="delete" data-id="${task.id}" title="Delete" style="color:var(--danger)">&#10005;</button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = parseInt(btn.dataset.id);
                if (action === 'complete') {
                    await API.updateTask(id, { status: 'completed' });
                    this.load();
                } else if (action === 'delete') {
                    await API.deleteTask(id);
                    this.load();
                }
            });
        });

        // Row click opens detail panel
        tbody.querySelectorAll('tr').forEach(row => {
            row.style.cursor = 'pointer';
            row.addEventListener('click', (e) => {
                if (e.target.closest('[data-action]')) return;
                const taskId = row.querySelector('[data-id]')?.dataset.id;
                if (taskId) {
                    DetailPane.open(parseInt(taskId), Dashboard.data);
                }
            });
        });
    },

    async loadPlans() {
        const plans = await API.getPlans({});
        const tbody = document.getElementById('plan-tbody');
        if (!tbody) return;

        let tree = [];
        try { tree = await API.getTree(); } catch(e) {}

        const equipMap = {};
        const compMap = {};
        tree.forEach(f => {
            f.sections.forEach(s => {
                s.equipment_list.forEach(eq => {
                    equipMap[eq.id] = eq.name;
                    eq.components.forEach(c => {
                        compMap[c.id] = c.name;
                    });
                });
            });
        });

        tbody.innerHTML = plans.map(p => {
            const eqName = p.equipment_id ? (equipMap[p.equipment_id] || '-') : '-';
            const compName = p.component_id ? (compMap[p.component_id] || '-') : '-';
            const lastDone = p.last_completed ? this.formatDate(p.last_completed) : 'Never';
            const nextDue = this.formatDate(p.next_due);

            return `<tr>
                <td>${this.esc(p.title)}</td>
                <td>${this.esc(eqName)}</td>
                <td>${this.esc(compName)}</td>
                <td class="cell-mono">${p.interval_days}</td>
                <td class="cell-mono">${lastDone}</td>
                <td class="cell-mono">${nextDue}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-icon" data-action="complete-plan" data-id="${p.id}" title="Complete">&#10003;</button>
                        <button class="btn-icon" data-action="delete-plan" data-id="${p.id}" title="Delete" style="color:var(--danger)">&#10005;</button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = parseInt(btn.dataset.id);
                if (action === 'complete-plan') {
                    await API.completePlan(id);
                    this.loadPlans();
                    this.load();
                } else if (action === 'delete-plan') {
                    await API.deletePlan(id);
                    this.loadPlans();
                    this.load();
                }
            });
        });
    },

    showNewTaskModal() {
        API.getTree().then(tree => {
            const equipOptions = [{ value: '', label: t('modal_none') }];
            tree.forEach(f => {
                f.sections.forEach(s => {
                    s.equipment_list.forEach(eq => {
                        equipOptions.push({ value: String(eq.id), label: `${f.name} > ${s.name} > ${eq.name}` });
                    });
                });
            });

            Modal.show(t('modal_new_task'), [
                { name: 'title_en', label: t('field_title_en'), type: 'text', required: true },
                { name: 'title_de', label: t('field_title_de'), type: 'text' },
                { name: 'description', label: t('field_description'), type: 'textarea' },
                { name: 'due_date', label: t('field_due_date'), type: 'date', required: true },
                { name: 'equipment_id', label: t('field_equipment'), type: 'select', options: equipOptions },
            ], async (data) => {
                const payload = {
                    title: data.title_en || data.title_de,
                    description: data.description,
                    due_date: data.due_date,
                };
                if (data.equipment_id) payload.equipment_id = parseInt(data.equipment_id);
                const created = await API.createTask(payload);
                if (data.title_en) await API.upsertTranslation({ entity_type: 'task', entity_id: created.id, field_name: 'title', lang: 'en', value: data.title_en });
                if (data.title_de) await API.upsertTranslation({ entity_type: 'task', entity_id: created.id, field_name: 'title', lang: 'de', value: data.title_de });
                this.load();
            });
        });
    },

    showNewPlanModal() {
        API.getTree().then(tree => {
            const equipOptions = [{ value: '', label: t('modal_none') }];
            tree.forEach(f => {
                f.sections.forEach(s => {
                    s.equipment_list.forEach(eq => {
                        equipOptions.push({ value: String(eq.id), label: `${f.name} > ${s.name} > ${eq.name}` });
                    });
                });
            });

            Modal.show(t('modal_new_plan'), [
                { name: 'title_en', label: t('field_title_en'), type: 'text', required: true },
                { name: 'title_de', label: t('field_title_de'), type: 'text' },
                { name: 'description', label: t('field_description'), type: 'textarea' },
                { name: 'interval_days', label: t('field_interval'), type: 'number', required: true },
                { name: 'next_due', label: t('field_first_due'), type: 'date', required: true },
                { name: 'equipment_id', label: t('field_equipment'), type: 'select', options: equipOptions },
            ], async (data) => {
                const payload = {
                    title: data.title_en || data.title_de,
                    description: data.description,
                    interval_days: parseInt(data.interval_days),
                    next_due: data.next_due,
                };
                if (data.equipment_id) payload.equipment_id = parseInt(data.equipment_id);
                const created = await API.createPlan(payload);
                if (data.title_en) await API.upsertTranslation({ entity_type: 'plan', entity_id: created.id, field_name: 'title', lang: 'en', value: data.title_en });
                if (data.title_de) await API.upsertTranslation({ entity_type: 'plan', entity_id: created.id, field_name: 'title', lang: 'de', value: data.title_de });
                this.loadPlans();
                this.load();
            });
        });
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString(I18n.getDateLocale(), { month: 'short', day: '2-digit', year: 'numeric' });
    },

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};
