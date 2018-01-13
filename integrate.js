
/*
 * Copyright 2018 Jiří Janoušek <janousek.jiri@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation
 *  and/or other materials provided with the distribution.
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

(function (Nuvola) {
  var player = Nuvola.$object(Nuvola.MediaPlayer)
  var PlaybackState = Nuvola.PlaybackState
  var PlayerAction = Nuvola.PlayerAction
  var WebApp = Nuvola.$WebApp()

  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)
    var state = document.readyState
    if (state === 'interactive' || state === 'complete') {
      this._onPageReady()
    } else {
      document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this))
    }
  }

  WebApp._onPageReady = function () {
    Nuvola.actions.connect('ActionActivated', this)
    this._currentTime = 1
    setInterval(this.tick.bind(this), 1000)
    this.update()
  }

  WebApp.update = function () {
    try {
      var track = {
        artist: null,
        album: null,
        artLocation: null,
        rating: null,
        length: null
      }
      this.showMore()

      var elm = null
      elm = document.querySelectorAll('#container #collapsible #content .content')
      if (elm && elm.length === 3) {
        var titleAndArtist = elm[2].childNodes
        track.title = titleAndArtist[1].data
        track.artist = titleAndArtist[3].data
      } else {
        elm = document.querySelector('.ytp-title-link')
        track.title = elm ? elm.textContent || null : null
        elm = document.querySelector('#owner-name')
        track.artist = elm && elm.firstElementChild ? elm.firstElementChild.textContent || null : null
      }

      elm = document.querySelector('#meta #meta-contents #top-row a img')
      if (elm) {
        track.artLocation = elm.src || null
      }
      var trackTime = this.trackTime()
      track.length = trackTime.total
      player.setTrack(track)
      player.setTrackPosition(trackTime.now)

      var state = PlaybackState.UNKNOWN
      var buttons = this.buttons()
      if (buttons.play) {
        state = PlaybackState.PAUSED
      } else if (buttons.pause) {
        state = PlaybackState.PLAYING
      }
      var volume = this.volume()
      player.updateVolume(volume)
      player.setPlaybackState(state)
      player.setCanChangeVolume(volume !== null)
      player.setCanPlay(state !== PlaybackState.UNKNOWN && !!buttons.play)
      player.setCanPause(state !== PlaybackState.UNKNOWN && !!buttons.pause)
      player.setCanGoPrev(state !== PlaybackState.UNKNOWN && !!buttons.prev)
      player.setCanGoNext(state !== PlaybackState.UNKNOWN && !!buttons.next)
    } finally {
      setTimeout(this.update.bind(this), 500)
    }
  }

  WebApp._onActionActivated = function (emitter, name, parameter) {
    var buttons = this.buttons()
    switch (name) {
      case PlayerAction.TOGGLE_PLAY:
        Nuvola.clickOnElement(buttons.play || buttons.pause)
        this.toggleAutohide()
        break
      case PlayerAction.PLAY:
        Nuvola.clickOnElement(buttons.play)
        this.toggleAutohide()
        break
      case PlayerAction.PAUSE:
        Nuvola.clickOnElement(buttons.pause)
        this.toggleAutohide()
        break
      case PlayerAction.STOP:
        Nuvola.clickOnElement(buttons.pause)
        this.toggleAutohide()
        break
      case PlayerAction.PREV_SONG:
        Nuvola.clickOnElement(buttons.prev)
        this.toggleAutohide()
        break
      case PlayerAction.NEXT_SONG:
        Nuvola.clickOnElement(buttons.next)
        this.toggleAutohide()
        break
      case PlayerAction.SEEK:
        // This does not work!
        var trackTime = this.trackTime()
        var total = trackTime.total
        if (parameter >= 0 && parameter <= total) {
          Nuvola.clickOnElement(document.querySelector('#player-container .ytp-progress-list'), parameter / total, 0.5)
        }
        break
      case PlayerAction.CHANGE_VOLUME:
        var chromeBottom = document.querySelector('#player-container .ytp-chrome-bottom')
        if (chromeBottom) {
          var setVolume = () => {
            var volumeSlider = document.querySelector('#player-container .ytp-volume-slider')
            if (volumeSlider) {
              Nuvola.clickOnElement(volumeSlider, parameter, 0.5)
            }
            this.toggleAutohide()
          }
          if (chromeBottom.classList.contains('ytp-volume-slider-active')) {
            setVolume()
          } else {
            chromeBottom.classList.add('ytp-volume-slider-active')
            setTimeout(setVolume, 10)
          }
        }
        break
      default:
        throw Error('Action "' + name + '" not supported.')
    }
  }

  WebApp.showMore = function () {
    var elm = document.querySelector('#meta #meta-contents #more')
    if (elm && !elm.hidden) {
      Nuvola.clickOnElement(elm)
    }
    elm = document.querySelector('#meta #meta-contents #less')
    if (elm) {
      elm.hidden = true
    }
  }

  WebApp.trackTime = function () {
    var now = document.querySelector('#player-container .ytp-time-current')
    var total = document.querySelector('#player-container .ytp-time-duration')
    var time = {
      now: now ? now.textContent || null : null,
      total: total ? total.textContent || null : null
    }
    if (this.autoHidden()) {
      time.now = this._currentTime * 1000000
    } else if (time.now !== null) {
      time.now = Nuvola.parseTimeUsec(time.now)
      this._currentTime = time.now / 1000000
    }
    return time
  }

  WebApp.volume = function () {
    var elm = document.querySelector('#player-container .ytp-volume-panel')
    return elm && elm.getAttribute('aria-valuenow') !== null ? elm.getAttribute('aria-valuenow') / 100 : null
  }

  WebApp.buttons = function () {
    var buttons = {
      play: null,
      pause: null,
      prev: null,
      next: null
    }
    var elms = document.querySelector('#player-container .ytp-left-controls')
    if (elms) {
      buttons.prev = elms.querySelector('.ytp-prev-button')
      buttons.next = elms.querySelector('.ytp-next-button')
      var pp = elms.querySelector('.ytp-play-button')
      if (pp) {
        if (document.querySelector('#player-container .paused-mode')) {
          buttons.play = pp
        } else if (document.querySelector('#player-container .playing-mode')) {
          buttons.pause = pp
        }
      }
    }
    return buttons
  }

  WebApp.autoHidden = function () {
    return !!document.querySelector('#player-container .ytp-autohide')
  }

  WebApp.toggleAutohide = function () {
    setTimeout(() => {
      var elm = document.querySelector('#player-container .playing-mode')
      if (elm) {
        if (!elm.classList.contains('ytp-autohide') && !elm.classList.contains('ytp-autohide-active')) {
          elm.classList.add('ytp-autohide')
          elm.classList.add('ytp-autohide-active')
        }
      } else {
        elm = document.querySelector('#player-container .paused-mode')
        if (elm) {
          elm.classList.remove('ytp-autohide')
          elm.classList.remove('ytp-autohide-active')
        }
      }
    }, 100)
  }

  WebApp.tick = function () {
    if (this.autoHidden()) {
      this._currentTime++
    }
  }

  WebApp.start()
})(this)
