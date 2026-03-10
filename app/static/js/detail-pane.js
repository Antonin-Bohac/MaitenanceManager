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
        document.getElementById('detail-complete-btn').addEventListener('click', () => this.completeTask());
        document.getElementById('detail-delete-btn').addEventListener('click', () => this.deleteTask());

        // File upload
        const uploadArea = document.getElementById('detail-upload-area');
        const fileInput = document.getElementById('detail-file-input');

        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.uploadFiles(e.target.files);
            fileInput.value = '';
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length) this.uploadFiles(e.dataTransfer.files);
        });
    },

    async open(taskId, dashboardData) {
        this.dashboardData = dashboardData;
        const taskRow = dashboardData?.tasks?.find(t => t.id === taskId);
        if (!taskRow) return;

        try {
            const fullTask = await API.getTask(taskId);
            this.currentTask = { ...taskRow, notes: fullTask.notes || '' };
        } catch {
            this.currentTask = { ...taskRow, notes: '' };
        }

        this.render();
        this.loadDocs();
        this.panel.classList.add('open');
        document.getElementById('view-dashboard').classList.add('view-dashboard-with-panel');
    },

    close() {
        this.panel.classList.remove('open');
        document.getElementById('view-dashboard').classList.remove('view-dashboard-with-panel');
        this.currentTask = null;
    },

    render() {
        const t = this.currentTask;
        if (!t) return;

        document.getElementById('detail-title').textContent = t.title;

        const pathParts = [t.factory_name, t.section_name, t.equipment_name, t.component_name].filter(Boolean);
        document.getElementById('detail-path').textContent = pathParts.join(' → ') || 'No equipment linked';

        const statusLabels = { overdue: 'Overdue', planned: 'Planned', completed: 'Completed' };
        const badges = document.getElementById('detail-badges');
        badges.innerHTML = `
            <span class="detail-badge detail-badge-${t.status}">${statusLabels[t.status] || t.status}</span>
            <span class="detail-badge detail-badge-due">Due: ${t.due_date ? Dashboard.formatDate(t.due_date) : '-'}</span>
            <span class="detail-badge detail-badge-type">${t.plan_id ? 'Plan' : 'Manual'}</span>
        `;

        document.getElementById('detail-description').textContent = t.description || 'No description';

        this.hideNotesEditor();
        document.getElementById('detail-notes-display').textContent = t.notes || 'No notes yet';

        const completeBtn = document.getElementById('detail-complete-btn');
        completeBtn.style.display = t.status === 'completed' ? 'none' : '';
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
        document.getElementById('detail-notes-display').textContent = notes || 'No notes yet';
        this.hideNotesEditor();
    },

    async loadDocs() {
        if (!this.currentTask) return;
        const docs = await API.getTaskDocs(this.currentTask.id);
        const list = document.getElementById('detail-docs-list');

        if (docs.length === 0) {
            list.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">No documents</div>';
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
    },

    async completeTask() {
        if (!this.currentTask) return;
        await API.updateTask(this.currentTask.id, { status: 'completed' });
        this.close();
        Dashboard.load();
    },

    async deleteTask() {
        if (!this.currentTask) return;
        await API.deleteTask(this.currentTask.id);
        this.close();
        Dashboard.load();
    },

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};
