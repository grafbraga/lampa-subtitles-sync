// ==LampaPlugin==
// Name: Subtitles Sync
// Description: Plugin for loading subtitles via direct .srt links from Subadub and My-Subs
// Version: 2.0.0
// Author: grafbraga
// ==/LampaPlugin==

(function () {
    'use strict';

    if (!window.Lampa) {
        console.error('[SubtitlesSync] Lampa environment not found');
        return;
    }

    const PROXY_URL = 'https://api.allorigins.win/raw?url='; // Надёжный CORS-прокси
    const SubtitlesSync = {
        name: 'SubtitlesSync',
        version: '2.0.0',
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
            this.loadStoredSettings();
            this.addSettings();
            this.injectPlayerMenu();
            this.injectMainMenu();
            Lampa.Listener.follow('player', this.onPlayer.bind(this));
            console.log('[SubtitlesSync] Plugin initialized');
        },

        loadStoredSettings: function () {
            this.selectedSource = Lampa.Storage.get('subtitles_source', this.defaultSource);
            this.selectedLang = Lampa.Storage.get('subtitles_lang', this.selectedLang);
        },

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
        },

        injectPlayerMenu: function () {
            Lampa.PlayerMenu.add({
                title: 'Subtitles Sync',
                subtitle: 'Load subtitles via direct links',
                icon: 'subtitles',
                action: () => this.showSubtitlesMenu()
            });
        },

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

        showSubtitlesMenu: function () {
            const film = Lampa.Player.data;
            if (!film || !film.movie) {
                Lampa.Noty.show('No movie data available');
                return;
            }

            Lampa.Select.show({
                title: 'Subtitles for: ' + film.movie.title,
                items: [
                    { title: 'Load Subtitles', action: 'search' },
                    { title: 'Load Manually', action: 'manual' }
                ],
                onSelect: (item) => {
                    if (item.action === 'search') this.loadSubtitles(film.movie.title, film.movie.year);
                    else if (item.action === 'manual') this.manualUpload();
                }
            });
        },

        loadSubtitles: function (title, year) {
            Lampa.Noty.show('Loading subtitles...');
            const query = encodeURIComponent(title.toLowerCase().replace(/ /g, '-'));
            let subtitlesUrl = this.selectedSource === 'Subadub'
                ? `${this.sources.Subadub}/subtitles/${query}-${this.selectedLang}.srt`
                : `${this.sources['My-Subs']}/subtitles/${query}-${year}-${this.selectedLang}.srt`;

            console.log('[SubtitlesSync] Fetching subtitles from:', subtitlesUrl);

            fetch(PROXY_URL + subtitlesUrl)
                .then(response => response.ok ? response.text() : Promise.reject(`HTTP error ${response.status}`))
                .then(srtText => {
                    this.applySubtitles(srtText);
                    Lampa.Noty.show('Subtitles loaded successfully');
                })
                .catch(e => {
                    console.error('[SubtitlesSync] Load error:', e);
                    Lampa.Noty.show('Failed to load subtitles: ' + e);
                });
        },

        applySubtitles: function (srtText) {
            Lampa.Player.subtitles.add({
                label: `${this.selectedLang.toUpperCase()} - ${this.selectedSource}`,
                content: srtText
            });
        },

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

        onPlayer: function (e) {
            if (e.type === 'start') {
                console.log('[SubtitlesSync] Player started');
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
