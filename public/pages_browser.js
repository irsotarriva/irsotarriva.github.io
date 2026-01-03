(() => {
    // Allow re-binding when the page DOM is reinserted.
    // Only skip initialization if we've already initialized and the main container still exists.
    const init = () => {
        // allow re-init when the content DOM was replaced by the SPA:
        const currentContainer = document.getElementById('cardsContainer');
        if (window.__pagesBrowserInitialized && currentContainer && currentContainer === window.__pagesBrowserContainer) return;
        window.__pagesBrowserInitialized = true;
        // remember the exact container element instance for future checks
        window.__pagesBrowserContainer = currentContainer;

        const cardsContainer = currentContainer;
        const noResults = document.getElementById('noResults');
        const searchInput = document.getElementById('searchInput');
        const skillsList = document.getElementById('skillsList');
        const tagsList = document.getElementById('tagsList');
        const languageList = document.getElementById('languageList');
        const typeList = document.getElementById('typeList');
        const clearFilters = document.getElementById('clearFilters');
        // Sorting control (default: inverse chronological / newest first)
        let sortSelect = document.getElementById('sortOrder');
        if (!sortSelect) {
            const sc = document.createElement('div');
            sc.id = 'sortControls';
            sc.style.margin = '8px 0';
            sc.style.fontSize = '0.95rem';
            const sortLabel = document.createElement('label');
            sortLabel.style.marginRight = '8px';
            sortLabel.id = 'sortLabel';
            sortLabel.textContent = t('sort');
            sc.appendChild(sortLabel);
            sortSelect = document.createElement('select');
            sortSelect.id = 'sortOrder';
            const optDesc = document.createElement('option'); optDesc.value = 'desc'; optDesc.text = t('newest_first');
            const optAsc = document.createElement('option'); optAsc.value = 'asc'; optAsc.text = t('oldest_first');
            sortSelect.appendChild(optDesc);
            sortSelect.appendChild(optAsc);
            sc.appendChild(sortSelect);
            if (cardsContainer && cardsContainer.parentNode) cardsContainer.parentNode.insertBefore(sc, cardsContainer);
        }
        window.__pagesSortOrder = window.__pagesSortOrder || 'desc';
        sortSelect.value = window.__pagesSortOrder;
        sortSelect.addEventListener('change', () => { window.__pagesSortOrder = sortSelect.value; renderCards(filtered); });

        // Constants and element refs
        const SLIDER_MIN = 2014;
        const SLIDER_MAX = new Date().getFullYear();
        const SLIDER_COLOR = '#C6C6C6';     // base track
        const RANGE_COLOR = '#2D6CDF';      // blue selected range

        const fromSlider = document.getElementById('fromSlider');
        const toSlider = document.getElementById('toSlider');
        const fromLabel = document.getElementById('fromLabel');
        const toLabel = document.getElementById('toLabel');
        const tickMarks = document.getElementById('tickMarks');
        const tickLabels = document.getElementById('tickLabels');
        const yearTicksList = document.getElementById('yearTicks');
        const rangeHighlight = document.getElementById('rangeHighlight');

        // Ensure fixed range across both sliders
        if (fromSlider) {
            fromSlider.min = SLIDER_MIN;
            fromSlider.max = SLIDER_MAX;
            fromSlider.step = 1;                 // snap to integer years
            fromSlider.setAttribute('list', 'yearTicks');
            if (!fromSlider.value) fromSlider.value = SLIDER_MIN;
        }
        if (toSlider) {
            toSlider.min = SLIDER_MIN;
            toSlider.max = SLIDER_MAX;
            toSlider.step = 1;                   // snap to integer years
            toSlider.setAttribute('list', 'yearTicks');
            if (!toSlider.value) toSlider.value = SLIDER_MAX;
        }

        // Prevent sliders from crossing: clamp values (keep static min/max)
        function clampNoCross() {
            if (!fromSlider || !toSlider) return;
            const from = Number(fromSlider.value);
            const to = Number(toSlider.value);
            if (from > to) {
                if (document.activeElement === fromSlider) {
                    fromSlider.value = String(to);
                } else {
                    toSlider.value = String(from);
                }
            }
        }

        let items = [];
        let filtered = [];
        let tagsMap = new Map();
        let skillsMap = new Map();

        function getLocalized(field, lang) {
            if (!field) return '';
            if (typeof field === 'string') return field;
            if (!lang) lang = document.getElementById('languageSelect')?.value || 'en';
            return field[lang] || field.en || Object.values(field)[0] || '';
        }

        function t(key, lang) {
            lang = lang || (document.getElementById('languageSelect')?.value || 'en');
            return (window.translations && window.translations[lang] && window.translations[lang][key]) || (window.translations && window.translations['en'] && window.translations['en'][key]) || key;
        }

        // fetch multiple endpoints (api first, then local) and return map of source => array
        async function fetchAll() {
            const sources = {
                // Prefer local data files first to avoid triggering API 404s when no API exists
                projects: ['/data/projects.json', '/api/projects', '/projects.json'],
                publications: ['/data/publications.json', '/api/publications', '/publications.json'],
                presentations: ['/data/presentations.json', '/api/presentations', '/presentations.json'],
                tags: ['/data/tags.json', '/api/tags', '/tags.json'],
                skills: ['/data/skills.json', '/api/skills', '/skills.json']
            };
            const out = { projects: [], publications: [], presentations: [], tags: [], skills: [] };
            for (const [key, endpoints] of Object.entries(sources)) {
                for (const e of endpoints) {
                    try {
                        const res = await fetch(e);
                        if (!res.ok) continue;
                        const json = await res.json();
                        if (Array.isArray(json) && json.length) {
                            out[key] = json.slice();
                            break;
                        }
                    } catch (err) { /* ignore */ }
                }
            }
            return out;
        }

        function ensureYear(it) {
            if (it.year) return Number(it.year);
            if (it.date && typeof it.date === 'string') {
                const m = it.date.match(/^(\d{4})/);
                if (m) return Number(m[1]);
            }
            return null;
        }

        function mergeWithParent(child, parent) {
            if (!parent) return child;
            // shallow merge: start from parent, overwrite with child's defined fields
            const res = Object.assign({}, parent, child);
            // for localized objects (title, description, image) merge keys
            ['title', 'description', 'image'].forEach(k => {
                const p = parent[k], c = child[k];
                if (p && typeof p === 'object' && c && typeof c === 'object') {
                    res[k] = Object.assign({}, p, c);
                } else if (c !== undefined) {
                    res[k] = c;
                } else {
                    res[k] = p;
                }
            });
            // arrays: if child defines field (even empty) use it, else fallback to parent
            ['tags', 'skills', 'languages'].forEach(k => {
                if (child.hasOwnProperty(k)) res[k] = child[k] || [];
                else res[k] = parent[k] ? parent[k].slice() : [];
            });
            // language/topic/date stay as above (res already set)
            // keep reference to parent_id for traceability
            res.parent_id = child.parent_id || parent.id;
            return res;
        }

        function collectFilters(list, maps = {}) {
            const skills = new Set();
            const tags = new Set();
            const langs = new Set();
            const types = new Set();
            const years = [];
            list.forEach(it => {
                (it.skills || []).forEach(s => {
                    // support object {id,...} or plain id or name
                    if (s && typeof s === 'object' && (s.id || s.name)) {
                        if (s.id) skills.add(String(s.id)); else if (s.name) skills.add(String(s.name));
                    } else if (typeof s === 'number' || (/^\d+$/.test(String(s)))) {
                        skills.add(String(s));
                    } else if (s) skills.add(String(s));
                });
                (it.tags || []).forEach(t => {
                    // tags are usually numeric ids
                    tags.add(String(t));
                });
                if (it.language) langs.add(it.language);
                (it.languages || []).forEach(l => {
                    const name = (l && (l.name || l.language || l.lang)) || null;
                    if (name) langs.add(name);
                });
                const y = ensureYear(it);
                if (y) years.push(y);
                const t = it._type || it._source || 'project';
                types.add(t === 'projects' ? 'project' : (t === 'publications' ? 'publication' : (t === 'presentations' ? 'presentation' : t)));
            });
            return { skills: Array.from(skills).sort((a, b) => Number(a) - Number(b)), tags: Array.from(tags).sort((a, b) => Number(a) - Number(b)), langs: Array.from(langs).sort(), types: Array.from(types).sort(), years };
        }

        // build tags checkbox list using tags map to resolve labels
        function buildTagsCheckboxList(container, values, tagsMap) {
            container.innerHTML = '';
            const lang = document.getElementById('languageSelect')?.value || 'en';
            values.forEach(v => {
                const id = `tag-${v}`;
                const label = document.createElement('label');
                label.style.display = 'block';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = String(v);
                cb.id = id;
                cb.addEventListener('change', applyFilters);
                label.appendChild(cb);
                const tagObj = tagsMap.get(Number(v));
                const display = tagObj ? (tagObj.label && (tagObj.label[lang] || tagObj.label.en)) || tagObj.key : String(v);
                label.appendChild(document.createTextNode(' ' + display));
                container.appendChild(label);
            });
        }

        // build skills checkbox list using skills map to resolve labels
        function buildSkillsCheckboxList(container, values, skillsMap) {
            container.innerHTML = '';
            const lang = document.getElementById('languageSelect')?.value || 'en';
            values.forEach(v => {
                const id = `skill-${v}`;
                const label = document.createElement('label');
                label.style.display = 'block';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = String(v);
                cb.id = id;
                cb.addEventListener('change', applyFilters);
                label.appendChild(cb);
                const sObj = skillsMap.get(Number(v));
                const display = sObj ? (sObj.label && (sObj.label[lang] || sObj.label.en)) || sObj.key : String(v);
                label.appendChild(document.createTextNode(' ' + display));
                container.appendChild(label);
            });
        }

        function buildCheckboxList(container, values, namePrefix) {
            container.innerHTML = '';
            values.forEach(v => {
                const id = `${namePrefix}-${v}`.replace(/\s+/g, '_');
                const label = document.createElement('label');
                label.style.display = 'block';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = v;
                cb.id = id;
                cb.addEventListener('change', applyFilters);
                label.appendChild(cb);
                // Translate type labels (e.g. project/publication/presentation) using registry
                const lang = document.getElementById('languageSelect')?.value || 'en';
                let display = String(v);
                if (namePrefix === 'type') {
                    const key = `type_${v}`;
                    display = t(key, lang) || String(v);
                }
                label.appendChild(document.createTextNode(' ' + display));
                container.appendChild(label);
            });
        }

        function readSelected(container) {
            return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
        }

        function getParsed(currentFrom, currentTo) {
            const from = parseInt(currentFrom.value, 10);
            const to = parseInt(currentTo.value, 10);
            return [from, to];
        }

        // Position the floating label above the slider thumb
        function positionLabel(labelEl, sliderEl, value) {
            if (!labelEl || !sliderEl) return;
            const min = Number(sliderEl.min);
            const max = Number(sliderEl.max);
            const pct = (Number(value) - min) / (max - min);

            // Use parent width for positioning
            const parent = sliderEl.parentElement || sliderEl;
            const width = parent.clientWidth || sliderEl.offsetWidth || 1;

            // Thumb approx offset compensation (half thumb width)
            const thumbHalf = 9; // matches ~18px thumb in CSS
            const x = Math.max(0, Math.min(width, pct * width));
            labelEl.style.left = `${x}px`;
            labelEl.textContent = String(value);

            // Optional small vertical alignment tweak
            labelEl.style.top = '-26px';
        }

        // Build ticks (5 total: min, 3 intermediates, max) and labels
        function computeTicks(min, max, count = 5) {
            const ticks = [];
            const span = (max - min) / (count - 1);
            for (let i = 0; i < count; i++) {
                const v = Math.round(min + span * i);
                const pct = ((v - min) / (max - min)) * 100;
                ticks.push({ value: v, pct });
            }
            // Ensure uniqueness in tight ranges
            const seen = new Set();
            return ticks.filter(t => {
                const k = t.value;
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });
        }

        function renderTicks() {
            if (!tickMarks || !tickLabels || !yearTicksList) return;
            const min = Number(fromSlider.min);
            const max = Number(toSlider.max);
            const ticks = computeTicks(min, max, 5);

            // Custom visual ticks
            tickMarks.innerHTML = '';
            ticks.forEach(t => {
                const el = document.createElement('span');
                el.className = 'tick';
                el.style.left = `${t.pct}%`;
                tickMarks.appendChild(el);
            });

            // Labels under the track
            tickLabels.innerHTML = '';
            ticks.forEach(t => {
                const lbl = document.createElement('span');
                lbl.className = 'tick-label';
                lbl.textContent = String(t.value);
                lbl.style.left = `${t.pct}%`;
                tickLabels.appendChild(lbl);
            });

            // Built-in datalist ticks (for supported browsers)
            yearTicksList.innerHTML = '';
            ticks.forEach(t => {
                const opt = document.createElement('option');
                opt.value = String(t.value);
                yearTicksList.appendChild(opt);
            });
        }

        // Update slider background to show selected range and labels
        function fillSlider(fromEl, toEl, sliderColor, rangeColor, controlSlider) {
            if (!fromEl || !toEl || !controlSlider) return;

            // Use fixed range for percentages so highlight anchors correctly
            const min = SLIDER_MIN;
            const max = SLIDER_MAX;
            const rangeDistance = Math.max(1, max - min);
            const fromValue = Number(fromEl.value);
            const toValue = Number(toEl.value);

            const fromPct = ((fromValue - min) / rangeDistance) * 100;
            const toPct = ((toValue - min) / rangeDistance) * 100;

            controlSlider.style.background = `linear-gradient(
                to right,
                ${SLIDER_COLOR} 0%,
                ${SLIDER_COLOR} ${fromPct}%,
                ${RANGE_COLOR} ${fromPct}%,
                ${RANGE_COLOR} ${toPct}%,
                ${SLIDER_COLOR} ${toPct}%,
                ${SLIDER_COLOR} 100%
            )`;

            // Position the visible range highlight bar (separate element)
            if (rangeHighlight) {
                const leftPct = Math.min(fromPct, toPct);
                const widthPct = Math.max(0, Math.abs(toPct - fromPct));
                rangeHighlight.style.left = `${leftPct}%`;
                rangeHighlight.style.width = `${widthPct}%`;
            }

            // Ensure values are clamped (no crossing)
            clampNoCross();

            // Move labels
            positionLabel(fromLabel, fromEl, fromValue);
            positionLabel(toLabel, toEl, toValue);
        }

        // Keep the toSlider accessible when overlaps occur
        function setToggleAccessible(currentTarget) {
            if (!toSlider || !currentTarget) return;
            if (Number(currentTarget.value) <= Number(currentTarget.min)) {
                toSlider.style.zIndex = 2;
            } else {
                toSlider.style.zIndex = 1;
            }
        }

        // Clamp values, update UI, and log
        function updateYearSlider() {
            if (!fromSlider || !toSlider) return;
            const min = SLIDER_MIN;
            const max = SLIDER_MAX;

            let from = parseInt(fromSlider.value || min, 10);
            let to = parseInt(toSlider.value || max, 10);

            if (from > to) {
                if (document.activeElement === fromSlider) {
                    to = from;
                    toSlider.value = to;
                } else {
                    from = to;
                    fromSlider.value = from;
                }
            }

            fillSlider(fromSlider, toSlider, '#C6C6C6', '#25daa5', toSlider);
            setToggleAccessible(toSlider);

            // Log current values whenever updated
            console.log(`Year sliders: from=${from}, to=${to}`);
        }

        // Apply filter wrapper (debounced elsewhere)
        function applyYearFilterAndRender() {
            updateYearSlider();
            // ...existing code...
            // ensure applyFilters() uses fromSlider.value and toSlider.value
            applyFilters();
        }

        function applyFilters() {
            const lang = document.getElementById('languageSelect')?.value || 'en';
            const q = (searchInput.value || '').trim().toLowerCase();
            const selSkills = readSelected(skillsList);
            const selTags = readSelected(tagsList);
            const selLangs = readSelected(languageList);
            const selTypes = readSelected(typeList);
            // year filtering using sliders
            const selMin = fromSlider ? parseInt(fromSlider.value, 10) : SLIDER_MIN;
            const selMax = toSlider ? parseInt(toSlider.value, 10) : SLIDER_MAX;

            filtered = items.filter(it => {
                const title = getLocalized(it.title, lang).toLowerCase();
                const desc = getLocalized(it.description, lang).toLowerCase();
                if (q && !(title.includes(q) || desc.includes(q))) return false;
                if (selLangs.length) {
                    const itemLangs = [];
                    if (it.language) itemLangs.push(it.language);
                    (it.languages || []).forEach(l => {
                        const name = (l && (l.name || l.language || l.lang)) || null;
                        if (name) itemLangs.push(name);
                    });
                    if (!itemLangs.length || !selLangs.some(l => itemLangs.includes(l))) return false;
                }
                if (selTags.length) {
                    if (!it.tags || !selTags.some(t => it.tags.includes(Number(t)))) return false;
                }
                if (selSkills.length) {
                    const ids = (it.skills || []).map(s => (s && typeof s === 'object' && s.id) ? Number(s.id) : Number(s)).filter(n => !isNaN(n));
                    if (!selSkills.every(s => ids.includes(Number(s)))) return false;
                }
                if (selTypes.length) {
                    const t = it._type || it._source || 'project';
                    const normalized = (t === 'projects' ? 'project' : (t === 'publications' ? 'publication' : (t === 'presentations' ? 'presentation' : t)));
                    if (!selTypes.includes(normalized)) return false;
                }
                const y = ensureYear(it);
                if (y && (y < selMin || y > selMax)) return false;
                return true;
            });
            renderCards(filtered);
        }

        function renderCards(list) {
            cardsContainer.innerHTML = '';
            // sort by year (default inverse chronological). Items without year go to the end.
            const order = window.__pagesSortOrder || 'desc';
            const lang = document.getElementById('languageSelect')?.value || 'en';
            const sorted = list.slice().sort((a, b) => {
                const ay = ensureYear(a), by = ensureYear(b);
                const na = (ay == null) ? (order === 'desc' ? -Infinity : Infinity) : ay;
                const nb = (by == null) ? (order === 'desc' ? -Infinity : Infinity) : by;
                if (na === nb) {
                    const ta = getLocalized(a.title || '', lang).toLowerCase();
                    const tb = getLocalized(b.title || '', lang).toLowerCase();
                    return ta < tb ? -1 : (ta > tb ? 1 : 0);
                }
                return order === 'desc' ? (nb - na) : (na - nb);
            });

            if (!sorted.length) { noResults.style.display = 'block'; return; }
            noResults.style.display = 'none';
            sorted.forEach(it => {
                const card = document.createElement('article');
                const imgSrc = (typeof it.image === 'object') ? (it.image.en || Object.values(it.image)[0]) : it.image || '';
                const title = getLocalized(it.title, lang) || 'Untitled';
                const desc = getLocalized(it.description, lang) || '';
                const short = desc.length > 220 ? desc.slice(0, 220) + '...' : desc;
                const type = it._type || it._source || 'project';
                const normalizedType = (type === 'projects' ? 'project' : (type === 'publications' ? 'publication' : (type === 'presentations' ? 'presentation' : type)));
                const year = ensureYear(it);
                const langEntries = Array.isArray(it.languages) && it.languages.length
                    ? it.languages
                    : (it.language ? [{ name: it.language }] : []);
                const langLabel = t('label_languages', lang) || 'Languages';

                const langText = langEntries.length ? (langLabel + ': ' + langEntries.map(l => {
                    const name = (l && (l.name || l.language || l.lang)) || '';
                    const pRaw = (l && (l.proportion ?? l.percent ?? (typeof l.ratio === 'number' ? (l.ratio * 100) : undefined)));
                    const p = (typeof pRaw === 'number' && isFinite(pRaw)) ? Math.round(pRaw) : null;
                    return p != null ? `${name} ${p}%` : name;
                }).join(', ')) : '';

                // assign type-specific class for border color
                const typeClass = `card-${normalizedType}`;
                card.className = `card ${typeClass}`;

                // Build inner content without type in meta; type will be shown as a badge
                card.innerHTML = `
                    ${imgSrc ? `<img src="${imgSrc}" alt="${title}">` : ''}
                    <h3>${title}</h3>
                    <p style="color:#444;">${short}</p>
                    <div class="meta">${langText} ${year ? ' • ' + year : ''}</div>
                `;

                // Add floating type badge (top-right)
                const badge = document.createElement('span');
                badge.className = `type-badge type-${normalizedType}`;
                // translate type label using registry, fallback to capitalized normalized type
                const typeKey = `type_${normalizedType}`;
                const typeLabel = t(typeKey, lang) || (normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1));
                badge.textContent = typeLabel;
                card.appendChild(badge);

                const tagsWrap = document.createElement('div');
                tagsWrap.className = 'tags';
                (it.tags || []).slice(0, 6).forEach(t => {
                    const s = document.createElement('span');
                    s.className = 'tag';
                    const tagObj = tagsMap.get(Number(t));
                    s.textContent = tagObj ? (tagObj.label && (tagObj.label[lang] || tagObj.label.en)) || tagObj.key : String(t);
                    tagsWrap.appendChild(s);
                });
                card.appendChild(tagsWrap);

                const skillsWrap = document.createElement('div');
                skillsWrap.style.marginTop = '8px';
                (it.skills || []).slice(0, 6).forEach(s => {
                    const sp = document.createElement('span');
                    sp.className = 'tag';
                    let display = '';
                    if (s && typeof s === 'object' && (s.id || s.name)) {
                        const sObj = skillsMap.get(Number(s.id));
                        display = sObj ? (sObj.label && (sObj.label[lang] || sObj.label.en)) || sObj.key : (s.name || String(s.id || ''));
                    } else if (typeof s === 'number' || (/^\d+$/.test(String(s)))) {
                        const sObj = skillsMap.get(Number(s));
                        display = sObj ? (sObj.label && (sObj.label[lang] || sObj.label.en)) || sObj.key : String(s);
                    } else {
                        display = s.name || s || '';
                    }
                    sp.textContent = display;
                    skillsWrap.appendChild(sp);
                });
                card.appendChild(skillsWrap);

                card.addEventListener('click', () => {
                    const params = new URLSearchParams();
                    params.set('id', it.id);
                    // use plural source names (projects/publications/presentations)
                    const sourceParam = (normalizedType === 'project' ? 'projects' : (normalizedType === 'publication' ? 'publications' : (normalizedType === 'presentation' ? 'presentations' : (normalizedType.endsWith('s') ? normalizedType : normalizedType + 's'))));
                    params.set('source', sourceParam);
                    // capture current filter state so we can restore it on back
                    const state = {
                        page: window.__currentPage || 'home',
                        filters: {
                            q: (searchInput && searchInput.value) ? searchInput.value : '',
                            skills: (skillsList ? readSelected(skillsList) : []),
                            tags: (tagsList ? readSelected(tagsList) : []),
                            langs: (languageList ? readSelected(languageList) : []),
                            types: (typeList ? readSelected(typeList) : []),
                            from: (fromSlider ? fromSlider.value : null),
                            to: (toSlider ? toSlider.value : null),
                            sort: window.__pagesSortOrder || 'desc'
                        },
                        scroll: window.scrollY || 0
                    };

                    // Use SPA loader to insert detail page into main content and update history (with state)
                    if (typeof window.loadPage === 'function') {
                        window.loadPage('detailPage', params.toString(), state, true);
                    } else {
                        // Fallback to full navigation if SPA loader isn't available
                        // encode state in URL as fallback (not ideal)
                        window.location.href = `detail_page.html?${params.toString()}`;
                    }
                });

                cardsContainer.appendChild(card);
            });
        }

        // Clear behavior: reset to full range and update
        function clearAll() {
            searchInput.value = '';
            Array.from(document.querySelectorAll('.checkbox-list input[type=checkbox]')).forEach(cb => cb.checked = false);
            if (fromSlider) fromSlider.value = SLIDER_MIN;
            if (toSlider) toSlider.value = SLIDER_MAX;
            renderTicks();
            updateYearSlider();
            applyFilters();
        }

        function debounce(fn, wait = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait) } }

        (async () => {
            const all = await fetchAll();
            const projects = (all.projects || []).map(p => (p._source = 'project', p));
            // build map by id for inheritance
            const projMap = new Map(projects.map(p => [p.id, p]));

            const pubs = (all.publications || []).map(p => (p._source = 'publication', p));
            const pres = (all.presentations || []).map(p => (p._source = 'presentation', p));

            // combine with inheritance: start from project entries, then flattened publications and presentations merged with parent defaults
            const combined = [];

            projects.forEach(p => {
                // annotate _type for consistency
                p._type = 'project';
                combined.push(p);
            });

            pubs.forEach(pub => {
                const parent = pub.parent_id ? projMap.get(pub.parent_id) : null;
                const merged = mergeWithParent(pub, parent);
                merged._type = 'publication';
                // ensure id is unique across types — keep original id but it's okay to repeat; _type will disambiguate
                combined.push(merged);
            });

            pres.forEach(pr => {
                const parent = pr.parent_id ? projMap.get(pr.parent_id) : null;
                const merged = mergeWithParent(pr, parent);
                merged._type = 'presentation';
                combined.push(merged);
            });

            // set items
            items = combined.map(it => it);

            // build lookup maps for tags and skills (resolve ids -> labels when rendering)
            tagsMap = new Map((all.tags || []).map(t => [t.id, t]));
            skillsMap = new Map((all.skills || []).map(s => [s.id, s]));

            const f = collectFilters(items, { tagsMap, skillsMap });
            buildSkillsCheckboxList(skillsList, f.skills, skillsMap);
            buildTagsCheckboxList(tagsList, f.tags, tagsMap);
            buildCheckboxList(languageList, f.langs, 'lang');
            // types checkbox (use capitalized labels)
            buildCheckboxList(typeList, f.types.map(t => t.toLowerCase()), 'type');

            // initialize sliders (set dynamic max to current year)
            if (fromSlider) { fromSlider.min = SLIDER_MIN; fromSlider.max = SLIDER_MAX; fromSlider.value = SLIDER_MIN; fromSlider.step = 1; }
            if (toSlider) { toSlider.min = SLIDER_MIN; toSlider.max = SLIDER_MAX; toSlider.value = SLIDER_MAX; toSlider.step = 1; }

            renderTicks();

            if (toSlider) fillSlider(fromSlider, toSlider, SLIDER_COLOR, RANGE_COLOR, toSlider);

            const debouncedApply = debounce(applyFilters, 180);

            // wire up slider controls
            if (fromSlider && toSlider) {
                // keep active thumb on top for pointer interactions
                fromSlider.addEventListener('focus', () => { fromSlider.style.zIndex = 5; toSlider.style.zIndex = 3; });
                toSlider.addEventListener('focus', () => { toSlider.style.zIndex = 5; fromSlider.style.zIndex = 3; });
                fromSlider.addEventListener('blur', () => { fromSlider.style.zIndex = ''; toSlider.style.zIndex = ''; });
                toSlider.addEventListener('blur', () => { fromSlider.style.zIndex = ''; toSlider.style.zIndex = ''; });

                fromSlider.addEventListener('input', () => {
                    // clamp: from cannot exceed to
                    const toVal = Number(toSlider.value);
                    const newFrom = Math.min(Number(fromSlider.value), toVal);
                    fromSlider.value = String(newFrom);
                    clampNoCross();
                    fillSlider(fromSlider, toSlider, SLIDER_COLOR, RANGE_COLOR, toSlider);
                    debouncedApply();
                });

                toSlider.addEventListener('input', () => {
                    // clamp: to cannot be below from
                    const fromVal = Number(fromSlider.value);
                    const newTo = Math.max(Number(toSlider.value), fromVal);
                    toSlider.value = String(newTo);
                    clampNoCross();
                    fillSlider(fromSlider, toSlider, SLIDER_COLOR, RANGE_COLOR, toSlider);
                    debouncedApply();
                });

                // Keep labels/ticks aligned on resize
                window.addEventListener('resize', () => {
                    renderTicks();
                    fillSlider(fromSlider, toSlider, SLIDER_COLOR, RANGE_COLOR, toSlider);
                });
            }

            searchInput.addEventListener('input', debounce(applyFilters, 250));

            clearFilters.addEventListener('click', clearAll);

            // respond to language changes: rebuild localized labels and lists, then re-render
            function onLanguageUpdate() {
                const lang = document.getElementById('languageSelect')?.value || 'en';
                try {
                    buildSkillsCheckboxList(skillsList, f.skills, skillsMap);
                    buildTagsCheckboxList(tagsList, f.tags, tagsMap);
                    buildCheckboxList(languageList, f.langs, 'lang');
                    buildCheckboxList(typeList, f.types.map(t => t.toLowerCase()), 'type');
                } catch (e) { /* ignore */ }
                // update sort labels/options
                const sortLabelEl = document.getElementById('sortLabel');
                if (sortLabelEl) sortLabelEl.textContent = t('sort', lang);
                if (sortSelect && sortSelect.options && sortSelect.options.length >= 2) {
                    sortSelect.options[0].text = t('newest_first', lang);
                    sortSelect.options[1].text = t('oldest_first', lang);
                }
                // rerender cards with localized titles/descriptions
                try { renderCards(filtered); } catch (e) { /* ignore */ }
            }

            document.addEventListener('languageChanged', onLanguageUpdate);
            document.addEventListener('publicationsLabelsUpdated', onLanguageUpdate);

            filtered = items.slice();
            renderCards(filtered);

            // If there's saved state in history (from opening a detail), restore filters and scroll
            try {
                const hs = history.state;
                if (hs && hs.page && hs.filters) {
                    const f = hs.filters || {};
                    if (searchInput && typeof f.q === 'string') searchInput.value = f.q;
                    const applyCheckboxes = (container, arr) => {
                        if (!container || !Array.isArray(arr)) return;
                        container.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = arr.includes(cb.value); });
                    };
                    applyCheckboxes(skillsList, f.skills);
                    applyCheckboxes(tagsList, f.tags);
                    applyCheckboxes(languageList, f.langs);
                    applyCheckboxes(typeList, f.types);
                    if (fromSlider && f.from != null) fromSlider.value = f.from;
                    if (toSlider && f.to != null) toSlider.value = f.to;
                    if (typeof f.sort !== 'undefined' && sortSelect) { sortSelect.value = f.sort; window.__pagesSortOrder = f.sort; }

                    renderTicks();
                    if (toSlider) fillSlider(fromSlider, toSlider, SLIDER_COLOR, RANGE_COLOR, toSlider);
                    updateYearSlider();
                    applyFilters();
                    if (typeof hs.scroll === 'number') window.scrollTo(0, hs.scroll || 0);
                }
            } catch (e) { /* ignore */ }
        })();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();