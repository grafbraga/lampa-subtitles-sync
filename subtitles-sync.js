// ==LampaPlugin==
// Name: Subtitles Sync
// Description: Plugin for loading subtitles via direct .srt links from Subadub and My-Subs
// Version: 1.0.13
// Author: grafbraga
// ==/LampaPlugin==

(function () {
    'use strict';

    if (!window.Lampa) return;

    var SubtitlesSync = {
        name: 'SubtitlesSync',
        version: '1.0.13',
        sources: {
            'Subadub': 'https://subadub.app',
            'My-Subs': 'https://my-subs.co'
        },
        defaultSource: 'My-Subs',
        languages: ['en', 'ru', 'es', 'fr', 'de'],
        selectedLang: 'en',
        selectedSource: 'My-Subs',

        init: function () {
            var _this = this;
            Lampa.Listener.follow('app', function (e) {
                if (e.type == 'ready') {
                    setTimeout(function () {
                        _this.addSettings();
                    }, 500);
                }
            });
        },

        addSettings: function () {
            var _this = this;

            Lampa.SettingsApi.addParam({
                component: 'interface',
                param: {
                    name: 'subtitles_sync_source',
                    type: 'select',
                    values: this.sources,
                    default: this.defaultSource
                },
                field: 'Источник субтитров',
                onChange: function (value) {
                    _this.selectedSource = value;
                    Lampa.Storage.set('subtitles_sync_source', value);
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'interface',
                param: {
                    name: 'subtitles_sync_lang',
                    type: 'select',
                    values: this.languages.reduce(function (result, lang) {
                        result[lang] = lang.toUpperCase();
                        return result;
                    }, {}),
                    default: this.selectedLang
                },
                field: 'Язык субтитров',
                onChange: function (value) {
                    _this.selectedLang = value;
                    Lampa.Storage.set('subtitles_sync_lang', value);
                }
            });

            this.selectedSource = Lampa.Storage.get('subtitles_sync_source', this.defaultSource);
            this.selectedLang = Lampa.Storage.get('subtitles_sync_lang', this.selectedLang);

            // Добавление в меню плеера
            Lampa.PlayerMenu.add({
                title: 'Subtitles Sync',
                subtitle: 'Load subtitles via direct links',
                icon: 'subtitles',
                action: () => this.showSubtitlesMenu()
            });
        },

        showSubtitlesMenu: function () {
            var film = Lampa.Player.data;
            if (!film || !film.movie) {
                Lampa.Noty.show('No movie data available');
                return;
            }

            var movieTitle = film.movie.title || film.movie.name;
            var movieYear = film.movie.year || '';

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

        loadSubtitlesDirect: function (title, year) {
            Lampa.Noty.show('Loading subtitles...');
            var query = encodeURIComponent(title.toLowerCase().replace(/ /g, '-'));
            var subtitlesUrl = this.selectedSource === 'Subadub' ?
                `https://subadub.app/subtitles/${query}-${this.selectedLang}.srt` :
                `https://my-subs.co/subtitles/${query}-${year}-${this.selectedLang}.srt`;

            fetch(subtitlesUrl, {
                headers: { 'Accept': 'text/plain' }
            })
                .then(response => {
                    if (!response.ok) throw new Error('HTTP error ' + response.status);
                    return response.text();
                })
                .then(srtText => {
                    this.applySubtitles(srtText);
                    Lampa.Noty.show('Subtitles loaded successfully');
                })
                .catch(e => Lampa.Noty.show('Failed to load subtitles: ' + e.message));
        },

        applySubtitles: function (srtText) {
            Lampa.Player.subtitles.add({
                label: this.selectedLang.toUpperCase() + ' - ' + this.selectedSource,
                content: this.parseSRT(srtText)
            });
        },

        parseSRT: function (srtText) {
            var lines = srtText.split('\n');
            var subtitles = [];
            var current = null;

            for (var line of lines) {
                line = line.trim();
                if (!line) continue;

                if (!isNaN(line) && !current) {
                    current = { id: parseInt(line) };
                } else if (line.includes('-->')) {
                    var [start, end] = line.split(' --> ');
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

        timeToSeconds: function (time) {
            var [hours, minutes, seconds] = time.replace(',', '.').split(':');
            return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
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
                        var reader = new FileReader();
                        reader.onload = (e) => this.applySubtitles(e.target.result);
                        reader.readAsText(files[0]);
                    }
                }
            });
        }
    };

    SubtitlesSync.init();

    if (window.Lampa && window.Lampa.Plugins) {
        window.Lampa.Plugins[SubtitlesSync.name] = SubtitlesSync;
    }
})();
