// ==LampaPlugin==
// Name: Subtitles Sync
// Description: Plugin for loading subtitles via direct .srt links from Subadub and My-Subs
// Version: 1.0.14
// Author: Grok3-xAI
// ==/LampaPlugin==

(function () {
    'use strict';

    if (!window.Lampa) return;

    var SubtitlesSync = {
        name: 'SubtitlesSync',
        version: '1.0.14',
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
                        if (Lampa.Noty) Lampa.Noty.show('Subtitles Sync: App ready');
                        _this.addSettings();
                    }, 500);
                }
            });
        },

        addSettings: function () {
            var _this = this;

            // Добавление в меню настроек
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
            if (Lampa.PlayerMenu) {
                Lampa.PlayerMenu.add({
                    title: 'Subtitles Sync',
                    subtitle: 'Load subtitles via direct links',
                    icon: 'subtitles',
                    action: function () {
                        Lampa.Noty.show('Subtitles Sync: Menu clicked');
                    }
                });
            }
        }
    };

    SubtitlesSync.init();

    if (window.Lampa && window.Lampa.Plugins) {
        window.Lampa.Plugins[SubtitlesSync.name] = SubtitlesSync;
    }
})();
