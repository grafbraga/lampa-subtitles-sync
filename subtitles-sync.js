// ==LampaPlugin==
// Name: Subtitles Sync
// Description: Плагин для поиска и синхронизации субтитров из открытых источников
// Version: 1.0.1
// Author: grafbraga
// ==/LampaPlugin==

(function () {
    'use strict';

    // Основной объект плагина
    const SubtitlesSync = {
        name: 'SubtitlesSync',
        version: '1.0.1',
        sources: {
            'Subadub': 'https://subadub.app',
            'Subscene': 'https://subscene.com',
            'GetSubad': 'https://getsubad.com'
        },
        defaultSource: 'Subscene',
        languages: ['en', 'ru', 'es', 'fr', 'de'],
        selectedLang: 'en',
        selectedSource: 'Subscene',

        // Инициализация плагина
        init: function () {
            this.addSettings();
            this.injectMenu();
            Lampa.Listener.follow('player', this.onPlayer.bind(this));
        },

        // Добавление настроек в интерфейс Lampa
        addSettings: function () {
            const settings = Lampa.Settings;
            settings.add(this.name, {
                subtitles_source: {
                    name: 'Источник субтитров',
                    type: 'select',
                    values: this.sources,
                    default: this.defaultSource,
                    onChange: (value) => {
                        this.selectedSource = value;
                        Lampa.Storage.set('subtitles_source', value);
                    }
                },
                subtitles_lang: {
                    name: 'Язык субтитров',
                    type: 'select',
                    values: this.languages.reduce((acc, lang) => {
                        acc[lang] = lang.toUpperCase();
                        return acc;
                    }, {}),
                    default: this.selectedLang,
                    onChange: (value) => {
                        this.selectedLang = value;
                        Lampa.Storage.set('subtitles_lang', value);
                    }
                }
            });

            // Загрузка сохранённых настроек
            this.selectedSource = Lampa.Storage.get('subtitles_source', this.defaultSource);
            this.selectedLang = Lampa.Storage.get('subtitles_lang', this.selectedLang);
        },

        // Вставка пункта меню в плеер
        injectMenu: function () {
            const menu = Lampa.PlayerMenu;
            menu.add({
                title: 'Subtitles Sync',
                subtitle: 'Поиск и синхронизация субтитров',
                icon: 'subtitles',
                action: () => this.showSubtitlesMenu()
            });
        },

        // Отображение меню выбора субтитров
        showSubtitlesMenu: function () {
            const film = Lampa.Player.data;
            if (!film || !film.movie) return Lampa.Noty.show('Нет данных о фильме');

            const movieTitle = film.movie.title || film.movie.name;
            const movieYear = film.movie.year || '';

            Lampa.Select.show({
                title: 'Субтитры для: ' + movieTitle,
                items: [
                    { title: 'Найти субтитры', action: 'search' },
                    { title: 'Загрузить вручную', action: 'manual' }
                ],
                onSelect: (item) => {
                    if (item.action === 'search') this.searchSubtitles(movieTitle, movieYear);
                    else if (item.action === 'manual') this.manualUpload();
                }
            });
        },

        // Поиск субтитров
        searchSubtitles: async function (title, year) {
            Lampa.Noty.show('Поиск субтитров...');
            const query = encodeURIComponent(`${title} ${year} ${this.selectedLang}`);
            const sourceUrl = this.sources[this.selectedSource];
            let subtitlesUrl;

            if (this.selectedSource === 'Subadub') {
                subtitlesUrl = `${sourceUrl}/search?q=${query}`;
            } else if (this.selectedSource === 'Subscene') {
                subtitlesUrl = `${sourceUrl}/subtitles/searchbytitle?query=${query}`;
            } else if (this.selectedSource === 'GetSubad') {
                subtitlesUrl = `${sourceUrl}/search?query=${query}`;
            }

            try {
                const response = await fetch(subtitlesUrl);
                const text = await response.text();
                const subtitles = await this.parseSubtitles(text, this.selectedSource);

                if (subtitles.length) {
                    this.showSubtitlesList(subtitles);
                } else {
                    Lampa.Noty.show('Субтитры не найдены');
                }
            } catch (e) {
                Lampa.Noty.show('Ошибка при поиске субтитров: ' + e.message);
            }
        },

        // Парсинг субтитров в зависимости от источника
        parseSubtitles: async function (html, source) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const subtitles = [];

            if (source === 'Subadub') {
                const links = doc.querySelectorAll('a[href*=".srt"]');
                links.forEach(link => {
                    subtitles.push({ title: link.textContent.trim(), url: link.href });
                });
            } else if (source === 'Subscene') {
                const links = doc.querySelectorAll('a[href*="/subtitles/"]');
                for (let link of links) {
                    const title = link.textContent.trim();
                    const href = `https://subscene.com${link.getAttribute('href')}`;
                    const subPage = await fetch(href).then(res => res.text());
                    const subDoc = parser.parseFromString(subPage, 'text/html');
                    const downloadLink = subDoc.querySelector('a[href*="/subtitle/download"]');
                    if (downloadLink) {
                        subtitles.push({ title, url: downloadLink.href });
                    }
                }
            } else if (source === 'GetSubad') {
                const links = doc.querySelectorAll('a[href*=".srt"]');
                links.forEach(link => {
                    subtitles.push({ title: link.textContent.trim(), url: link.href });
                });
            }

            return subtitles.slice(0, 5); // Ограничение на 5 результатов
        },

        // Отображение списка найденных субтитров
        showSubtitlesList: function (subtitles) {
            Lampa.Select.show({
                title: 'Выберите субтитры',
                items: subtitles.map(sub => ({ title: sub.title })),
                onSelect: (item) => {
                    const selected = subtitles.find(sub => sub.title === item.title);
                    this.loadSubtitles(selected.url);
                }
            });
        },

        // Загрузка субтитров
        loadSubtitles: async function (url) {
            try {
                const response = await fetch(url);
                const srtText = await response.text();
                this.applySubtitles(srtText);
                Lampa.Noty.show('Субтитры загружены');
            } catch (e) {
                Lampa.Noty.show('Ошибка загрузки субтитров: ' + e.message);
            }
        },

        // Применение субтитров к плееру
        applySubtitles: function (srtText) {
            const player = Lampa.Player;
            player.subtitles.add({
                label: `${this.selectedLang.toUpperCase()} - ${this.selectedSource}`,
                content: this.parseSRT(srtText)
            });
        },

        // Парсинг SRT формата
        parseSRT: function (srtText) {
            const lines = srtText.split('\n');
            const subtitles = [];
            let current = null;

            for (let line of lines) {
                line = line.trim();
                if (!line) continue;

                if (!isNaN(line) && !current) {
                    current = { id: parseInt(line) };
                } else if (line.includes('-->')) {
                    const [start, end] = line.split(' --> ');
                    current.start = this.timeToSeconds(start);
                    current.end = this.timeToSeconds(end);
                } else if (current && !current.text) {
                    current.text = line;
                    subtitles.push(current);
                    current = null;
                }
            }

            return subtitles;
        },

        // Преобразование времени SRT в секунды
        timeToSeconds: function (time) {
            const [hours, minutes, seconds] = time.replace(',', '.').split(':');
            return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
        },

        // Ручная загрузка субтитров
        manualUpload: function () {
            Lampa.File.upload({
                accept: '.srt,.sub',
                callback: (files) => {
                    if (files.length) {
                        const reader = new FileReader();
                        reader.onload = (e) => this.applySubtitles(e.target.result);
                        reader.readAsText(files[0]);
                    }
                }
            });
        },

        // Обработка событий плеера
        onPlayer: function (e) {
            if (e.type === 'start') {
                // Можно добавить автоматический поиск субтитров при старте
            }
        }
    };

    // Запуск плагина
    SubtitlesSync.init();

    // Регистрация плагина в Lampa
    if (window.Lampa) {
        window.Lampa.Plugins = window.Lampa.Plugins || {};
        window.Lampa.Plugins[SubtitlesSync.name] = SubtitlesSync;
    }
})();