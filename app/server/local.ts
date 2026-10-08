// Local / single-server entry: API + built web app on one origin.
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { app } from './app.js'

app.use('/*', serveStatic({ root: './web/dist' }))
app.get('*', serveStatic({ path: './web/dist/index.html' }))
const PORT = Number(process.env.PORT || 8787)
serve({ fetch: app.fetch, port: PORT }, () => console.log(`teampot on :${PORT}`))
