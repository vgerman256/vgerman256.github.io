---
title: "Can you beat a chess robot?"
description: "A browser chess game with a Stockfish-powered engine opponent, playable right in this site."
pubDate: 2026-07-01
draft: false
tags: ["chess", "games", "wasm"]
projectUrl: "/chess/"
---

A full chess board rendered on canvas, playable against [Stockfish](https://stockfishchess.org/) compiled to WebAssembly and running entirely in your browser — no server round-trips for moves.

- Adjustable engine difficulty, from 0 to 20.
- Full move history and captured-piece tracking alongside the board.
- Pawn promotion, undo, and surrender flows, all handled client-side.

This started life as a native Qt chess UI — [see the original C++ code](https://github.com/novaua/qt-chess) — before being ported to the browser.

[Play chess now →](/chess/)
