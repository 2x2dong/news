# Project Agent Instructions

## Browser Debugging

- Use Playwright as the default browser debugging path for this project.
- Prefer the Codex in-app Browser with `tab.playwright` for navigation, DOM inspection, clicks, typing, screenshots, console checks, and visual QA.
- Treat direct Chrome extension pages such as `chrome-extension://jfeammnjpkecdekppnclgkkffahnhfhe/src/welcome.html` as user-facing setup pages, not as the default debugging backend.
- Use coordinate or vision-based interaction only when Playwright cannot identify or operate the target reliably.
- After frontend changes, verify the actual rendered page with Playwright before reporting completion.
