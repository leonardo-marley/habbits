// Back-end API RESTFul
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { appRoutes } from './routes'

const app = Fastify()

app.register(cors,{
    // origin: ['http://localhost:3000'] exemplo
})
// Método HTTP: Get, post, put, pacth, Delete

app.register(appRoutes)

app.listen({
   port: 3333,
}).then(() =>{
    console.log('HTTP Server Running Bitch!')
})

// localhost:3333/habits

