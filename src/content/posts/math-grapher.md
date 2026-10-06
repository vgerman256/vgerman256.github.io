---
title: "A bit of math: plotting y = f(x)"
description: "A WebGL-powered function grapher for visualizing arbitrary JS math expressions."
pubDate: 2026-07-01
draft: false
tags: ["math", "pixijs", "webgl"]
projectUrl: "/math.html"
---

A small graphing tool built on [PixiJS](https://pixijs.com/), for plotting one or more functions of `x` at once.

- Type any JavaScript expression — `Math.sin(x)`, `Math.pow(x, 3)`, `x * x` — and it's evaluated and plotted live.
- Add multiple functions, each with its own color, and toggle visibility per function.
- Pan by dragging, zoom with the scroll wheel or a pinch gesture, and the axes and grid adapt to the current scale.

Everything is saved to `localStorage`, so your functions are still there next time you visit.
