const Modal = {
    overlay: null,

    init() {
        this.overlay = document.getElementById('modal-overlay');
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });
    },

    show(title, fields, onSubmit) {
        let html = `<div class="modal"><h3>${title}</h3><form id="modal-form">`;
        fields.forEach(f => {
            html += `<div class="modal-field">`;
            html += `<label for="field-${f.name}">${f.label}</label>`;
            if (f.type === 'textarea') {
                html += `<textarea id="field-${f.name}" name="${f.name}" ${f.required ? 'required' : ''}>${f.value || ''}</textarea>`;
            } else if (f.type === 'select') {
                html += `<select id="field-${f.name}" name="${f.name}" ${f.required ? 'required' : ''}>`;
                (f.options || []).forEach(o => {
                    const sel = o.value === f.value ? 'selected' : '';
                    html += `<option value="${o.value}" ${sel}>${o.label}</option>`;
                });
                html += `</select>`;
            } else {
                html += `<input id="field-${f.name}" name="${f.name}" type="${f.type || 'text'}" value="${f.value || ''}" ${f.required ? 'required' : ''}>`;
            }
            html += `</div>`;
        });
        html += `<div class="modal-buttons">`;
        html += `<button type="button" class="btn" onclick="Modal.hide()">${t('btn_cancel')}</button>`;
        html += `<button type="submit" class="btn btn-primary">${t('btn_save')}</button>`;
        html += `</div></form></div>`;

        this.overlay.innerHTML = html;
        this.overlay.classList.remove('hidden');

        document.getElementById('modal-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {};
            formData.forEach((val, key) => {
                if (key.endsWith('_id') && val) {
                    data[key] = parseInt(val, 10);
                } else if (key === 'interval_days' && val) {
                    data[key] = parseInt(val, 10);
                } else {
                    data[key] = val;
                }
            });
            try {
                await onSubmit(data);
                this.hide();
            } catch (err) {
                alert(t('error_prefix') + err.message);
            }
        });

        const first = this.overlay.querySelector('input, textarea, select');
        if (first) first.focus();
    },

    confirm(message, onConfirm) {
        let html = `<div class="modal">`;
        html += `<h3>${t('modal_confirmation')}</h3>`;
        html += `<p style="margin-bottom:16px; color: var(--text-secondary)">${message}</p>`;
        html += `<div class="modal-buttons">`;
        html += `<button class="btn" onclick="Modal.hide()">${t('btn_cancel')}</button>`;
        html += `<button class="btn btn-danger" id="modal-confirm-btn">${t('btn_delete')}</button>`;
        html += `</div></div>`;

        this.overlay.innerHTML = html;
        this.overlay.classList.remove('hidden');

        document.getElementById('modal-confirm-btn').addEventListener('click', async () => {
            try {
                await onConfirm();
                this.hide();
            } catch (err) {
                alert(t('error_prefix') + err.message);
            }
        });
    },

    hide() {
        this.overlay.classList.add('hidden');
        this.overlay.innerHTML = '';
    }
};
