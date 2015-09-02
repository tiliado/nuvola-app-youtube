/*
 * Copyright 2015 Joel Cumberland <joel_c@zoho.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met: 
 * 
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer. 
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution. 
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
'use strict';


(function(Nuvola)
{

    // Create media player component
    var player = Nuvola.$object(Nuvola.MediaPlayer);

    // Handy aliases
    var PlaybackState = Nuvola.PlaybackState;
    var PlayerAction = Nuvola.PlayerAction;

    var vPlayer;

    // Create new WebApp prototype
    var WebApp = Nuvola.$WebApp();
    
    // Initialization routines
    WebApp._onInitWebWorker = function(emitter)
    {
        Nuvola.WebApp._onInitWebWorker.call(this, emitter);

        var state = document.readyState;

        if (state === 'interactive' || state === 'complete')
            this._onPageReady();
        else
            document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this));
    }

    // Used to inject youtube api javascript and html code
    WebApp.inject = function()
    {
        try
        {
            var tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            var firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
        catch (e)
        {
            setTimeout(this.inject.bind(this), 100);
        }
    }

    // Page is ready for magic
    WebApp._onPageReady = function()
    {
        
        // Connect handler for signal ActionActivated
        Nuvola.actions.connect('ActionActivated', this);

        // Inject the YouTube API frame (need to look into getting this to work with onYouTubeIframeAPIReady)
        // https://developers.google.com/youtube/iframe_api_reference#Loading_a_Video_Player
        this.inject();

        // Connect (check youtube player-api is loaded correctly before updating) 
        this.connect();
    }

    // This function checks if the YouTube API's are ready  
    WebApp.isYouTubePlayerAPIReady = function()
    {
        try
        {
            return (YT.loaded == 1) ? true : false;
        }
        catch (e)
        {
            console.log(Nuvola.format('{1}', e));
            return false;
        }
    }

    // Connects to the YouTube and gets the player-api element
    WebApp.connect = function()
    {
        // Need to check if vPlayer object has the functions needed to continue
        // If not retry.. 
        try
        {
            this.vPlayer = window.yt.player.getPlayerByElement('player-api');

            // Perform a basic test, check if YouTube API is loaded
            if (this.isYouTubePlayerAPIReady())
            {
                // Update
                this.update();
            }
            else
            {
                // Wait for YouTube API to load
                console.log(Nuvola.format('Still waiting for YouTube API to load'));
                setTimeout(this.connect.bind(this), 500);
            }
        }
        catch (e)
        {
            console.log(Nuvola.format('{1}', e));
        }
        finally
        {
            // Show properties in log file
            for (var check in this.vPlayer)
                console.log(Nuvola.format('vPlayer loaded property {1}', check));
        }

    }

   // Extract data from the web pagedevice_options
    WebApp.update = function()
    {
       	var song = null;
       	var artist = null;
        var category = null;
        var playBtn = null;
        var pauseBtn = null;
        var state = null;
        
        try
        {
            if (document.readyState == 'complete')
                category = document.getElementById('watch-description').getElementsByClassName('title')[0].innerText;
            
                if (category == "Music")
                {
                    var artistMetadata = document.getElementById('watch-description').getElementsByClassName('content watch-info-tag-list')[0].innerText;
                    song = artistMetadata.match('"(.*)"');
                    song = song[0].replace(/"/g, '');
                    artist = artistMetadata.match(/by(.*?)\(/);
                    artist = artist[0].replace('by', '').replace('(', '');
                }
            
            var track = {
                title: song,
                artist: artist,
                album: null, //TODO: Find out a way to get album info
                artLocation: window.ytplayer.config.args.iurl
            }

            player.setTrack(track);

            if (this.isYouTubePlayerAPIReady())
            {
                playBtn = (this.vPlayer.getPlayerState() === YT.PlayerState.PLAYING) ? false : true;
                pauseBtn = (this.vPlayer.getPlayerState() === YT.PlayerState.PAUSED) ? false : true;
                state = playBtn ? PlaybackState.PAUSED : (pauseBtn ? PlaybackState.PLAYING : PlaybackState.UNKNOWN);
            }

            player.setPlaybackState(state);
            player.setCanPlay(playBtn);
            player.setCanPause(pauseBtn);
            player.setCanGoNext(true);
            player.setCanGoPrev(true);
        }
        catch (e)
        {
            // We know category can return an error, if not found. This may be due the user being on the home page and no watch-description element exist
            // In this case we ignore this error, but take other errors more seriously.
            (category == null) ? false: console.log(Nuvola.format('{1}', e));
        }
        finally
        {
            // Schedule the next update
            setTimeout(this.update.bind(this), 500);
        }
    }


    // A Handler in case we need to do anything during a navigation request e.g. update user data etc
    WebApp._onNavigationRequest = function(object, request)
    {
        console.log(Nuvola.format('called onNavigationRequest()'));
    }

    // Handler of playback actions
    WebApp._onActionActivated = function(emitter, name, param)
    {
        try
        {
            switch (name)
            {
                case PlayerAction.PLAY:
                    this.vPlayer.playVideo();
                    break;
                case PlayerAction.PAUSE:
                    this.vPlayer.pauseVideo();
                    break;
                case PlayerAction.STOP:
                    this.vPlayer.stopVideo();
                    break;
                case PlayerAction.TOGGLE_PLAY:
                    (this.vPlayer.getPlayerState() == YT.PlayerState.PLAYING) ? this.vPlayer.pauseVideo(): this.vPlayer.playVideo()
                    break;
                case PlayerAction.PREV_SONG:
                    this.vPlayer.previousVideo();
                    break;
                case PlayerAction.NEXT_SONG:
                    this.vPlayer.nextVideo();
                    break;
                default:
                    // Other commands are not supported
                    throw {
                        'message': 'Not supported.'
                    };
            }
        }
        catch (e)
        {
            console.log(Nuvola.format('{1}'), e);
        }
    }

WebApp.start();

})(this); // function(Nuvola)
