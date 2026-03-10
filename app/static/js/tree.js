const Tree = {
    container: null,
    selectedEl: null,

    init() {
        this.container = document.getElementById('tree');
    },

    async refresh() {
        const data = await API.getTree();
        this.container.innerHTML = '';
        data.forEach(factory => {
            this.container.appendChild(this.renderFactory(factory));
        });
    },

    renderFactory(f) {
        return this.renderNode({
            type: 'factory', id: f.id, name: f.name,
            children: f.sections.map(s => this.renderSection(s, f.id)),
            onAdd: () => this.addSection(f.id),
            onEdit: () => this.editFactory(f),
            onDelete: () => this.deleteFactory(f),
        });
    },

    renderSection(s, factoryId) {
        return this.renderNode({
            type: 'section', id: s.id, name: s.name,
            children: s.equipment_list.map(e => this.renderEquipment(e, s.id)),
            onAdd: () => this.addEquipment(s.id),
            onEdit: () => this.editSection(s),
            onDelete: () => this.deleteSection(s),
        });
    },

    renderEquipment(e, sectionId) {
        return this.renderNode({
            type: 'equipment', id: e.id, name: e.name,
            children: e.components.map(c => this.renderComponent(c, e.id)),
            onAdd: () => this.addComponent(e.id),
            onEdit: () => this.editEquipment(e),
            onDelete: () => this.deleteEquipment(e),
        });
    },

    renderComponent(c, equipmentId) {
        return this.renderNode({
            type: 'component', id: c.id, name: c.name,
            children: [],
            onEdit: () => this.editComponent(c),
            onDelete: () => this.deleteComponent(c),
        });
    },

    renderNode({ type, id, name, children, onAdd, onEdit, onDelete }) {
        const node = document.createElement('div');
        node.className = 'tree-node';
        const label = document.createElement('div');
        label.className = 'tree-label';
        label.dataset.type = type;
        label.dataset.id = id;
        const hasChildren = children && children.length > 0;
        const icons = { factory: '\u{1F3ED}', section: '\u{1F4C1}', equipment: '\u2699\uFE0F', component: '\u{1F529}' };
        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        toggle.textContent = hasChildren ? '\u25BC' : (onAdd ? '\u25B6' : ' ');
        label.appendChild(toggle);
        const text = document.createElement('span');
        text.textContent = `${icons[type] || ''} ${name}`;
        text.style.overflow = 'hidden';
        text.style.textOverflow = 'ellipsis';
        label.appendChild(text);
        const actions = document.createElement('span');
        actions.className = 'tree-actions';
        if (onAdd) {
            const addBtn = document.createElement('button');
            addBtn.textContent = '+';
            addBtn.title = 'Přidat';
            addBtn.addEventListener('click', (e) => { e.stopPropagation(); onAdd(); });
            actions.appendChild(addBtn);
        }
        if (onEdit) {
            const editBtn = document.createElement('button');
            editBtn.textContent = '\u270E';
            editBtn.title = 'Upravit';
            editBtn.addEventListener('click', (e) => { e.stopPropagation(); onEdit(); });
            actions.appendChild(editBtn);
        }
        if (onDelete) {
            const delBtn = document.createElement('button');
            delBtn.textContent = '\u2715';
            delBtn.title = 'Smazat';
            delBtn.addEventListener('click', (e) => { e.stopPropagation(); onDelete(); });
            actions.appendChild(delBtn);
        }
        label.appendChild(actions);
        label.addEventListener('click', () => {
            if (this.selectedEl) this.selectedEl.classList.remove('selected');
            label.classList.add('selected');
            this.selectedEl = label;
            Detail.show(type, id);
        });
        node.appendChild(label);
        if (children && children.length > 0) {
            const childContainer = document.createElement('div');
            childContainer.className = 'tree-children';
            children.forEach(c => childContainer.appendChild(c));
            node.appendChild(childContainer);
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                childContainer.classList.toggle('collapsed');
                toggle.textContent = childContainer.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
            });
        } else if (onAdd) {
            const childContainer = document.createElement('div');
            childContainer.className = 'tree-children collapsed';
            node.appendChild(childContainer);
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                childContainer.classList.toggle('collapsed');
                toggle.textContent = childContainer.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
            });
        }
        return node;
    },

    addSection(factoryId) {
        Modal.show('Nová sekce', [
            { name: 'name', label: 'Název', type: 'text', required: true },
            { name: 'description', label: 'Popis', type: 'textarea' },
        ], async (data) => { data.factory_id = factoryId; await API.createSection(data); this.refresh(); });
    },
    addEquipment(sectionId) {
        Modal.show('Nové zařízení', [
            { name: 'name', label: 'Název', type: 'text', required: true },
            { name: 'description', label: 'Popis', type: 'textarea' },
        ], async (data) => { data.section_id = sectionId; await API.createEquipment(data); this.refresh(); });
    },
    addComponent(equipmentId) {
        Modal.show('Nová komponenta', [
            { name: 'name', label: 'Název', type: 'text', required: true },
            { name: 'description', label: 'Popis', type: 'textarea' },
        ], async (data) => { data.equipment_id = equipmentId; await API.createComponent(data); this.refresh(); });
    },
    editFactory(f) {
        Modal.show('Upravit továrnu', [
            { name: 'name', label: 'Název', type: 'text', required: true, value: f.name },
            { name: 'description', label: 'Popis', type: 'textarea', value: f.description || '' },
        ], async (data) => { await API.updateFactory(f.id, data); this.refresh(); });
    },
    editSection(s) {
        Modal.show('Upravit sekci', [
            { name: 'name', label: 'Název', type: 'text', required: true, value: s.name },
            { name: 'description', label: 'Popis', type: 'textarea', value: s.description || '' },
        ], async (data) => { await API.updateSection(s.id, data); this.refresh(); });
    },
    editEquipment(e) {
        Modal.show('Upravit zařízení', [
            { name: 'name', label: 'Název', type: 'text', required: true, value: e.name },
            { name: 'description', label: 'Popis', type: 'textarea', value: e.description || '' },
        ], async (data) => { await API.updateEquipment(e.id, data); this.refresh(); });
    },
    editComponent(c) {
        Modal.show('Upravit komponentu', [
            { name: 'name', label: 'Název', type: 'text', required: true, value: c.name },
            { name: 'description', label: 'Popis', type: 'textarea', value: c.description || '' },
        ], async (data) => { await API.updateComponent(c.id, data); this.refresh(); });
    },
    deleteFactory(f) {
        Modal.confirm(`Opravdu smazat továrnu "${f.name}" a vše v ní?`, async () => { await API.deleteFactory(f.id); this.refresh(); Detail.clear(); });
    },
    deleteSection(s) {
        Modal.confirm(`Opravdu smazat sekci "${s.name}" a vše v ní?`, async () => { await API.deleteSection(s.id); this.refresh(); Detail.clear(); });
    },
    deleteEquipment(e) {
        Modal.confirm(`Opravdu smazat zařízení "${e.name}" a vše v něm?`, async () => { await API.deleteEquipment(e.id); this.refresh(); Detail.clear(); });
    },
    deleteComponent(c) {
        Modal.confirm(`Opravdu smazat komponentu "${c.name}"?`, async () => { await API.deleteComponent(c.id); this.refresh(); Detail.clear(); });
    },
};
