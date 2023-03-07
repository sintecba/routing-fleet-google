/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { promises as fs } from "fs";

import bodyParser from "body-parser";
import cors from "cors";
import express, { Response, Request } from "express";
import expressPinoLogger from "express-pino-logger";
import multer from "multer";

import { router as apiRoutes } from "./routes/api";
import { router as optimizationRoutes } from "./routes/optimization";

import { log } from "./logging";

export const app = express();

// logging
app.use(
  expressPinoLogger({
    logger: log,
  })
);

// headers
app.disable("x-powered-by");

// cors
app.use(
  cors({
    origin: "*",
    methods: "GET, PUT, POST, DELETE",
    allowedHeaders: "Content-Type",
  })
);

// multi-part form data
app.use(
  multer({
    storage: multer.memoryStorage(),
  }).single("file")
);

// body parser
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

/**
 * Readiness/liveness probe
 */
app.get("/healthz", async (req: Request, res: Response) => {
  log.debug("Health check");
  res.status(200).send("OK");
});

/**
 * Generate front-end config from env vars
 */
app.get("/config.json", async (req: Request, res: Response) => {
  let config: any;

  // get config.json from angular app when proxied
  if (process.env.FRONTEND_PROXY) {
    try {
      const axios = (await import("axios")) as any;
      const response = await axios.get(
        process.env.FRONTEND_PROXY + "config.json"
      );
      config = response.data;
    } catch (err) {
      log.error(err);
    }
  }

  if (!config) {
    try {
      // Read config.json from cwd
      const data = await fs.readFile("public/config.json");
      config = JSON.parse(data.toString());
    } catch (err) {
      log.error(err);
      return res.sendStatus(404);
    }
  }

  try {
    // self link to this api
    if (!config.backendApi) {
      config.backendApi = {};
    }
    config.backendApi.apiRoot = process.env.API_ROOT;

    // experimental features
    config.allowExperimentalFeatures = process.env.ALLOW_EXPERIMENTAL_FEATURES?.toLowerCase() === "true";

    // maps api
    if (!config.map) {
      config.map = {};
    }
    config.map.apiKey = process.env.MAP_API_KEY;

    // storage api
    if (!config.storageApi) {
      config.storageApi = {};
    }
    config.storageApi.apiRoot = process.env.API_ROOT;
    config.storageApi.allowUserStorage = process.env.ALLOW_USER_GCS_STORAGE?.toLowerCase() === "true";

    res.status(200).send(config);
  } catch (err) {
    log.error(err);
    return res.sendStatus(500);
  }
});

/**
 * Front-end static content
 */
if (process.env.FRONTEND_PROXY) {
  import("http-proxy-middleware").then((module) => {
    app.use(
      "/",
      module.createProxyMiddleware({
        target: process.env.FRONTEND_PROXY,
      })
    );
  });
} else {
  app.use(express.static("public"));
}


// other routes
app.use("/api", apiRoutes);
app.use("/api/optimization", optimizationRoutes);
