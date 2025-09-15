require("dotenv").config();
const Fastify = require("fastify");
const path = require("node:path");
const fs = require("node:fs");
const util = require("node:util");
const { pipeline } = require("node:stream");
const pump = util.promisify(pipeline);
const build = async (opts = {}) => {
  const fastify = Fastify({
    logger: true,
    ajv: {
      customOptions: {
        strict: false,
      },
    },
    ...opts,
  });
  await fastify.register(require("@fastify/swagger"), {
    openapi: {
      info: {
        title: "Masttec Moulds v2 API",
        description: "API Documentation of Masttec Moulds v2",
        version: "1.0.0",
      },
      components: {
        schemas: {},
      },
    },
    exposeRoute: true,
  });
  fastify.register(require("@fastify/swagger-ui"), {
    routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'none', 
    deepLinking: true,
  },
  staticCSP: true,
  transformStaticCSP: (header) => header, 
  uiHooks: {
    onRequest: (request, reply, next) => { next(); },
    preHandler: (request, reply, next) => { next(); }
  },
  theme: {
    title: "Masttec Moulds API Docs"
  },
  css: [
    {
      filename: 'custom.css',
      content: `
        .swagger-ui .topbar { background-color: #2c3e50; }
        .swagger-ui .topbar a span { color: #f1c40f !important; }
        .swagger-ui .info .title { color: #7e23bfff !important; }
        .swagger-ui .scheme-container { background: #ecf0f1; }
      `
    }
  ]
  });
  await fastify.register(require("@fastify/cors"), {
    origin: "*",
  });

  fastify.register(require("@fastify/multipart"));

  fastify.register(require("@fastify/jwt"), {
    secret: process.env.JWT_SECRET,
  });
  fastify.register(require("./plugins/mongoose"));

  const uploadsDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  fastify.register(require("@fastify/static"), {
    root: uploadsDir,
    prefix: "/uploads/",
  });

  fastify.register(require("./plugins/routes"));

  return fastify;
};

const start = async () => {
  try {
    const fastify = await build();
    await fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

module.exports = build;
