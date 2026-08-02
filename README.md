# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Modo offline basico (PWA)

La app incluye soporte PWA para funcionamiento offline basico:

- Cachea la aplicacion (HTML, JS, CSS y assets) despues de la primera visita.
- Si se pierde internet, la app puede volver a abrir usando lo que ya fue cacheado.
- Se cachean mosaicos de OpenStreetMap para reutilizar mapas vistos recientemente.

Limitaciones importantes:

- La primera carga requiere internet.
- Datos en tiempo real (Firebase) dependen de conectividad para sincronizarse.
- El modo offline no reemplaza un servidor en produccion; para que otras personas siempre accedan, despliega en Vercel/Firebase Hosting.

## Solucion definitiva para disponibilidad publica

Codespaces es un entorno de desarrollo, no hosting permanente. Si compartes la URL del puerto del Codespace, la app deja de responder para todos cuando el contenedor reinicia, entra en reposo o se detiene.

Este repositorio ahora incluye despliegue automatico en GitHub Pages con URL publica estable en cada push a main:

- Workflow: [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)
- URL esperada: `https://proquimicajcv-sketch.github.io/HerpID-Costa-Rica/`

Con esto, aunque Codespaces se cierre, la app publica sigue disponible para usuarios.

Tambien puedes mantener Vercel como alternativa de produccion con el workflow [.github/workflows/deploy-vercel.yml](.github/workflows/deploy-vercel.yml).

## Si necesitas usar Codespaces temporalmente

Se agrego configuracion en [.devcontainer/devcontainer.json](.devcontainer/devcontainer.json) para que el puerto 3000 se publique como publico despues de reinicios.

Si quieres confirmarlo o cambiarlo manualmente:

1. Abre el panel de puertos en Codespaces:
	- https://github.com/codespaces
2. En el puerto 3000, establece visibilidad Public.

## Enlaces directos para configurar Vercel + GitHub (opcional)

1. Crear token de Vercel:
	- https://vercel.com/account/tokens
2. Ir a secretos del repo en GitHub:
	- https://github.com/proquimicajcv-sketch/HerpID-Costa-Rica/settings/secrets/actions
3. Importar repo en Vercel:
	- https://vercel.com/new
4. Dashboard de proyectos en Vercel:
	- https://vercel.com/dashboard

Para obtener VERCEL_ORG_ID y VERCEL_PROJECT_ID de forma rapida desde terminal:

1. Ejecuta: npx vercel link
2. Revisa el archivo .vercel/project.json
3. Copia orgId como VERCEL_ORG_ID y projectId como VERCEL_PROJECT_ID
