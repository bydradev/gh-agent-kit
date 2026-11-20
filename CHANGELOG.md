# Changelog

## [0.7.0](https://github.com/bydradev/gh-agent-kit/compare/v0.6.0...v0.7.0) (2026-11-20)


### Features

* shorten the installed work-tracking block ([8d5fe9b](https://github.com/bydradev/gh-agent-kit/commit/8d5fe9b23558277915d0c56161d664326aa14ab2))


### Bug Fixes

* check prior coverage before carrying a review verdict forward ([5ed1c33](https://github.com/bydradev/gh-agent-kit/commit/5ed1c33bfe3bf3c5a34a7379e597e6b9782d62cf))
* let target checkers define repository-name policy ([abe2513](https://github.com/bydradev/gh-agent-kit/commit/abe25132a0998461e800664a283d5d3daf6e4f2a))

## [0.6.0](https://github.com/bydradev/gh-agent-kit/compare/v0.5.1...v0.6.0) (2026-11-18)


### Features

* hold the bots' posts to a public repository's public-content check ([#57](https://github.com/bydradev/gh-agent-kit/issues/57)) ([1b1a92c](https://github.com/bydradev/gh-agent-kit/commit/1b1a92c34a19053bfa71df4647e296d35a5c3e33))
* hold the security scan's findings to the public-content check ([#61](https://github.com/bydradev/gh-agent-kit/issues/61)) ([9ca8032](https://github.com/bydradev/gh-agent-kit/commit/9ca803217e7d416aeeb8b61b32dff8cd51651ce5))
* hold the security scan's log text to the public-content check ([#66](https://github.com/bydradev/gh-agent-kit/issues/66)) ([6b517e7](https://github.com/bydradev/gh-agent-kit/commit/6b517e7a6627b65bbab2a2ea2df1f58ca83e2e64))

## [0.5.1](https://github.com/bydradev/gh-agent-kit/compare/v0.5.0...v0.5.1) (2026-11-17)


### Bug Fixes

* format mcp-server.mjs as targets' prettier check expects ([#53](https://github.com/bydradev/gh-agent-kit/issues/53)) ([200cac8](https://github.com/bydradev/gh-agent-kit/commit/200cac8de0e4322a2a5c54682860c6d0ebf8a850))

## [0.5.0](https://github.com/bydradev/gh-agent-kit/compare/v0.4.4...v0.5.0) (2026-11-17)


### Features

* add requested work, simpler labels and an issue-link check ([#50](https://github.com/bydradev/gh-agent-kit/issues/50)) ([3789e8a](https://github.com/bydradev/gh-agent-kit/commit/3789e8abfe0e7108f8284be7b01158744ad25512))
* install the work tracking block and add an issue-filing skill ([#49](https://github.com/bydradev/gh-agent-kit/issues/49)) ([b40ac4f](https://github.com/bydradev/gh-agent-kit/commit/b40ac4ff4dd1d4f6ed6426b4341c6caaaf3f904a))

## [0.4.4](https://github.com/bydradev/gh-agent-kit/compare/v0.4.3...v0.4.4) (2026-11-16)


### Bug Fixes

* let the opencode go carry-on outlast a capacity spell ([#43](https://github.com/bydradev/gh-agent-kit/issues/43)) ([a047bcd](https://github.com/bydradev/gh-agent-kit/commit/a047bcda430439ff788112b89bb4def625844938))

## [0.4.3](https://github.com/bydradev/gh-agent-kit/compare/v0.4.2...v0.4.3) (2026-11-16)


### Bug Fixes

* **install:** drop the chmod "--" that macOS reads as a file name ([#39](https://github.com/bydradev/gh-agent-kit/issues/39)) ([f4a9f19](https://github.com/bydradev/gh-agent-kit/commit/f4a9f193b1fbcb55f0de93276dac67397830c50b))

## [0.4.2](https://github.com/bydradev/gh-agent-kit/compare/v0.4.1...v0.4.2) (2026-11-16)


### Performance Improvements

* skip unneeded review and scan jobs from the settings job ([#37](https://github.com/bydradev/gh-agent-kit/issues/37)) ([8782273](https://github.com/bydradev/gh-agent-kit/commit/8782273bd92413ce809632c55350f42ff40a24bd))

## [0.4.1](https://github.com/bydradev/gh-agent-kit/compare/v0.4.0...v0.4.1) (2026-10-29)


### Bug Fixes

* carry OpenCode runs on after Go's capacity refusal ([#29](https://github.com/bydradev/gh-agent-kit/issues/29)) ([f806fc9](https://github.com/bydradev/gh-agent-kit/commit/f806fc9700054212bd647a1f1ce43a87746d4a86))

## [0.4.0](https://github.com/bydradev/gh-agent-kit/compare/v0.3.2...v0.4.0) (2026-10-28)


### ⚠ BREAKING CHANGES

* run the review, scan and triage in OpenCode's CLI on OpenCode Go ([#24](https://github.com/bydradev/gh-agent-kit/issues/24))

### Features

* run the review, scan and triage in OpenCode's CLI on OpenCode Go ([#24](https://github.com/bydradev/gh-agent-kit/issues/24)) ([64bcee6](https://github.com/bydradev/gh-agent-kit/commit/64bcee6fd9eefe621e754a8f7eea4330969254d7))
* shorten the Work tracking block and let agents file found work ([#21](https://github.com/bydradev/gh-agent-kit/issues/21)) ([b83e0e8](https://github.com/bydradev/gh-agent-kit/commit/b83e0e8d89b2c6f45551f3666b433658554cf630))


### Bug Fixes

* keep session links out of issue claim comments ([b83e0e8](https://github.com/bydradev/gh-agent-kit/commit/b83e0e8d89b2c6f45551f3666b433658554cf630))
* set out triage's event rules and the review's round choice case by case ([#23](https://github.com/bydradev/gh-agent-kit/issues/23)) ([da86417](https://github.com/bydradev/gh-agent-kit/commit/da864176046f0593d5fa906b873d53871b6db709))
* stop workflow commands in the Claude Code review and triage logs ([#27](https://github.com/bydradev/gh-agent-kit/issues/27)) ([d4452b9](https://github.com/bydradev/gh-agent-kit/commit/d4452b97ec3afe7de4e0a5a46600c8c433575eb3))

## [0.3.2](https://github.com/bydradev/gh-agent-kit/compare/v0.3.1...v0.3.2) (2026-10-28)


### Bug Fixes

* fail before the model starts when the Anthropic key is missing ([#17](https://github.com/bydradev/gh-agent-kit/issues/17)) ([1528267](https://github.com/bydradev/gh-agent-kit/commit/1528267333ca47e9b77df0f7dba57d5fc18d5f17))

## [0.3.1](https://github.com/bydradev/gh-agent-kit/compare/v0.3.0...v0.3.1) (2026-10-27)


### Bug Fixes

* write the triage skill's date placeholder as code ([#15](https://github.com/bydradev/gh-agent-kit/issues/15)) ([8f297f2](https://github.com/bydradev/gh-agent-kit/commit/8f297f2629f63052f1d24bfbb07ace270233cf5a))

## [0.3.0](https://github.com/bydradev/gh-agent-kit/compare/v0.2.0...v0.3.0) (2026-10-27)


### Features

* let an install keep a repository's own issue forms ([#12](https://github.com/bydradev/gh-agent-kit/issues/12)) ([cdba9ce](https://github.com/bydradev/gh-agent-kit/commit/cdba9cec3e62f752c15af5db113fd5e25f8af324))
* report each acceptance criterion with its evidence ([#13](https://github.com/bydradev/gh-agent-kit/issues/13)) ([d4b1eee](https://github.com/bydradev/gh-agent-kit/commit/d4b1eee81bc4f0e15b0cede4ec715eeb3b8bc2b0))

## [0.2.0](https://github.com/bydradev/gh-agent-kit/compare/v0.1.0...v0.2.0) (2026-10-27)


### ⚠ BREAKING CHANGES

* refuse an unknown value for a workflow switch ([#8](https://github.com/bydradev/gh-agent-kit/issues/8))

### Bug Fixes

* refuse an unknown value for a workflow switch ([#8](https://github.com/bydradev/gh-agent-kit/issues/8)) ([234848d](https://github.com/bydradev/gh-agent-kit/commit/234848d00ba18fcac67cd927cc5a4706742aaa6f))
* strip the --!&gt; comment closer from text filed in issues ([#5](https://github.com/bydradev/gh-agent-kit/issues/5)) ([59993e0](https://github.com/bydradev/gh-agent-kit/commit/59993e0135081bac0bb518e44a36b5c03a580b92))

## 0.1.0 (2026-10-27)


### Features

* initial public release ([7a949d0](https://github.com/bydradev/gh-agent-kit/commit/7a949d0e9a0da6556f520e3a6ce026df4f818eb0))
