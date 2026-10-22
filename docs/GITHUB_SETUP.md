# First GitHub setup

The repository creation itself is the only step not performed by the current ChatGPT GitHub connector.

From the repository root:

```bash
./bootstrap-github.sh
```

This script:

1. initializes `main`
2. stages all files
3. runs `git diff --cached --check`
4. creates the first commit
5. creates the public repository `sironekotoro/lookup-box`
6. pushes `main`

Prerequisites:

```bash
gh auth status
```

After the push, verify **Actions -> Build browser extensions**. It should produce two artifacts:

- `lookup-box-chrome`
- `lookup-box-firefox`

For Pages, do the one-time GitHub setting:

`Settings -> Pages -> Build and deployment -> Source -> GitHub Actions`

Then run **Deploy GitHub Pages** manually or push a change under `site/`.

Expected URL:

`https://lookupbox.sironekotoro.com/`
