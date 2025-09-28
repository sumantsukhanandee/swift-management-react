// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite"; // Import the Vite plugin

export default defineConfig({
  plugins: [
    tailwindcss(), // Use the Vite plugin
    // other plugins (e.g., react(), vue())
  ],
  // Remove any css: { postcss: { ... } } configuration for tailwind
});
