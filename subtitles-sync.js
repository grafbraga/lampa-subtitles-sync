// ==LampaPlugin==
// Name: Subtitles Sync
// Description: Plugin for loading subtitles via direct .srt links from Subadub and My-Subs
// Version: 1.0.6
// Author: grafbraga
// ==/LampaPlugin==

(function () {
    'use strict';

    if (!window.Lampa) {
        console.error('[SubtitlesSync] Lampa environment not found');
        return;
    }

    const SubtitlesSync = {
        name: 'SubtitlesSync',
        version: '1.0.6',
        sources: {
            'Subadub': 'https://subadub.app',
            'My-Subs': 'https://my-subs.co'
        },
        defaultSource: 'My-Subs',
        languages: ['en', 'ru', 'es', 'fr', 'de'],
        selectedLang: 'en',
        selectedSource: 'My-Subs',

        init: function () {
            if (!Lampa.Settings || !Lampa.PlayerMenu || !Lampa.Player || !Lampa.Menu) {
                console.error('[SubtitlesSync] Required Lampa modules not found');
                return;
            }
            this.addSettings();
            this.injectPlayerMenu();
            this.injectMainMenu(); // Добавляем пункт в основное меню
            Lampa.Listener.follow('player', this.onPlayer.bind(this));
            console.log('[SubtitlesSync] Plugin initialized');
        },

        // Добавление настроек
        addSettings: function () {
            Lampa.Settings.add(this.name, {
                subtitles_source: {
                    name: 'Subtitles Source',
                    type: 'select',
                    values: this.sources,
                    default: this.defaultSource,
                    onChange: (value) => {
                        this.selectedSource = value;
                        Lampa.Storage.set('subtitles_source', value);
                        console.log('[SubtitlesSync] Source changed to:', value);
                    }
                },
                subtitles_lang: {
                    name: 'Subtitles Language',
                    type: 'select',
                    values: this.languages.reduce((acc, lang) => {
                        acc[lang] = lang.toUpperCase();
                        return acc;
                    }, {}),
                    default: this.selectedLang,
                    onChange: (value) => {
                        this.selectedLang = value;
                        Lampa.Storage.set('subtitles_lang', value);
                        console.log('[SubtitlesSync] Language changed to:', value);
                    }
                }
            });

            this.selectedSource = Lampa.Storage.get('subtitles_source', this.defaultSource);
            this.selectedLang = Lampa.Storage.get('subtitles_lang', this.selectedLang);
        },

        // Добавление пункта в меню плеера
        injectPlayerMenu: function () {
            Lampa.PlayerMenu.add({
                title: 'Subtitles Sync',
                subtitle: 'Load subtitles via direct links',
                icon: 'subtitles',
                action: () => this.showSubtitlesMenu()
            });
        },

        // Добавление пункта в основное меню Lampa
        injectMainMenu: function () {
            Lampa.Menu.add({
                title: 'Subtitles Sync Settings',
                subtitle: 'Configure subtitles source and language',
                icon: 'settings',
                action: () => {
                    Lampa.Settings.show({
                        category: this.name,
                        title: 'Subtitles Sync Settings'
                    });
                }
            });
        },

        // Меню субтитров в плеере
        showSubtitlesMenu: function () {
            const film = Lampa.Player.data;
            if (!film || !film.movie) {
                Lampa.Noty.show('No movie data available');
                return;
            }

            const movieTitle = film.movie.title || film.movie.name;
            const movieYear = film.movie.year || '';

            Lampa.Select.show({
                title: 'Subtitles for: ' + movieTitle,
                items: [
                    { title: 'Load Subtitles', action: 'search' },
                    { title: 'Load Manually', action: 'manual' }
                ],
                onSelect: (item) => {
                    if (item.action === 'search') this.loadSubtitlesDirect(movieTitle, movieYear);
                    else if (item.action === 'manual') this.manualUpload();
                }
            });
        },

        // Загрузка субтитров по прямым ссылкам
        loadSubtitlesDirect: function (title, year) {
            Lampa.Noty.show('Loading subtitles...');
            const query = encodeURIComponent(title.toLowerCase().replace(/ /g, '-'));
            let subtitlesUrl;

            if (this.selectedSource === 'Subadub') {
                subtitlesUrl = `https://subadub.app/subtitles/${query}-${this.selectedLang}.srt`;
            } else if (this.selectedSource === 'My-Subs') {
                subtitlesUrl = `https://my-subs.co/subtitles/${query}-${year}-${this.selectedLang}.srt`;
            }

            console.log('[SubtitlesSync] Fetching direct link:', subtitlesUrl);

            fetch(subtitlesUrl, {
                headers: {
                    'Accept': 'text/plain'
                }
            })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
                    return response.text();
                })
                .then(srtText => {
                    this.applySubtitles(srtText);
                    Lampa.Noty.show('Subtitles loaded successfully');
                })
                .catch(e => {
                    console.error('[SubtitlesSync] Load error:', e);
                    Lampa.Noty.show('Failed to load subtitles: ' + e.message);
                });
        },

        // Применение субтитров
        applySubtitles: function (srtText) {
            const player = Lampa.Player;
            player.subtitles.add({
                label: `${this.selectedLang.toUpperCase()} - ${this.selectedSource}`,
                content: this.parseSRT(srtText)
            });
        },

        // Парсинг SRT
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

        // Преобразование времени в секунды
        timeToSeconds: function (time) {
            const [hours, minutes, seconds] = time.replace(',', '.').split(':');
            return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
        },

        // Ручная загрузка субтитров
        manualUpload: function () {
            if (!Lampa.File) {
                Lampa.Noty.show('File upload not supported');
                return;
            }
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

        // События плеера
        onPlayer: function (e) {
            if (e.type === 'start') {
                // Автоматическая загрузка может быть добавлена позже
            }
        }
    };

    try {
        SubtitlesSync.init();
        window.Lampa.Plugins = window.Lampa.Plugins || {};
        window.Lampa.Plugins[SubtitlesSync.name] = SubtitlesSync;
        console.log('[SubtitlesSync] Plugin loaded successfully');
    } catch (e) {
        console.error('[SubtitlesSync] Initialization error:', e);
        Lampa.Noty.show('Plugin initialization failed');
    }
})();
