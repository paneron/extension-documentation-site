import { ObjectChangeset } from '@riboseinc/paneron-extension-kit/types';
import { SiteSettings } from '../SiteSettings';


const ROBOTS = "User-agent: *";


function getAperisSetupChangeset(settings: SiteSettings, remove: boolean): ObjectChangeset {
  return {

    '.gitignore': {
      encoding: 'utf-8',
      oldValue: undefined,
      newValue: remove ? null : `
node_modules
tmp
artifacts
dist
      `
    },

    'static.config.js': {
      encoding: 'utf-8',
      oldValue: undefined,
      newValue: remove ? null : `
        import path from 'path'

        const DOCS_PATH = path.join(__dirname, 'docs');

        export default {
          entry: path.join(__dirname, 'src', 'index.tsx'),
          getRoutes: async () => {
            return [
            ]
          },
          plugins: [
            'react-static-plugin-typescript',
            'react-static-plugin-styled-components',
            [
              '@riboseinc/react-static-plugin-aperis-doc-pages',
              {
                sourcePath: DOCS_PATH,
                urlPrefix: '${settings.urlPrefix}',
                title: "${settings.title}",
                headerBanner: 'header-banner.svg',
                footerBanner: 'footer-banner.svg',
                footerBannerLink: "${settings.footerBannerLink}",
              }
            ],
            require.resolve('react-static-plugin-reach-router'),
            require.resolve('react-static-plugin-sitemap'),
            [
              'react-static-plugin-file-watch-reload',
              {
                paths: [\`\${DOCS_PATH}/**/*\`],
              },
            ],
          ],
        }
      `,
    },

    'src/GlobalStyle.ts': {
      encoding: 'utf-8',
      oldValue: undefined,
      newValue: remove ? null : `
        import { createGlobalStyle } from 'styled-components'

        export default createGlobalStyle\`
          * {
            scroll-behavior: smooth;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            font-size: 17px;
            font-weight: 300;
            -moz-osx-font-smoothing: grayscale;
            margin: 0;
            padding: 0;

            height: 100vh;

            display: flex;
            flex-flow: column nowrap;
          }

          p {
            font-size: 100%;
            line-height: 1.5;
          }

          a {
            color: #ff1d25;
            text-decoration: none;
          }

          :global .svg-inline--fa {
            height: 1em;
            width: 1em;
          }

          img {
            max-width: 100%;
          }
        \`
      `,
    },

    'src/App.tsx': {
      encoding: 'utf-8',
      oldValue: undefined,
      newValue: remove ? null : `
        import React from 'react'
        import { Root, Routes } from 'react-static'
        import { Router } from '@reach/router'
        import { Helmet } from 'react-helmet'
        import chroma from 'chroma-js'
        import GlobalStyle from './GlobalStyle'

        export const pageContainerSelector = 'body > #root > :first-child > :first-child'

        export const primaryColor = chroma('#ff1d25');

        function App() {
          return (
            <Root>

              <GlobalStyle />

              <Helmet>
                <title>${settings.title}</title>
                <meta charSet="utf-8" />
                <meta http-equiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
              </Helmet>

              <React.Suspense fallback={<em>Loading...</em>}>
                <Router>
                  <Routes path="*" />
                </Router>
              </React.Suspense>
            </Root>
          )
        }

        export default App
      `,
    },

    'src/index.tsx': {
      encoding: 'utf-8',
      oldValue: undefined,
      newValue: remove ? null : `
        import React from 'react'
        import ReactDOM from 'react-dom'
        import { AppContainer } from 'react-hot-loader'

        // Your top level component
        import App from './App'

        // Export your top level component as JSX (for static rendering)
        export default App

        // Render your app
        if (typeof document !== 'undefined') {
          const target = document.getElementById('root')

          const renderMethod = target.hasChildNodes()
            ? ReactDOM.hydrate
            : ReactDOM.render

          const render = (Comp: Function) => {
            renderMethod(
              <AppContainer>
                <Comp />
              </AppContainer>,
              target
            )
          }

          // Render!
          render(App)

          // Hot Module Replacement
          if (module && module.hot) {
            module.hot.accept('./App', () => {
              render(App)
            })
          }
        }
      `,
    },

    'public/robots.txt': {
      encoding: 'utf-8',
      oldValue: undefined,
      newValue: remove ? null : ROBOTS,
    },

    'tsconfig.json': {
      encoding: 'utf-8',
      oldValue: undefined,
      newValue: remove ? null : `
{
  "compileOnSave": false,
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "jsx": "preserve",
    "allowJs": false,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "removeComments": false,
    "preserveConstEnums": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "components/*": ["src/components/*"],
      "containers/*": ["src/containers/*"],
      "types/*": ["types/*"]
    },
    "lib": ["dom", "es2015", "es2016"]
  },
  "exclude": ["artifacts/**/*", "dist/**/*", "public/**/*", "node_modules"]
}
      `,
    },

    'package.json': {
      encoding: 'utf-8',
      oldValue: undefined,
      newValue: remove ? null : `
{
  "name": "my-aperis-site",
  "private": true,
  "scripts": {
    "start": "react-static start",
    "stage": "react-static build --staging",
    "build": "react-static build",
    "bundle": "react-static bundle",
    "export": "react-static export",
    "serve": "serve dist -p 3000 -s"
  },
  "dependencies": {
    "@reach/router": "^1.2.1",
    "@riboseinc/aperis-doc-pages": "^1.0.0-pre8",
    "@riboseinc/react-static-plugin-aperis-doc-pages": "^1.0.7",
    "axios": "^0.19.0",
    "chroma-js": "^2.1.0",
    "react": "^16.9.0",
    "react-dom": "^16.9.0",
    "react-static": "^7.2.0",
    "react-static-plugin-reach-router": "^7.2.0",
    "react-static-plugin-sitemap": "^7.2.0",
    "react-static-plugin-source-filesystem": "^7.2.0",
    "react-static-plugin-styled-components": "^7.3.0",
    "react-static-plugin-typescript": "^7.2.0",
    "styled-components": "^5.1.1"
  },
  "devDependencies": {
    "@types/chroma-js": "^2.0.0",
    "@types/node": "^12.7.2",
    "@types/reach__router": "^1.2",
    "@types/react": "^16.9.1",
    "@types/react-dom": "^16.8.5",
    "@types/react-helmet": "^6.1.0",
    "@types/react-hot-loader": "^4.1.0",
    "@types/styled-components": "^5.1.2",
    "@types/webpack-env": "^1.14.0",
    "react-hot-loader": "^4.12.11",
    "react-static-plugin-file-watch-reload": "^1.0.4",
    "serve": "^11.1.0",
    "typescript": "^3.9.6"
  }
}
      `
    },

  };
}


export default getAperisSetupChangeset;
