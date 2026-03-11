const TranslationCache = {
    cache: {},

    async load(entityType, lang) {
        if (lang === 'en') {
            this.cache[entityType] = {};
            return;
        }
        try {
            const items = await API.get(`/api/translations/batch?entity_type=${entityType}&lang=${lang}`);
            const map = {};
            items.forEach(item => {
                const key = `${item.entity_id}_${item.field_name}`;
                map[key] = item.value;
            });
            this.cache[entityType] = map;
        } catch (e) {
            console.error('TranslationCache load error:', e);
            this.cache[entityType] = {};
        }
    },

    get(entityType, entityId, fieldName, fallback) {
        if (I18n.currentLang === 'en') return fallback;
        const key = `${entityId}_${fieldName}`;
        return this.cache[entityType]?.[key] || fallback;
    },

    async loadAll(lang) {
        await Promise.all([
            this.load('factory', lang),
            this.load('section', lang),
            this.load('equipment', lang),
            this.load('component', lang),
            this.load('task', lang),
            this.load('plan', lang),
        ]);
    },

    clear() {
        this.cache = {};
    },
};
