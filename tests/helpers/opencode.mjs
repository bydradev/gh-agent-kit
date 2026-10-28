// A stub of OpenCode's CLI for the OpenCode runners' tests. `models` prints
// a model list the way `opencode models opencode-go --verbose` does (1.19.3:
// each model's id line, then its JSON); every other call records its
// environment and arguments and prints the given events, one a line.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const entry = (id, variants) => [
  `opencode-go/${id}`,
  JSON.stringify(
    {
      id,
      providerID: "opencode-go",
      api: { id, url: "https://opencode.ai/inference/go/openai/v1", npm: "@ai-sdk/openai-compatible" },
      ...(variants && { variants: Object.fromEntries(variants.map((v) => [v, { reasoningEffort: v }])) }),
    },
    null,
    2,
  ),
];

// DeepSeek V4.1 Flash with the variants 1.19.3 gives it, a model listed
// before it whose id starts the same way, and one without variants last.
export const MODELS =
  [
    ...entry("deepseek-v4-pro", ["high", "max"]),
    ...entry("deepseek-v4.1-flash", ["low", "high", "max"]),
    ...entry("glm-5.3-flash"),
  ].join("\n") + "\n";

// The environment a recorded call ran with, or null when there was none.
export function readEnv(file) {
  if (!fs.existsSync(file)) return null;
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );
}

// Writes the stub to dir/opencode. `models` calls are recorded apart from
// the run, in models-env and models-args. A run prints `events` and exits
// with `exit`; `runs`, a list of {events, exit}, gives each run in turn
// its own (the last again once they run out). Every run's arguments and
// configuration are kept in calls.jsonl, the last run's environment and
// arguments in seen-env and seen-args.
export function opencodeStub(dir, { events, exit = 0, runs, models = MODELS, modelsExit = 0 }) {
  const stub = path.join(dir, "opencode");
  const files = {
    stub,
    seen: path.join(dir, "seen-env"),
    argv: path.join(dir, "seen-args"),
    calls: path.join(dir, "calls.jsonl"),
    modelsSeen: path.join(dir, "models-env"),
    modelsArgv: path.join(dir, "models-args"),
  };
  const all = runs ?? [{ events, exit }];
  all.forEach((run, i) =>
    fs.writeFileSync(
      path.join(dir, `events-${i}.jsonl`),
      run.events.map((e) => (typeof e === "string" ? e : JSON.stringify(e))).join("\n") + "\n",
    ),
  );
  const count = path.join(dir, "runs");
  const list = path.join(dir, "models.txt");
  fs.writeFileSync(list, models);
  fs.writeFileSync(
    stub,
    `#!/bin/bash
if [ "$1" = models ]; then
  env > "${files.modelsSeen}"
  printf '%s\\n' "$@" > "${files.modelsArgv}"
  # A failing list prints its error where the CLI does, on stderr.
  if [ ${modelsExit} -eq 0 ]; then cat "${list}"; else cat "${list}" >&2; fi
  exit ${modelsExit}
fi
n=$(cat "${count}" 2>/dev/null || echo 0)
echo $((n + 1)) > "${count}"
i=$(( n < ${all.length - 1} ? n : ${all.length - 1} ))
exits=(${all.map((run) => run.exit ?? 0).join(" ")})
env > "${files.seen}"
printf '%s\\n' "$@" > "${files.argv}"
for arg in "$@"; do jq -cn --arg a "$arg" '$a'; done \\
  | jq -cs --arg config "$OPENCODE_CONFIG_CONTENT" '{config: ($config | fromjson), args: .}' >> "${files.calls}"
cat "${dir}/events-$i.jsonl"
exit \${exits[$i]}
`,
    { mode: 0o755 },
  );
  return files;
}

// What the stub recorded: both calls' environments and arguments, and the
// configuration each was given, and every run's arguments and configuration.
export function recorded(files) {
  const env = readEnv(files.seen);
  const modelsEnv = readEnv(files.modelsSeen);
  const lines = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean) : null);
  return {
    env,
    args: lines(files.argv),
    config: env ? JSON.parse(env.OPENCODE_CONFIG_CONTENT) : null,
    calls: (lines(files.calls) ?? []).map((l) => JSON.parse(l)),
    modelsEnv,
    modelsArgs: lines(files.modelsArgv),
    modelsConfig: modelsEnv ? JSON.parse(modelsEnv.OPENCODE_CONFIG_CONTENT) : null,
  };
}

const realSleep = spawnSync("bash", ["-c", "command -v sleep"], { encoding: "utf8" }).stdout.trim();

// A sleep for dir/bin, ahead of the real one on PATH: it records the
// seconds asked for in dir/slept and sleeps a twentieth of a second, so a
// step's waits are seen without being waited out.
export function sleepStub(dir) {
  const bin = path.join(dir, "bin");
  const slept = path.join(dir, "slept");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "sleep"), `#!/bin/bash\necho "$1" >> "${slept}"\nexec "${realSleep}" 0.05\n`, { mode: 0o755 });
  return {
    path: `${bin}:${process.env.PATH}`,
    slept: () => (fs.existsSync(slept) ? fs.readFileSync(slept, "utf8").split("\n").filter(Boolean) : []),
  };
}
