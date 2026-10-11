import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Le site est servi depuis un sous-chemin GitHub Pages
// (https://quentinperry.github.io/mini-piano/) : les adresses des
// ressources produites par le build sont préfixées en conséquence.
export default defineConfig({
  base: "/mini-piano/",
  plugins: [react()],
});
