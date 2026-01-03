(function () {
    // prevent double-initialization when this file is loaded multiple times
    if (window.__projectsUiInitialized) return;
    window.__projectsUiInitialized = true;

    document.addEventListener('DOMContentLoaded', () => {
        const projectsContainer = document.getElementById('projects-container');

        const langSelector = document.getElementById('languageSelect');
        if (langSelector) {
            langSelector.addEventListener('change', (event) => {
                const selectedLang = event.target.value;
                // Use the global translations registry without overwriting it
                translatePage(selectedLang);
                // Refresh projects to localized values
                fetchAndDisplayProjects(selectedLang);
            });
        }

        // Fetch and display projects (prefer local data file)
        fetch('/data/projects.json')
            .then(response => response.json())
            .then(projects => {
                displayProjects(projects);
            })
            .catch(() => {
                // fallback to API endpoint if local file isn't present
                return fetch('/api/projects').then(response => response.json()).then(projects => displayProjects(projects)).catch(() => { });
            });

        /**
         * @brief Displays projects in the container.
         * @param {Array} projects - List of project objects.
         * @return {void}
         * @public
         */
        function displayProjects(projects) {
            if (!projectsContainer) return;
            projectsContainer.innerHTML = '';
            projects.forEach(project => {
                const projectCard = document.createElement('div');
                projectCard.className = 'project-card';
                // Ensure safe access to localized values (project may already be localized)
                const imgSrc = (typeof project.image === 'object') ? (project.image['en'] || Object.values(project.image)[0]) : project.image;
                const titleText = (typeof project.title === 'object') ? (project.title['en'] || Object.values(project.title)[0]) : project.title;
                const descText = (typeof project.description === 'object') ? (project.description['en'] || Object.values(project.description)[0]) : project.description;

                projectCard.innerHTML = `
                    <img src="${imgSrc}" alt="${titleText}">
                    <h3>${titleText}</h3>
                    <p>${descText}</p>
                    <p><strong>Tags:</strong> ${project.tags ? project.tags.join(', ') : ''}</p>
                    <p><strong>Language:</strong> ${project.language || ''}</p>
                    <p><strong>Topic:</strong> ${project.topic || ''}</p>
                `;
                projectsContainer.appendChild(projectCard);
            });
        }

        /**
         * @brief Fetches and displays projects based on the selected language.
         * @param {string} lang - The selected language code.
         * @return {void}
         * @public
         */
        function fetchAndDisplayProjects(lang) {
            fetch('/data/projects.json')
                .then(response => response.json())
                .then(projects => {
                    const localizedProjects = projects.map(project => {
                        const copy = Object.assign({}, project);
                        if (copy.title && typeof copy.title === 'object') {
                            copy.title = copy.title[lang] || copy.title['en'] || Object.values(copy.title)[0];
                        }
                        if (copy.description && typeof copy.description === 'object') {
                            copy.description = copy.description[lang] || copy.description['en'] || Object.values(copy.description)[0];
                        }
                        if (copy.image && typeof copy.image === 'object') {
                            copy.image = copy.image[lang] || copy.image['en'] || Object.values(copy.image)[0];
                        }
                        return copy;
                    });
                    displayProjects(localizedProjects);
                })
                .catch(() => {
                    // fallback to API endpoint
                    return fetch('/api/projects').then(response => response.json()).then(projects => {
                        const localizedProjects = projects.map(project => {
                            const copy = Object.assign({}, project);
                            if (copy.title && typeof copy.title === 'object') {
                                copy.title = copy.title[lang] || copy.title['en'] || Object.values(copy.title)[0];
                            }
                            if (copy.description && typeof copy.description === 'object') {
                                copy.description = copy.description[lang] || copy.description['en'] || Object.values(copy.description)[0];
                            }
                            if (copy.image && typeof copy.image === 'object') {
                                copy.image = copy.image[lang] || copy.image['en'] || Object.values(copy.image)[0];
                            }
                            return copy;
                        });
                        displayProjects(localizedProjects);
                    }).catch(() => { });
                });
        }

        // Initialize with default language
        fetchAndDisplayProjects('en');
    });
})();
