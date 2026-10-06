---
title: "Can you beat a chess robot?"
description: "A chess game in two flavors: a native C++/Qt desktop app, and a browser version against Stockfish you can play right on this site."
pubDate: 2026-07-01
draft: false
tags: ["chess", "games", "wasm", "cpp", "qt"]
projectUrl: "/chess/"
---

This project comes in two flavors: a native desktop app written in C++ with Qt, and a JavaScript version you can play instantly, right here on the site.

## Play it in your browser

A full chess board rendered on canvas, playable against [Stockfish](https://stockfishchess.org/) compiled to WebAssembly and running entirely in your browser — no server round-trips for moves.

- Adjustable engine difficulty, from 0 to 20.
- Full move history and captured-piece tracking alongside the board.
- Pawn promotion, undo, and surrender flows, all handled client-side.

[Play chess now →](/chess/)

## The original C++/Qt version

The project started life as a native Qt chess UI written in C++, before being ported to the browser. [See the C++ code on GitHub](https://github.com/novaua/qt-chess).

<iframe
    src="https://www.youtube-nocookie.com/embed/hlW6xv23fN4"
    title="Chess C++/Qt desktop app gameplay demo"
    loading="lazy"
    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    referrerpolicy="strict-origin-when-cross-origin"
    allowfullscreen
></iframe>

Gameplay demo of the desktop app. [Watch on YouTube](https://www.youtube.com/watch?v=hlW6xv23fN4)

## Where it all started

For comparison, here's an early video of one of the first working versions of the desktop app:

<iframe
    src="https://www.youtube-nocookie.com/embed/pBiuGpj8seQ"
    title="Chess++ program gameplay, an early version of the desktop app"
    loading="lazy"
    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    referrerpolicy="strict-origin-when-cross-origin"
    allowfullscreen
></iframe>

"Chess++ program gameplay", the early version. [Watch on YouTube](https://www.youtube.com/watch?v=pBiuGpj8seQ)
