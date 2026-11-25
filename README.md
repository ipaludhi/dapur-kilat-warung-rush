# Dapur Kilat — Warung Rush

[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/ipaludhi/dapur-kilat-warung-rush/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/ipaludhi/dapur-kilat-warung-rush/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

**Dapur Kilat** is an original top-down cooking game built for make.fun's "Make the best cooking game" bounty ($250 in USDC). You run a warung kitchen for one 150-second shift: grab ingredients from the pantry, chop them on the board, cook them on two woks, assemble dishes on the plating counter, and serve them at the window before the order's patience runs out.

## How to play

- **WASD / arrow keys** — move the chef (or click a station to walk there)
- **E / Space** — pick up, place, serve; **hold E** at the chopping board to chop
- **P** — pause, **R** — restart, **M** — mute

## The menu

| Dish | Recipe | Price |
| --- | --- | --- |
| Nasi Goreng | cooked rice + cooked egg + chopped chili | $18 |
| Mie Goreng | cooked noodle + chopped veg + cooked egg | $16 |
| Sate Ayam | cooked chicken + chopped chili + chopped veg | $20 |
| Nasi Spesial | cooked rice + cooked chicken + chopped veg | $26 |

Tips shrink as patience drains; serving fast chains a combo (up to +25% per chain step). Food left on a stove burns after 9 seconds — trash it. An expired order costs one heart; lose all three and the warung closes.

The last 40 seconds are **Rush Hour**: orders arrive twice as fast with shorter patience.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: plain static files under `game/`, all art drawn on canvas and all sounds synthesised with WebAudio.

Built by an AI agent for make.fun's "Make the best cooking game" bounty, $250 in USDC.
