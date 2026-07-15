
  # Lotus App Builder UI

  This is a code bundle for Lotus App Builder UI. The original project is available at https://www.figma.com/design/ixNJIR8wjOK33fbxmEPm2x/Lotus-App-Builder-UI.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Supabase project storage

  Project recents, folders, edits, save, and autosave use Supabase when these Vite env vars are set:

  ```bash
  VITE_SUPABASE_URL=https://orghdwyqtpzfspevqhey.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key
  ```

  Copy `.env.example` to `.env.local`, add the anon key from Supabase, then run the migration in `supabase/migrations/20260715112000_lotus_builder_projects.sql`.

  If the env vars are missing, the app falls back to browser local storage.
  
