const DetailPane = {
    panel: null,
    currentTask: null,
    dashboardData: null,

    init() {
        this.panel = document.getElementById('task-detail-panel');

        document.getElementById('detail-close').addEventListener('click', () => this.close());
        document.getElementById('detail-notes-edit').addEventListener('click', () => this.showNotesEditor());
        document.getElementById('detail-notes-save').addEventListener('click', () => this.saveNotes());
        document.getElementById('detail-notes-cancel').addEventListener('click', () => this.hideNotesEditor());
        document.getElementById('detail-delete-btn').addEventListener('click', () => this.deleteTask());

        document.getElementById('detail-status-select').addEventListener('change', (e) => this.updateField('status', e.target.value));
        document.getElementById('detail-priority-select').addEventListener('change', (e) => {
            this.updateField('priority', e.target.value);
            this.updatePriorityColor();
        });

        this.setupInlineEdit('detail-assignee', 'assignee');
        this.setupInlineEdit('detail-due', 'due_date');
        this.setupInlineEdit('detail-duration', 'estimated_minutes', v => v ? parseInt(v) : null);

        document.getElementById('detail-checklist-add-btn').addEventListener('click', () => this.addChecklistItem());
        document.getElementById('detail-checklist-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.addChecklistItem();
        });

        const uploadArea = document.getElementById('detail-upload-area');
        const fileInput = document.getElementById('detail-file-input');
        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.uploadFiles(e.target.files);
            fileInput.value = '';
        });
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length) this.uploadFiles(e.dataTransfer.files);
        });
    },

    setupInlineEdit(prefix, field, transform) {
        const display = document.getElementById(`${prefix}-display`);
        const input = document.getElementById(`${prefix}-input`);

        display.addEventListener('click', () => {
            display.classList.add('hidden');
            input.classList.remove('hidden');
            if (field === 'due_date') {
                input.value = this.currentTask?.due_date || '';
            } else if (field === 'estimated_minutes') {
                input.value = this.currentTask?.estimated_minutes || '';
            } else {
                input.value = this.currentTask?.[field] || '';
            }
            input.focus();
        });

        const save = () => {
            input.classList.add('hidden');
            display.classList.remove('hidden');
            const val = transform ? transform(input.value) : input.value;
            this.updateField(field, val);
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    },

    async updateField(field, value) {
        if (!this.currentTask) return;
        const data = {};
        data[field] = value;
        await API.updateTask(this.currentTask.id, data);
        this.currentTask[field] = value;

        if (field === 'assignee') {
            document.getElementById('detail-assignee-display').textContent = value || t('detail_unassigned');
        }
        if (field === 'due_date') {
            this.currentTask.due_date = value;
            document.getElementById('detail-due-display').textContent = value ? Dashboard.formatDate(value) : '-';
        }
        if (field === 'estimated_minutes') {
            this.currentTask.estimated_minutes = value;
            document.getElementById('detail-duration-display').textContent = this.formatDuration(value);
        }

        this.loadActivity();
    },

    async open(taskId, dashboardData) {
        this.dashboardData = dashboardData;
        const taskRow = dashboardData?.tasks?.find(t => t.id === taskId);
        if (!taskRow) return;

        try {
            const fullTask = await API.getTask(taskId);
            this.currentTask = { ...taskRow, ...fullTask };
        } catch {
            this.currentTask = { ...taskRow, notes: '', priority: 'medium', assignee: '', estimated_minutes: null };
        }

        this.render();
        this.loadChecklist();
        this.loadDocs();
        this.loadActivity();
        this.panel.classList.add('open');
        document.getElementById('view-dashboard').classList.add('view-dashboard-with-panel');
    },

    close() {
        this.panel.classList.remove('open');
        document.getElementById('view-dashboard').classList.remove('view-dashboard-with-panel');
        this.currentTask = null;
    },

    render() {
        const tk = this.currentTask;
        if (!tk) return;

        document.getElementById('detail-title').textContent = tk.title;
        this.renderBreadcrumb(tk);

        document.getElementById('detail-status-select').value = tk.status;
        const prioSelect = document.getElementById('detail-priority-select');
        prioSelect.value = tk.priority || 'medium';
        this.updatePriorityColor();

        document.getElementById('detail-assignee-display').textContent = tk.assignee || t('detail_unassigned');
        document.getElementById('detail-due-display').textContent = tk.due_date ? Dashboard.formatDate(tk.due_date) : '-';
        document.getElementById('detail-duration-display').textContent = this.formatDuration(tk.estimated_minutes);

        const planContainer = document.getElementById('detail-plan-info-container');
        if (tk.plan_id) {
            planContainer.classList.remove('hidden');
            document.getElementById('detail-plan-info').textContent = t('type_plan') + ' #' + tk.plan_id;
        } else {
            planContainer.classList.add('hidden');
        }

        document.getElementById('detail-description').textContent = tk.description || t('detail_no_description');

        this.hideNotesEditor();
        document.getElementById('detail-notes-display').textContent = tk.notes || t('detail_no_notes');
    },

    renderBreadcrumb(tk) {
        const container = document.getElementById('detail-breadcrumb');
        const levels = [
            { icon: '🏭', name: tk.factory_name },
            { icon: '📁', name: tk.section_name },
            { icon: '⚙️', name: tk.equipment_name },
            { icon: '🔧', name: tk.component_name },
        ].filter(l => l.name);

        if (levels.length === 0) {
            container.innerHTML = `<span class="detail-breadcrumb-pill" style="color:var(--text-muted)">${t('detail_no_equipment')}</span>`;
            return;
        }

        container.innerHTML = levels.map((l, i) => {
            const isLast = i === levels.length - 1;
            const pill = `<span class="detail-breadcrumb-pill ${isLast ? 'active' : ''}">${l.icon} ${this.esc(l.name)}</span>`;
            const arrow = isLast ? '' : '<span class="detail-breadcrumb-arrow">→</span>';
            return pill + arrow;
        }).join('');
    },

    updatePriorityColor() {
        const select = document.getElementById('detail-priority-select');
        select.className = 'detail-meta-select priority-' + select.value;
    },

    formatDuration(minutes) {
        if (!minutes) return '-';
        if (minutes < 60) return minutes + ' min';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    },

    showNotesEditor() {
        document.getElementById('detail-notes-display').classList.add('hidden');
        document.getElementById('detail-notes-edit').classList.add('hidden');
        const editor = document.getElementById('detail-notes-editor');
        editor.classList.remove('hidden');
        const textarea = document.getElementById('detail-notes-textarea');
        textarea.value = this.currentTask?.notes || '';
        textarea.focus();
    },

    hideNotesEditor() {
        document.getElementById('detail-notes-display').classList.remove('hidden');
        document.getElementById('detail-notes-edit').classList.remove('hidden');
        document.getElementById('detail-notes-editor').classList.add('hidden');
    },

    async saveNotes() {
        if (!this.currentTask) return;
        const notes = document.getElementById('detail-notes-textarea').value;
        await API.updateTask(this.currentTask.id, { notes });
        this.currentTask.notes = notes;
        document.getElementById('detail-notes-display').textContent = notes || t('detail_no_notes');
        this.hideNotesEditor();
        this.loadActivity();
    },

    async loadChecklist() {
        if (!this.currentTask) return;
        const items = await API.getChecklist(this.currentTask.id);
        const list = document.getElementById('detail-checklist-list');
        const completed = items.filter(i => i.is_completed).length;
        const progress = document.getElementById('detail-checklist-progress');
        progress.textContent = items.length > 0 ? `${completed}/${items.length} ${t('detail_completed_of')}` : '';

        if (items.length === 0) {
            list.innerHTML = '';
            return;
        }

        list.innerHTML = items.map(item => `
            <div class="detail-checklist-item ${item.is_completed ? 'completed' : ''}" data-item-id="${item.id}">
                <input type="checkbox" ${item.is_completed ? 'checked' : ''}>
                <span class="checklist-text">${this.esc(item.text)}</span>
                <span class="checklist-remove" title="Remove">✕</span>
            </div>
        `).join('');

        list.querySelectorAll('.detail-checklist-item').forEach(el => {
            const itemId = parseInt(el.dataset.itemId);
            el.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
                this.toggleChecklistItem(itemId, e.target.checked);
            });
            el.querySelector('.checklist-remove').addEventListener('click', () => {
                this.removeChecklistItem(itemId);
            });
        });
    },

    async addChecklistItem() {
        if (!this.currentTask) return;
        const input = document.getElementById('detail-checklist-input');
        const text = input.value.trim();
        if (!text) return;
        await API.addChecklistItem(this.currentTask.id, { text });
        input.value = '';
        this.loadChecklist();
        this.loadActivity();
    },

    async toggleChecklistItem(itemId, isCompleted) {
        if (!this.currentTask) return;
        await API.updateChecklistItem(this.currentTask.id, itemId, { is_completed: isCompleted });
        this.loadChecklist();
        this.loadActivity();
    },

    async removeChecklistItem(itemId) {
        if (!this.currentTask) return;
        await API.deleteChecklistItem(this.currentTask.id, itemId);
        this.loadChecklist();
        this.loadActivity();
    },

    async loadDocs() {
        if (!this.currentTask) return;
        const docs = await API.getTaskDocs(this.currentTask.id);
        const list = document.getElementById('detail-docs-list');

        if (docs.length === 0) {
            list.innerHTML = `<div style="font-size:11px;color:var(--text-muted);">${t('detail_no_docs')}</div>`;
            return;
        }

        list.innerHTML = docs.map(d => {
            const fileUrl = d.file_path ? `/api/uploads/${d.file_path}` : d.url;
            return `
                <div class="detail-doc-item" data-url="${this.esc(fileUrl)}">
                    <span class="detail-doc-icon">📄</span>
                    <div class="detail-doc-info">
                        <div class="detail-doc-name">${this.esc(d.name)}</div>
                    </div>
                    <span class="detail-doc-open">↗</span>
                    <button class="detail-doc-delete" data-doc-id="${d.id}" title="Remove">✕</button>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.detail-doc-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.detail-doc-delete')) return;
                window.open(item.dataset.url, '_blank');
            });
        });

        list.querySelectorAll('.detail-doc-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await API.deleteDoc(parseInt(btn.dataset.docId));
                this.loadDocs();
                this.loadActivity();
            });
        });
    },

    async uploadFiles(files) {
        if (!this.currentTask) return;
        for (const file of files) {
            try {
                const uploaded = await API.uploadFile(file);
                await API.createDoc({
                    name: file.name,
                    url: uploaded.url,
                    file_path: uploaded.filename,
                    task_id: this.currentTask.id,
                });
            } catch (e) {
                console.error('Upload failed:', e);
            }
        }
        this.loadDocs();
        this.loadActivity();
    },

    async loadActivity() {
        if (!this.currentTask) return;
        const entries = await API.getActivity(this.currentTask.id);
        const list = document.getElementById('detail-activity-list');

        if (entries.length === 0) {
            list.innerHTML = '';
            return;
        }

        const actionIcons = {
            task_created: '📋',
            status_changed: '🔄',
            priority_changed: '⚡',
            assignee_changed: '👤',
            notes_edited: '📝',
            due_date_changed: '📅',
            estimated_minutes_changed: '⏱️',
            checklist_added: '➕',
            checklist_completed: '✅',
            checklist_removed: '➖',
            file_uploaded: '📎',
            file_removed: '🗑️',
        };

        list.innerHTML = entries.map(e => {
            const icon = actionIcons[e.action] || '•';
            const label = t('activity_' + e.action) || e.action;
            const time = this.formatTime(e.created_at);
            const detail = e.detail ? `<div class="detail-activity-detail">${this.esc(e.detail)}</div>` : '';
            return `
                <div class="detail-activity-item">
                    <span class="detail-activity-icon">${icon}</span>
                    <div>
                        <div class="detail-activity-text">${label}</div>
                        ${detail}
                    </div>
                    <span class="detail-activity-time">${time}</span>
                </div>
            `;
        }).join('');
    },

    formatTime(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return d.toLocaleDateString(I18n.getDateLocale(), { month: 'short', day: 'numeric' }) + ' ' +
            d.toLocaleTimeString(I18n.getDateLocale(), { hour: '2-digit', minute: '2-digit' });
    },

    async deleteTask() {
        if (!this.currentTask) return;
        Modal.confirm(t('confirm_delete_task'), async () => {
            await API.deleteTask(this.currentTask.id);
            this.close();
            Dashboard.load();
        });
    },

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};
