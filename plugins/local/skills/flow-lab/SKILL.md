---
name: flow-lab
description: Start, switch or stop models in the local AI lab on this Mac through its `lab` command - pick a downloaded model, fit it in GPU memory, start its service, prove it answers. Use when the user wants a local model on or off ("turn on gpt-oss", "start the vision model", "switch the text model to X", "turn everything off", "stop all models", "apaga todo").
---

# Turn local models on and off

The lab's `lab` command is on PATH (the repo is named in `personal.md`). Each model runs on one **service**
(`text`, `vision`, `embeddings`, `audio`, `image`), and a service holds one model at a time. `lab --help` has the
commands; this is the order to use them in.

## Start a model

1. **Find it.** `lab models`: name, service, size on disk. Done when the model is downloaded (has a size).
   A model that isn't: say its size and ask before `lab pull <name>`, since it can be tens of GB.
2. **See what is up.** `lab status`: each service, its model, its memory, and the GPU budget.
3. **Fit it.** `lab up` refuses a model over the budget and names what holds memory. Ask which service to stop;
   never stop one, and never pass `--force`, unless the user said so. Done when the estimate fits.
4. **Start it.** Its service is down: `lab up <service> --model <name>` (no `--model` for the service's default).
   Its service is up with another model: `lab down <service> && lab up <service> --model <name>`.
   Done when `lab up` prints `✓ <service> up`.
5. **Prove it.** `lab status` shows the model on its service. Then tell the user where to use it: Open WebUI
   (`webui` service) or the service URL from `lab status`.

## Stop

- One service: `lab down <service>`.
- Everything: `lab down` with no argument, which also stops `webui` and `panel`. When the user means "the models",
  stop only the model services and say that `webui` and `panel` stay up.
- Done when `lab status` shows them down and its memory line has dropped.

## When `lab up` fails

Read the last lines of `lab logs <service>` and report them; a model that crashes while loading is usually out of
memory or unsupported by that service's engine. The browser panel (`lab up panel`, port in `lab status`) does the
same from buttons, for a user who prefers it.
