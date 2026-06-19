# North Project Development Procedure

## Build Process Checklist

Follow these steps for every major iteration to ensure a stable, bug-free build:

### 1. Make Changes
- Edit code as needed in `src/`, `src/routes/`, `src/stores/`, etc.

### 2. Local Development Server
- Run `npm run dev` locally.
- Open `http://localhost:5173` (or your Vite dev server URL).
- Navigate through **all routes/pages**:
  - `/` (Home)
  - `/habits`
  - `/habits/add`
  - `/habits/[id]`
  - `/identities`
  - `/identities/[id]`
  - `/tags`
  - Any other routes you create

### 2a. Manual Testing
- Test form submissions (create habit, edit habit, delete habit)
- Test identity management (add/edit/delete)
- Test tag creation and application
- Verify navigation works smoothly

### 3. Fix Errors Immediately
- When an error appears in the terminal (Svelte/TypeScript/Vite errors), stop.
- Locate the exact file/function reported in the error.
- Fix the code to resolve the exact issue reported.
- Do **not** move on until the error is resolved locally.

### 2b. UI/UX Fixes
- Check for accessibility errors (e.g., missing label associations)
- Ensure visual layout matches design intent
- Confirm responsive behavior (mobile/desktop)

### 3. Build Command
- Run `npm run build` to generate production-ready files.

### 4. Fix Build Errors
- Any Vite compilation error must be addressed before proceeding.
- Common errors to watch for:
  - `$:` legacy reactivity (use `$derived`, `$effect`, or `$state`)
  - Svelte syntax deprecations (`<label>` without control, `on:click` vs `onclick`)
  - Missing `$` prefixes on stores
  - Incorrect relative import paths

### 4a. Fix Errors
- Re-run `npm run dev` to see updated errors
- Fix the root cause, not just the symptom
- Test the fix by refreshing the browser and repeating the same user flow

### 5. Commit & Push
Once **all errors are resolved locally** and the build succeeds:
```bash
git add .
git commit -m "Your descriptive message"
git push origin master
```

### 6. Pre-Checklist Before Push
- ✅ All routes render without Svelte errors
- ✅ All forms work (create, edit, delete)
- ✅ All navigation links function
- ✅ Stores correctly sync with IndexedDB
- ✅ No TypeScript/TS errors
- ✅ Build succeeds with `npm run build`

### 6a. Handle Warnings
- Non-breaking warnings (a11y, linting) may be ignored if they don't block builds
- Breaking errors **must** be fixed before committing

### 7. Deploy to Vercel
- Vercel will automatically build on push
- Verify the live site works end-to-end

### 8. Repeat
- When adding new features or pages, restart the loop from step 1.

---

This checklist ensures each change is thoroughly tested and verified before merging to `master`.