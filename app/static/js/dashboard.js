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
            this.filteredTasks.length + ' of ' + this.data.tasks.length + ' records';

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
            filtered.length + ' of ' + this.data.tasks.length + ' records';
    },

    renderTable(tbodyId, tasks) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;

        if (tasks.length === 0) {
            tbody.innerHTML = '';
            return;
        }

        tbody.innerHTML = tasks.map(t => {
            const typeLabel = t.plan_id
                ? '<span class="task-type-badge type-plan">Plan</span>'
                : '<span class="task-type-badge type-manual">Manual</span>';

            const statusClass = 'status-' + t.status;
            const statusLabels = { overdue: 'Overdue', planned: 'Planned', completed: 'Done' };

            const dueDateFormatted = t.due_date ? this.formatDate(t.due_date) : '-';

            return `<tr>
                <td class="col-name" title="${this.esc(t.title)}">${this.esc(t.title)}</td>
                <td class="col-factory cell-muted">${this.esc(t.factory_name) || '-'}</td>
                <td class="col-section cell-muted">${this.esc(t.section_name) || '-'}</td>
                <td class="col-equipment">${this.esc(t.equipment_name) || '-'}</td>
                <td class="col-component">${this.esc(t.component_name) || '-'}</td>
                <td class="col-type">${typeLabel}</td>
                <td class="col-due cell-mono">${dueDateFormatted}</td>
                <td class="col-status">
                    <div class="status-bar ${statusClass}">
                        <div class="status-indicator"></div>
                        <span class="status-text">${statusLabels[t.status] || t.status}</span>
                    </div>
                </td>
                <td class="col-actions">
                    <div class="action-btns">
                        ${t.status !== 'completed' ? `<button class="btn-icon" data-action="complete" data-id="${t.id}" title="Complete">&#10003;</button>` : ''}
                        <button class="btn-icon" data-action="delete" data-id="${t.id}" title="Delete" style="color:var(--danger)">&#10005;</button>
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
            const equipOptions = [{ value: '', label: '-- None --' }];
            tree.forEach(f => {
                f.sections.forEach(s => {
                    s.equipment_list.forEach(eq => {
                        equipOptions.push({ value: String(eq.id), label: `${f.name} > ${s.name} > ${eq.name}` });
                    });
                });
            });

            Modal.show('New Maintenance Task', [
                { name: 'title', label: 'Title', type: 'text', required: true },
                { name: 'description', label: 'Description', type: 'textarea' },
                { name: 'due_date', label: 'Due Date', type: 'date', required: true },
                { name: 'equipment_id', label: 'Equipment', type: 'select', options: equipOptions },
            ], async (data) => {
                if (!data.equipment_id) delete data.equipment_id;
                await API.createTask(data);
                this.load();
            });
        });
    },

    showNewPlanModal() {
        API.getTree().then(tree => {
            const equipOptions = [{ value: '', label: '-- None --' }];
            tree.forEach(f => {
                f.sections.forEach(s => {
                    s.equipment_list.forEach(eq => {
                        equipOptions.push({ value: String(eq.id), label: `${f.name} > ${s.name} > ${eq.name}` });
                    });
                });
            });

            Modal.show('New Maintenance Plan', [
                { name: 'title', label: 'Title', type: 'text', required: true },
                { name: 'description', label: 'Description', type: 'textarea' },
                { name: 'interval_days', label: 'Interval (days)', type: 'number', required: true },
                { name: 'next_due', label: 'First Due Date', type: 'date', required: true },
                { name: 'equipment_id', label: 'Equipment', type: 'select', options: equipOptions },
            ], async (data) => {
                if (!data.equipment_id) delete data.equipment_id;
                await API.createPlan(data);
                this.loadPlans();
                this.load();
            });
        });
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    },

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};
