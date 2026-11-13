---
title: "Solving linear constraints over the reals: notes on an old paper"
description: "I found a paper of mine from 2010 in my archive. It describes a quantifier-eliminating solver for linear constraints over real and rational numbers, built as a subsolver inside the APS algebraic programming system. Here are the parts I still find interesting."
pubDate: 2026-11-13
draft: false
tags: ["math", "verification", "solvers", "research"]
icon: math
---

While going through my personal archive I found an old paper of mine: **"Solving Linear Constraints over Real and Rational Fields"**, published in *Cybernetics and Systems Analysis* in 2010 ([original article, DOI 10.1007/s10559-010-9239-5](https://doi.org/10.1007/s10559-010-9239-5); translated from the Russian-language journal *Kibernetika i Sistemnyi Analiz*, No. 4, 2010). I'm not even sure the copy I have is the final version, so I'm treating it as it is.

This post isn't a re-publication. It's a short tour of the parts I still find interesting, with some context that didn't fit into a journal paper.

## Some context first

The paper describes a real, working piece of software. At the time I was at the V. M. Glushkov Institute of Cybernetics in Kyiv, and the solver was part of **APS**, the Algebraic Programming System. APS programs are written in **APLAN**, a rewriting-based language, and the solver was written in it too.

APS wasn't just a playground for formulas. It sat underneath a larger inference and verification system. Specifications of a program system, written in MSC, UML, or SDL, were turned into logical formulas, and proving those formulas meant proving the specification correct. The inference system would split a big formula into typed subformulas and hand each one to the right specialist: a first-order logic prover, a Presburger arithmetic solver, an optimizer, and so on. Each solver answered with *true*, *false*, a simplified formula, or *unknown* if it ran out of time or memory.

Solvers for equalities and inequalities already existed in that pipeline, but **they worked over integers only**. The new part of this work was a solver for **real and rational** numbers. The two problems look alike, and the methods are related, but the approach differs in important ways (more on that below).

## What the solver accepts

The input is any *linear* formula built from:

- quantifiers `∀` and `∃`
- constraints `=`, `≤`, `<`, `≥`, `>`, and `≠`
- connectives `∧`, `∨`, `¬`

Here "linear" means a variable can only be multiplied by a number. The output is an equivalent formula **with no quantifiers**, in terms of the free variables only. If the input has no free variables, the output is just `true` or `false`. In other words, this is *quantifier elimination*, not only a satisfiability check, and that requirement drives most of the design.

## Why Fourier–Motzkin, and not the simplex method?

The paper surveys the usual candidates:

- **Simplex.** Fast in practice and great for "does this conjunction have a solution?" (the incremental version is useful later for simplification), but it can't eliminate a quantifier and hand you back a formula.
- **Cylindrical algebraic decomposition (CAD).** Collins' method handles even nonlinear formulas, but its cost limits real use.
- **Special-case algorithms.** For example, systems with only two variables per constraint can be solved almost in linear time, but only for that restricted form.
- **Fourier–Motzkin elimination.** Simple, general, and does exactly what's needed. The catch is superexponential worst-case growth.

The solver uses Fourier–Motzkin as its engine. Most of the paper is about keeping that growth under control.

## The top-level loop

Internally, every formula is rewritten to use only `<`, `≤`, and `∃`, using the familiar rules:

```text
∀v: f            →  ¬∃v: ¬f
∃v: (f₁ ∨ … ∨ fₙ) →  ∃v: f₁ ∨ … ∨ ∃v: fₙ
¬(f₁ ∨ … ∨ fₙ)    →  ¬f₁ ∧ … ∧ ¬fₙ
¬¬f              →  f
```

Then the solver loops:

1. turn `∀` into `∃`
2. convert to disjunctive normal form (DNF)
3. eliminate the innermost quantifier
4. simplify
5. if quantifiers remain, go back to step 2

Equalities are cheap: if a bound variable appears in an equality, it is solved for and substituted everywhere, which is one step of Gaussian elimination. Inequalities are where the work is.

## Fourier–Motzkin in one line

Fourier found the method in 1826, it was forgotten, and Dines and Motzkin rediscovered it later. To eliminate `x`, pair every lower bound with every upper bound:

```text
a ≤ bx  ∧  cx ≤ d   ⟺   a/b ≤ x ≤ d/c   →   a/b ≤ d/c
```

A small example. Eliminate `x` from:

```text
∃x:  y ≤ x  ∧  x ≤ 3  ∧  x < 2y
```

There is one lower bound (`y`) and two upper bounds (`3` and `2y`), so there are two pairs:

```text
y ≤ 3                 (≤ with ≤  gives ≤)
y < 2y,  i.e.  0 < y  (≤ with <  gives <)
```

The result is `0 < y ≤ 3`, with `x` gone. The strictness rule is the one the solver uses: two constraints of the same type give that type, and mixing strict with non-strict gives strict.

In the solver this is all done with matrices. The system `Ax ≤ b` is multiplied by a non-negative "eliminating matrix" `C` whose rows combine one positive and one negative coefficient of the chosen column, so that column of `CA` becomes zero. A separate type vector records which row is `=`, `≤`, or `<`.

The problem is growth. With `m` constraints split evenly between lower and upper bounds, one elimination step produces up to `(m/2)²` constraints, and eliminating `n` variables can give up to

```text
(m/2)^(2ⁿ)
```

constraints. Most of them are redundant, though, and that is what makes the method usable.

## Disequalities, and where reals differ from integers

`x ≠ b` is the nasty one. The naive approach rewrites it as `x < b ∨ x > b`. With ten disequalities in one conjunction, that's 2¹⁰ = 1024 branches before you've done anything useful.

Over the reals there is a much better way, from Lassez and McAloon's work on *generalized linear constraints*: **negative constraints are independent**. A conjunction of positive constraints `f` and disequalities `x₁ ≠ b₁ ∧ … ∧ xₙ ≠ bₙ` has a solution if and only if `f` together with *each single* disequality has one. Geometrically: a convex polyhedron is covered by a finite set of hyperplanes only if it lies entirely inside one of them. So you do `n` checks instead of `2ⁿ` branches.

This is exactly where integers break. Take:

```text
0 ≤ x ≤ 1  ∧  x ≠ 0  ∧  x ≠ 1
```

Over the reals, each disequality on its own is fine and so is the whole thing (`x = 0.5`). Over the integers, each disequality is satisfiable on its own, but together they aren't. The same kind of gap appears in elimination itself: over the integers the "shadow" of a polyhedron can contain points with no integer point above them. That's why integer methods such as the Omega test (itself a descendant of Fourier–Motzkin) need extra "dark" and "grey" shadows. Over the reals and rationals, plain Fourier–Motzkin is exact, and the effort goes into fighting redundancy instead.

## Fighting redundancy

This is the practical core of the paper, and the part I'd still reuse today.

**Parallel constraints.** After normalizing coefficients, two constraints that differ only in their constant can be merged. For example, `a·x + f < b₁` and `a·x + f < b₂` become `a·x + f < min(b₁, b₂)` when `a > 0`. A small table handles each mix of `=`, `≤`, and `<`, and some mixes reveal a contradiction right away. Constraints with *opposite* normals can collapse into an equality: `a·x + f ≤ b` together with `−a·x − f ≤ −b` gives `a·x + f = b`. Hashing on the normal vector makes finding parallel constraints cheap.

**The `gist` operator.** This comes from Pugh and Wonnacott. `gist p given q` is the smallest subset of `p` such that

```text
(gist p given q) ∧ q  ≡  p ∧ q
```

Put simply, it's what `p` tells you that you don't already know from `q`. The exact algorithm needs many consistency checks, so the solver first tries cheap special cases: a constraint implied by a single other constraint is dropped, and a variable that has an upper bound in `p` but none in `q` must keep one of those bounds. These often finish the job before the expensive general algorithm runs.

`gist` turns out to be a Swiss-army knife:

- **Tautology check:** if `gist p given q` is `true`, then `q ⇒ p`.
- **Simplifying disjunctions:** if `B ⇒ A`, then `A ∨ B` is just `A`.
- **Shrinking negations during DNF conversion:**

  ```text
  A ∧ ¬B  ≡  A ∧ ¬(gist B given A)
  ```

  The negated part now has as many constraints as `B` or fewer, so expanding it creates fewer branches.

On top of that, the DNF conversion checks every new conjunction for consistency and drops empty polyhedra right away, so dead branches don't multiply.

## Did it work?

Yes, on real problems. APS with this solver was used to verify models of the **Time-Triggered Protocol (TTP)**. Here is the two-node model as given in the paper, in Mathematica syntax:

```text
Resolve[ForAll[{d, p, c, newc, newp},
  ( !( (newc == -D*(c + d) - p) &&
       (newp == p + c + d) &&
       (-1 <= d) && (d <= 1) && (-M <= p) && (p <= M) &&
       (1 - M <= p + c) && (p + c <= M - 1) &&
       (-M <= c) && (c <= M) )
    || ( (1 - M <= newp + newc) && (newp + newc <= M - 1) ) )
  && (M > 1) && (D > 0) && (D <= 1)
], {M, D}, Reals]

Out = M > 1 && 2/(1 + M) <= D <= 1
```

The question is: for which values of `M` and `D` does the protocol property hold? Both Mathematica 5.2, which uses CAD, and my solver handled the two-node model.

The three-node model has 21 variables and 33 constraints. On a 2 GB machine, Mathematica 5.2 ran out of memory after a few minutes. The linear solver finished it in anywhere from a few seconds to a few minutes, depending on the timing coefficients. It was a nice moment.

To be fair, the limits were real too: no symbolic coefficients (Mathematica could keep `D` symbolic), and no proper benchmark against other solvers. Both were listed as future work.

## Where to find more

The original paper:

> V. N. German, "Solving linear constraints over real and rational fields," *Cybernetics and Systems Analysis*, vol. 46, no. 4, pp. 630–638, July 2010. Springer. DOI: [10.1007/s10559-010-9239-5](https://doi.org/10.1007/s10559-010-9239-5).
> Translated from *Kibernetika i Sistemnyi Analiz*, no. 4, pp. 123–133, July–August 2010 (submitted April 15, 2010). UDC 519.852.2.

Sadly, there's no open-source version of the solver today. A standalone build used to be on Google Code, but that's gone. If you're curious about the system around it:

- [APS & IMS downloads](https://apsystems.org.ua/index.php/downloads): builds of the Algebraic Programming System and Insertion Modeling System for Windows and Unix. The list of tools still includes Fourier–Motzkin elimination ("reallib"), alongside interfaces to omega, cvc3, and z3.
- [A paper on APS and APLAN](https://apsystems.org.ua/uploads/doc/aps/ATAC.rus.pdf) (in Russian), covering the language and its rewriting strategies.
- [A paper on insertion modeling](https://apsystems.org.ua/uploads/doc/ims/IM1.rus.pdf) (in Russian), on the modeling approach that APS-based verification grew into.
- [Lecture archive on formal verification](https://schum.kiev.ua/let/) (in Russian, 2004–2009): temporal logic, model checking, SDL/MSC, APS, and insertion modeling.

And a few references from the paper that are worth reading on their own:

- B. C. Eaves and U. G. Rothblum, "Dines–Fourier–Motzkin quantifier elimination and an application of corresponding transfer principles over ordered fields," *Math. Programming* 53 (1992).
- J.-L. Lassez and K. McAloon, "A canonical form of generalized linear constraints," *J. Symbolic Computation* 13 (1992). This is the independence of disequalities.
- J.-L. Imbert, "Variable elimination for disequations in generalized linear constraint systems," *The Computer Journal* 36(5) (1993).
- W. Pugh and D. Wonnacott, "Going beyond integer programming with the Omega test to eliminate false data dependences," *IEEE TPDS* 6(2) (1995). This is where `gist` comes from.
- G. E. Collins, "Quantifier elimination by cylindrical algebraic decomposition: twenty years of progress" (1998).

Looking back, the main lesson still holds: for quantifier elimination over the reals, the elimination step itself is the easy part. **Removing redundancy is the real work.**
