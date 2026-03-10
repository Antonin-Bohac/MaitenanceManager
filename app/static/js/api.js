const API = {
    async request(method, url, data) {
        const opts = { method, headers: {} };
        if (data) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(data);
        }
        const r = await fetch(url, opts);
        if (!r.ok) {
            const text = await r.text();
            throw new Error(`${r.status}: ${text}`);
        }
        return r.json();
    },
    get: (url) => API.request('GET', url),
    post: (url, data) => API.request('POST', url, data),
    put: (url, data) => API.request('PUT', url, data),
    del: (url) => API.request('DELETE', url),

    getTree: () => API.get('/api/tree'),
    createFactory: (data) => API.post('/api/factories', data),
    updateFactory: (id, data) => API.put(`/api/factories/${id}`, data),
    deleteFactory: (id) => API.del(`/api/factories/${id}`),
    getFactory: (id) => API.get(`/api/factories/${id}`),
    createSection: (data) => API.post('/api/sections', data),
    updateSection: (id, data) => API.put(`/api/sections/${id}`, data),
    deleteSection: (id) => API.del(`/api/sections/${id}`),
    getSection: (id) => API.get(`/api/sections/${id}`),
    createEquipment: (data) => API.post('/api/equipment', data),
    updateEquipment: (id, data) => API.put(`/api/equipment/${id}`, data),
    deleteEquipment: (id) => API.del(`/api/equipment/${id}`),
    getEquipment: (id) => API.get(`/api/equipment/${id}`),
    createComponent: (data) => API.post('/api/components', data),
    updateComponent: (id, data) => API.put(`/api/components/${id}`, data),
    deleteComponent: (id) => API.del(`/api/components/${id}`),
    getComponent: (id) => API.get(`/api/components/${id}`),
    getDocs: (params) => API.get(`/api/documentation?${new URLSearchParams(params)}`),
    createDoc: (data) => API.post('/api/documentation', data),
    updateDoc: (id, data) => API.put(`/api/documentation/${id}`, data),
    deleteDoc: (id) => API.del(`/api/documentation/${id}`),
    getTasks: (params) => API.get(`/api/maintenance/tasks?${new URLSearchParams(params)}`),
    createTask: (data) => API.post('/api/maintenance/tasks', data),
    updateTask: (id, data) => API.put(`/api/maintenance/tasks/${id}`, data),
    deleteTask: (id) => API.del(`/api/maintenance/tasks/${id}`),
    getPlans: (params) => API.get(`/api/maintenance/plans?${new URLSearchParams(params)}`),
    createPlan: (data) => API.post('/api/maintenance/plans', data),
    updatePlan: (id, data) => API.put(`/api/maintenance/plans/${id}`, data),
    deletePlan: (id) => API.del(`/api/maintenance/plans/${id}`),
    completePlan: (id) => API.put(`/api/maintenance/plans/${id}/complete`),
    getOverview: () => API.get('/api/maintenance/overview'),
    getTask: (id) => API.get(`/api/maintenance/tasks/${id}`),
    getTaskDocs: (taskId) => API.get(`/api/documentation?task_id=${taskId}`),
    async uploadFile(file) {
        const form = new FormData();
        form.append('file', file);
        const r = await fetch('/api/uploads', { method: 'POST', body: form });
        if (!r.ok) {
            const text = await r.text();
            throw new Error(`${r.status}: ${text}`);
        }
        return r.json();
    },
};
