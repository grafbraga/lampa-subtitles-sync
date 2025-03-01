// ==LampaPlugin==
// Name: Subtitles Sync
// Description: Plugin for auto-generating subtitles using Web Speech API
// Version: 1.0.15
// Author: grafbraga
// ==/LampaPlugin==

(function () {
    'use strict';

    if (!window.Lampa) return;

    var SubtitlesSync = {
        name: 'SubtitlesSync',
        version: '1.0.15',
        recognition: null,
        subtitles: [],

        init: function () {
            var _this = this;

            // Инициализация Web Speech API
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                this.recognition = new SpeechRecognition();
                this.recognition.continuous = true;
                this.recognition.interimResults = true;
                this.recognition.lang = 'en-US'; // По умолчанию английский, можно изменить в будущем
                
                this.recognition.onresult = function (event) {
                    var transcript = '';
                    for (var i = event.resultIndex; i < event.results.length; i++) {
                        transcript += event.results[i][0].transcript;
                    }
                    _this.addSubtitle(transcript);
                };

                this.recognition.onerror = function (event) {
                    Lampa.Noty.show('Speech recognition error: ' + event.error);
                };
            } else {
                Lampa.Noty.show('Web Speech API not supported in this browser');
                return;
            }

            // Отложенная инициализация после готовности приложения
            Lampa.Listener.follow('app', function (e) {
                if (e.type == 'ready') {
                    setTimeout(function () {
                        _this.setupPlayer();
                    }, 500);
                }
            });
        },

        setupPlayer: function () {
            var _this = this;

            // Добавление пункта в меню плеера
            if (Lampa.PlayerMenu) {
                Lampa.PlayerMenu.add({
                    title: 'Subtitles Sync',
                    subtitle: 'Generate subtitles automatically',
                    icon: 'subtitles',
                    action: function () {
                        _this.startRecognition();
                    }
                });
            }

            Lampa.Listener.follow('player', function (e) {
                if (e.type == 'start') {
                    _this.subtitles = []; // Очистка субтитров при новом видео
                }
            });
        },

        startRecognition: function () {
            if (this.recognition) {
                this.subtitles = [];
                this.recognition.start();
                Lampa.Noty.show('Started generating subtitles...');
            }
        },

        addSubtitle: function (text) {
            var player = Lampa.Player;
            var currentTime = player.time();

            this.subtitles.push({
                start: currentTime,
                end: currentTime + 2, // Предполагаемая длительность 2 секунды
                text: text
            });

            player.subtitles.add({
                label: 'Auto-Generated',
                content: this.subtitles
            });
        }
    };

    SubtitlesSync.init();

    if (window.Lampa && window.Lampa.Plugins) {
        window.Lampa.Plugins[SubtitlesSync.name] = SubtitlesSync;
    }
})();
