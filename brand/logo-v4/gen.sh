#!/bin/zsh
# usage: gen.sh name "prompt" — one image via Codex's image tool, saved as <name>.png
cd ~/Documents/vibecoding/teampot/brand/logo-v4
STYLE="Presentation: a 2x2 grid of FOUR distinct symbol variations of this one idea, each centred in its own cell on a warm off-white #F6F4F0 background, generous margins, small grey caption under each is NOT allowed (no text at all). Craft: flat vector logo symbols only, solid ink #141414 with at most one accent of clay #E8552D, no gradients, no shadows, no 3D, no textures, no mockups, no letters or words. Quality bar: the school of Paul Rand and Chermayeff & Geismar & Haviv; as simple as the Nike swoosh, Stripe's 2025 diagonal-line mark, the Mastercard circles or the FedEx arrow. Each symbol must be drawable from memory in three seconds, distinctive, and still readable at 16 px. Avoid clichés: arrows pointing up, coins, piggy banks, shields, globes, people icons, org-chart boxes, trees, honeycombs, pie charts."
codex exec -m gpt-5.5 --skip-git-repo-check --sandbox workspace-write -C ~/Documents/vibecoding/teampot/brand/logo-v4 "Use your image generation tool to create ONE image, then copy the generated file to $1.png in the current directory. Do not create or edit any other files.

Brand: Teampot, an app where every team in a company runs its own money: Finance sets the frame, each department decides for itself, and the whole company stays in balance. Calm, confident, modern, grown-up.

Symbol idea: $2

$STYLE" < /dev/null > $1.log 2>&1
