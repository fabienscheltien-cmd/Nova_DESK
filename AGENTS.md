<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- All database access goes through server functions in src/lib/data.functions.ts (admin = session cookie, collaborator = verified e-mail token); tables have no anon/authenticated access. Why: the app has no user accounts, so open table policies would expose every record.
- Sites group domains, per-site service activation/price overrides (site_services) and per-site pickup schedules; catalogue and booking prices are resolved server-side via applySiteOverrides from the collaborator's domain. Why: prices must never be trusted from the client and each site negotiates its own offer.
