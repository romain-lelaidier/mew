# mew
A minimal YouTube player server.

## Overview

The idea of this project came as I was sniffing my browser's HTTP requests when playing YouTube Music. Unlike most other music providers, YouTube does not encrypt or restrict audio files access, but instead protects this data by using complicated URLs (1000+ characters). As long as you know this long URL for a song, you can play the song directly, whithout authentication or decryption.

Everytime you play a YouTube video, your browser passes through complex JavaScript challenges that ultimately lead to the URL of the wanted resource (video or audio stream). Mew's API does exactly the same: **download and execute JavaScript challenges, and send the resource URL to the client**. Mew fastens your YouTube navigation because it does not load all of the auxiliary scripts that your browser is forced to execute: Google-specific scripts, comments, subtitles, liking a song, etc. In total, Mew's API only loads less than `2Mb/song` of data, whereas a browser takes up to `12Mb` of data to before it even loads the song. And, because the client only needs a song's data (title, artists, albums, duration, etc.) and audio URL, the average trafic load for loading a song on Mew is `3kb`. This drastically **fastens and enhances the navigation experience** compared to the one of YouTube.

## Project structure
This project has three core parts:
- A RESTful API, implemented by a node.js server, that provides:
  - navigation on YouTube or Last.fm (search, album, artist)
  - song extraction on YouTube (getting the song's info and audio URL)
  - song conversion to MP3 using FFMPEG
  - user management (NoSQL, MongoDB-based) and playlists
- A modern Web interface, based on SolidJS
- A Flutter application (not on this repository)
